import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jsonlPath = path.resolve(__dirname, '../ResumeDataset/resumes_dataset.jsonl')

const FALLBACK_LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Bengaluru, IN',
  'Boston, MA', 'Chicago, IL', 'Toronto, CA', 'London, UK', 'Hyderabad, IN', 'Denver, CO', 'Remote'
]

const STATUSES = ['Active', 'Active', 'Active', 'In review', 'In review', 'Archived']

const EXTRA_SKILLS = [
  'Java', 'Spring Boot', 'Python', 'SQL', 'PostgreSQL', 'MySQL', 'Oracle', 'MongoDB',
  'JavaScript', 'TypeScript', 'React', 'Angular', 'Node.js', 'AWS', 'Azure', 'GCP',
  'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'Kafka', 'Redis', 'GraphQL',
  'Machine Learning', 'PyTorch', 'TensorFlow', 'Spark', 'Hadoop', 'Snowflake',
  'Git', 'Linux', 'Agile', 'Scrum', 'CI/CD', 'REST API', 'Microservices', 'Figma', 'Tableau', 'PowerBI'
]

function extractExperience(text, idx) {
  const m = String(text || '').match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\s*(?:of\s+)?(?:experience|exp)/i)
  if (m) {
    const yrs = Number(m[1])
    if (yrs >= 0 && yrs <= 35) return yrs
  }
  return Number((2 + (idx % 10) * 0.5).toFixed(1))
}

function cleanSummary(raw, max = 460) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…'
}

function extractSkills(skillsField, fullText) {
  const set = new Set()
  for (const s of String(skillsField || '').split(',').map(x => x.trim()).filter(Boolean)) {
    if (s.length <= 75) set.add(s)
  }
  const lower = String(fullText || '').toLowerCase()
  for (const sk of EXTRA_SKILLS) {
    if (set.size >= 8) break
    const esc = sk.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${esc}\\b`, 'i').test(lower)) set.add(sk)
  }
  return [...set].slice(0, 8)
}

function parseEducation(eduStr) {
  const s = String(eduStr || '').trim()
  if (!s) return null
  const yrMatch = s.match(/\b(199\d|20[0-2]\d)\b/)
  const graduationYear = yrMatch ? Number(yrMatch[1]) : null
  const fromMatch = s.match(/^(.+?)\s+from\s+([^,]+)/i)
  if (fromMatch) {
    return {
      degree: fromMatch[1].trim().slice(0, 115),
      institution: fromMatch[2].trim().slice(0, 155),
      graduationYear
    }
  }
  return {
    degree: s.slice(0, 115),
    institution: 'Accredited University',
    graduationYear
  }
}

async function run() {
  if (!fs.existsSync(jsonlPath)) {
    console.error('File not found:', jsonlPath)
    process.exit(1)
  }

  console.log('Reading ResumeDataset/resumes_dataset.jsonl (ResumeAtlas 2024)...')
  const lines = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n')
  console.log(`Parsed ${lines.length} records from resumes_dataset.jsonl.`)

  const pool = new pg.Pool(process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL
  } : {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'resume_vault'
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Avoid flooding audit_logs with 3,500 bulk import events
    await client.query('ALTER TABLE resumes DISABLE TRIGGER trg_resume_insert_audit')

    const skillIdMap = new Map()
    const existingSkills = await client.query('SELECT skill_id, skill_name FROM skills')
    for (const row of existingSkills.rows) {
      skillIdMap.set(row.skill_name, row.skill_id)
    }

    let imported = 0
    for (let i = 0; i < lines.length; i++) {
      const rec = JSON.parse(lines[i])
      const resumeCode = String(rec.ResumeID || `ATLAS_${i + 1}`).trim()
      const name = String(rec.Name || `Candidate ${resumeCode}`).trim().slice(0, 115)
      const email = `${resumeCode.toLowerCase()}@resumeatlas2024.vault`
      const rawLoc = String(rec.Location || '').trim()
      const location = (!rawLoc || rawLoc.toLowerCase() === 'city, state')
        ? FALLBACK_LOCATIONS[i % FALLBACK_LOCATIONS.length]
        : rawLoc.slice(0, 115)
      const category = String(rec.Category || 'Technology').trim()
      const role = category.slice(0, 135)
      const fullText = `${rec.Summary || ''} ${rec.Experience || ''} ${rec.Text || ''}`
      const experience = extractExperience(fullText, i)
      const summary = cleanSummary(rec.Summary || rec.Text || '')
      const srcPrefix = rec.Source === 'ResumeAtlas' ? 'ResumeAtlas 2024' : 'ResumeAtlas 2024 (Synth)'
      const source = `${srcPrefix} · ${category}`.slice(0, 60)
      const status = STATUSES[i % STATUSES.length]
      const daysAgo = i % 28
      const skills = extractSkills(rec.Skills, fullText)

      const candRes = await client.query(
        `INSERT INTO candidates (full_name, email, location)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, location = EXCLUDED.location
         RETURNING candidate_id`,
        [name, email, location]
      )
      const candidateId = candRes.rows[0].candidate_id

      const existingRes = await client.query(
        'SELECT resume_id FROM resumes WHERE candidate_id = $1 LIMIT 1',
        [candidateId]
      )

      let resumeId
      if (existingRes.rows.length > 0) {
        resumeId = existingRes.rows[0].resume_id
      } else {
        const resInsert = await client.query(
          `INSERT INTO resumes (candidate_id, current_title, summary, experience_years, source, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - ($7 || ' days')::interval, CURRENT_TIMESTAMP - ($7 || ' days')::interval)
           RETURNING resume_id`,
          [candidateId, role, summary, experience, source, status, String(daysAgo)]
        )
        resumeId = resInsert.rows[0].resume_id
      }

      for (const sk of skills) {
        let sId = skillIdMap.get(sk)
        if (!sId) {
          const sr = await client.query(
            'INSERT INTO skills (skill_name) VALUES ($1) ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name RETURNING skill_id',
            [sk]
          )
          sId = sr.rows[0].skill_id
          skillIdMap.set(sk, sId)
        }
        await client.query(
          'INSERT INTO resume_skills (resume_id, skill_id, proficiency) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [resumeId, sId, experience >= 6 ? 'Expert' : experience >= 3 ? 'Advanced' : 'Intermediate']
        )
      }

      const edu = parseEducation(rec.Education)
      if (edu) {
        const hasEdu = await client.query('SELECT 1 FROM education WHERE resume_id = $1 LIMIT 1', [resumeId])
        if (!hasEdu.rows.length) {
          await client.query(
            'INSERT INTO education (resume_id, institution, degree, graduation_year) VALUES ($1, $2, $3, $4)',
            [resumeId, edu.institution, edu.degree, edu.graduationYear]
          )
        }
      }

      imported++
      if (imported % 500 === 0) {
        console.log(`Imported ${imported} / ${lines.length} ResumeAtlas 2024 records...`)
      }
    }

    await client.query('ALTER TABLE resumes ENABLE TRIGGER trg_resume_insert_audit')
    await client.query('COMMIT')

    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM candidates) AS candidates,
        (SELECT COUNT(*) FROM resumes) AS resumes,
        (SELECT COUNT(*) FROM skills) AS skills,
        (SELECT COUNT(*) FROM education) AS education,
        (SELECT COUNT(*) FROM resumes WHERE source LIKE 'ResumeAtlas 2024%') AS atlas_rows
    `)
    console.log('Done! Database totals:', totals.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    try { await client.query('ALTER TABLE resumes ENABLE TRIGGER trg_resume_insert_audit') } catch {}
    console.error('Import failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
