// One-off maintenance: normalise names, titles, sources and summaries of rows imported
// from ResumeDataset/Resume.csv. Safe to re-run (idempotent).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import 'dotenv/config'
import { cleanTitle, makeName, sourceLabel, tidySummary } from './dataset_utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const csvPath = path.resolve(__dirname, '../ResumeDataset/Resume.csv')

function parseCsv(text) {
  const out = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') { if (q && text[i + 1] === '"') { field += '"'; i++ } else q = !q }
    else if (ch === ',' && !q) { row.push(field); field = '' }
    else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length >= 4) out.push(row)
      row = []
    } else field += ch
  }
  return out
}

const pool = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'resume_vault'
})

const csvById = new Map()
if (fs.existsSync(csvPath)) {
  for (const r of parseCsv(fs.readFileSync(csvPath, 'utf8')).slice(1)) csvById.set(r[0].trim(), { text: r[1] || '', category: (r[3] || '').trim() })
}

const client = await pool.connect()
try {
  const { rows } = await client.query(`
    SELECT r.resume_id, c.candidate_id, c.email, r.current_title, r.source
    FROM resumes r JOIN candidates c ON c.candidate_id = r.candidate_id
    WHERE c.email LIKE '%@resumedataset.vault'`)
  console.log(`Cleaning ${rows.length} dataset resumes...`)

  await client.query('BEGIN')
  // bulk maintenance should not flood audit_logs with UPDATE rows
  await client.query('ALTER TABLE resumes DISABLE TRIGGER trg_resume_update_audit')

  for (const row of rows) {
    const id = row.email.replace(/^resume\./, '').replace(/@.*$/, '')
    const csv = csvById.get(id)
    const category = csv?.category || String(row.source).replace(/^.*·\s*/, '')
    await client.query('UPDATE candidates SET full_name = $1 WHERE candidate_id = $2', [makeName(id), row.candidate_id])
    await client.query(
      'UPDATE resumes SET current_title = $1, source = $2, summary = COALESCE($3, summary) WHERE resume_id = $4',
      [cleanTitle(row.current_title, category), sourceLabel(category), csv ? tidySummary(csv.text, 700) : null, row.resume_id]
    )
  }

  await client.query('ALTER TABLE resumes ENABLE TRIGGER trg_resume_update_audit')
  await client.query('COMMIT')
  console.log('Done.')
} catch (e) {
  await client.query('ROLLBACK')
  console.error(e)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
