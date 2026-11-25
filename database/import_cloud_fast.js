import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import 'dotenv/config'
import { cleanTitle, makeName, sourceLabel, tidySummary } from './dataset_utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const csvPath = path.resolve(__dirname, '../ResumeDataset/Resume.csv')
const jsonlPath = path.resolve(__dirname, '../ResumeDataset/resumes_dataset.jsonl')

const CSV_SKILLS = [
  'Python', 'SQL', 'PostgreSQL', 'Java', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS',
  'Azure', 'Docker', 'Kubernetes', 'Linux', 'Git', 'Machine Learning', 'Data Analysis', 'Excel',
  'Tableau', 'PowerBI', 'Project Management', 'Agile', 'Scrum', 'Leadership', 'Communication',
  'Accounting', 'Financial Analysis', 'Budgeting', 'Auditing', 'Payroll', 'HRIS', 'Recruiting',
  'Employee Relations', 'Onboarding', 'Training', 'Marketing', 'SEO', 'CRM', 'Salesforce',
  'Customer Service', 'Operations', 'Supply Chain', 'AutoCAD', 'SolidWorks', 'SAP', 'Oracle',
  'C++', 'C#', '.NET', 'HTML', 'CSS', 'Figma', 'Adobe Creative Suite', 'Networking', 'Security',
  'Testing', 'QA', 'Compliance', 'Risk Management', 'Public Relations', 'Copywriting'
]

const ATLAS_EXTRA_SKILLS = [
  'Java', 'Spring Boot', 'Python', 'SQL', 'PostgreSQL', 'MySQL', 'Oracle', 'MongoDB',
  'JavaScript', 'TypeScript', 'React', 'Angular', 'Node.js', 'AWS', 'Azure', 'GCP',
  'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'Kafka', 'Redis', 'GraphQL',
  'Machine Learning', 'PyTorch', 'TensorFlow', 'Spark', 'Hadoop', 'Snowflake',
  'Git', 'Linux', 'Agile', 'Scrum', 'CI/CD', 'REST API', 'Microservices', 'Figma', 'Tableau', 'PowerBI'
]

const LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Bengaluru, IN',
  'Boston, MA', 'Chicago, IL', 'Toronto, CA', 'London, UK', 'Hyderabad, IN', 'Denver, CO', 'Remote'
]
const STATUSES = ['Active', 'Active', 'Active', 'In review', 'In review', 'Archived']

function parseCsvRows(text) {
  const records = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(field); field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length >= 4) records.push(row)
      row = []
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    if (row.length >= 4) records.push(row)
  }
  return records
}

function extractExp(text, seed) {
  const m = String(text || '').match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\s*(?:of\s+)?(?:experience|exp)/i)
  if (m) {
    const y = Number(m[1])
    if (y >= 0 && y <= 35) return y
  }
  return Number((2 + (seed % 10) * 0.5).toFixed(1))
}

function extractCsvSkills(text, category) {
  const lower = String(text || '').toLowerCase()
  const out = []
  for (const s of CSV_SKILLS) {
    const esc = s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${esc}\\b`, 'i').test(lower)) out.push(s)
    if (out.length >= 6) break
  }
  if (!out.length) out.push(cleanTitle(category, category))
  return out
}

function extractAtlasSkills(skillsField, fullText) {
  const set = new Set()
  for (const s of String(skillsField || '').split(',').map(x => x.trim()).filter(Boolean)) {
    if (s.length <= 75) set.add(s)
  }
  const lower = String(fullText || '').toLowerCase()
  for (const sk of ATLAS_EXTRA_SKILLS) {
    if (set.size >= 8) break
    const esc = sk.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${esc}\\b`, 'i').test(lower)) set.add(sk)
  }
  return [...set].slice(0, 8)
}

function parseEdu(eduStr) {
  const s = String(eduStr || '').trim()
  if (!s) return null
  const yr = s.match(/\b(199\d|20[0-2]\d)\b/)
  const graduationYear = yr ? Number(yr[1]) : null
  const m = s.match(/^(.+?)\s+from\s+([^,]+)/i)
  if (m) return { degree: m[1].trim().slice(0, 115), institution: m[2].trim().slice(0, 155), graduationYear }
  return { degree: s.slice(0, 115), institution: 'Accredited University', graduationYear }
}

function buildAllRecords() {
  const items = []

  if (fs.existsSync(csvPath)) {
    console.log('Parsing ResumeDataset/Resume.csv...')
    const rows = parseCsvRows(fs.readFileSync(csvPath, 'utf8')).slice(1)
    for (let i = 0; i < rows.length; i++) {
      const [idStr, resumeStr = '', , categoryRaw = 'General'] = rows[i]
      const idNum = Number(idStr) || (i + 1000)
      const category = categoryRaw.trim() || 'General'
      const email = `resume.${idStr.trim()}@resumedataset.vault`
      items.push({
        name: makeName(idNum).slice(0, 115),
        email,
        location: LOCATIONS[idNum % LOCATIONS.length],
        role: cleanTitle(resumeStr.slice(0, 140), category).slice(0, 135),
        summary: tidySummary(resumeStr, 480),
        experience: extractExp(resumeStr, idNum),
        source: sourceLabel(category).slice(0, 60),
        status: STATUSES[idNum % STATUSES.length],
        daysAgo: idNum % 30,
        skills: extractCsvSkills(resumeStr, category),
        education: null
      })
    }
    console.log(`  -> ${rows.length} CSV resumes parsed`)
  }

  if (fs.existsSync(jsonlPath)) {
    console.log('Parsing ResumeDataset/resumes_dataset.jsonl (ResumeAtlas 2024)...')
    const lines = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n')
    for (let i = 0; i < lines.length; i++) {
      const rec = JSON.parse(lines[i])
      const code = String(rec.ResumeID || `ATLAS_${i + 1}`).trim()
      const category = String(rec.Category || 'Technology').trim()
      const fullText = `${rec.Summary || ''} ${rec.Experience || ''} ${rec.Text || ''}`
      const rawLoc = String(rec.Location || '').trim()
      const srcPrefix = rec.Source === 'ResumeAtlas' ? 'ResumeAtlas 2024' : 'ResumeAtlas 2024 (Synth)'
      items.push({
        name: String(rec.Name || `Candidate ${code}`).trim().slice(0, 115),
        email: `${code.toLowerCase()}@resumeatlas2024.vault`,
        location: (!rawLoc || rawLoc.toLowerCase() === 'city, state') ? LOCATIONS[i % LOCATIONS.length] : rawLoc.slice(0, 115),
        role: category.slice(0, 135),
        summary: tidySummary(rec.Summary || rec.Text || '', 460),
        experience: extractExp(fullText, i),
        source: `${srcPrefix} · ${category}`.slice(0, 60),
        status: STATUSES[i % STATUSES.length],
        daysAgo: i % 28,
        skills: extractAtlasSkills(rec.Skills, fullText),
        education: parseEdu(rec.Education)
      })
    }
    console.log(`  -> ${lines.length} ResumeAtlas 2024 resumes parsed`)
  }

  // Deduplicate by email
  const map = new Map()
  for (const it of items) map.set(it.email, it)
  return [...map.values()]
}

async function run() {
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL
  const isRemote = Boolean(connStr && !connStr.includes('localhost') && !connStr.includes('127.0.0.1'))
  const pool = new pg.Pool(connStr ? {
    connectionString: connStr,
    ssl: isRemote ? { rejectUnauthorized: false } : false
  } : {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'resume_vault'
  })

  const records = buildAllRecords()
  console.log(`Bulk uploading ${records.length} resumes via PostgreSQL UNNEST batches...`)
  const start = Date.now()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('ALTER TABLE resumes DISABLE TRIGGER trg_resume_insert_audit')

    // 1. Bulk upsert all skills
    const allSkills = [...new Set(records.flatMap(r => r.skills))]
    await client.query(
      'INSERT INTO skills (skill_name) SELECT * FROM UNNEST($1::text[]) ON CONFLICT (skill_name) DO NOTHING',
      [allSkills]
    )
    const skillRows = await client.query('SELECT skill_id, skill_name FROM skills')
    const skillMap = new Map(skillRows.rows.map(r => [r.skill_name, r.skill_id]))
    console.log(`  1/4 Upserted ${allSkills.length} unique skills`)

    // 2. Bulk upsert candidates in chunks of 1000
    const emailToCandId = new Map()
    for (let i = 0; i < records.length; i += 1000) {
      const chunk = records.slice(i, i + 1000)
      const res = await client.query(
        `INSERT INTO candidates (full_name, email, location)
         SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, location = EXCLUDED.location
         RETURNING candidate_id, email`,
        [chunk.map(x => x.name), chunk.map(x => x.email), chunk.map(x => x.location)]
      )
      for (const row of res.rows) emailToCandId.set(row.email, row.candidate_id)
    }
    console.log(`  2/4 Upserted ${emailToCandId.size} candidates`)

    // 3. Bulk insert resumes (only for candidates without an existing resume)
    const existingRes = await client.query('SELECT resume_id, candidate_id FROM resumes')
    const candToResumeId = new Map(existingRes.rows.map(r => [String(r.candidate_id), r.resume_id]))

    const toInsertResumes = records.filter(r => !candToResumeId.has(String(emailToCandId.get(r.email))))
    for (let i = 0; i < toInsertResumes.length; i += 1000) {
      const chunk = toInsertResumes.slice(i, i + 1000)
      const res = await client.query(
        `INSERT INTO resumes (candidate_id, current_title, summary, experience_years, source, status, created_at, updated_at)
         SELECT u.cid, u.title, u.summary, u.exp, u.src, u.status,
                CURRENT_TIMESTAMP - (u.days || ' days')::interval,
                CURRENT_TIMESTAMP - (u.days || ' days')::interval
         FROM UNNEST($1::bigint[], $2::text[], $3::text[], $4::numeric[], $5::text[], $6::text[], $7::int[])
           AS u(cid, title, summary, exp, src, status, days)
         RETURNING resume_id, candidate_id`,
        [
          chunk.map(x => emailToCandId.get(x.email)),
          chunk.map(x => x.role),
          chunk.map(x => x.summary),
          chunk.map(x => x.experience),
          chunk.map(x => x.source),
          chunk.map(x => x.status),
          chunk.map(x => x.daysAgo)
        ]
      )
      for (const row of res.rows) candToResumeId.set(String(row.candidate_id), row.resume_id)
    }
    console.log(`  3/4 Inserted ${toInsertResumes.length} new resumes`)

    // 4. Bulk insert resume_skills & education
    const rsResIds = [], rsSkillIds = [], rsProfs = []
    const eduResIds = [], eduInsts = [], eduDegs = [], eduYears = []

    const existingEdu = await client.query('SELECT DISTINCT resume_id FROM education')
    const hasEduSet = new Set(existingEdu.rows.map(r => String(r.resume_id)))

    for (const r of records) {
      const cid = emailToCandId.get(r.email)
      const rid = candToResumeId.get(String(cid))
      if (!rid) continue
      const prof = r.experience >= 6 ? 'Expert' : r.experience >= 3 ? 'Advanced' : 'Intermediate'
      for (const sk of r.skills) {
        const sid = skillMap.get(sk)
        if (sid) {
          rsResIds.push(rid)
          rsSkillIds.push(sid)
          rsProfs.push(prof)
        }
      }
      if (r.education && !hasEduSet.has(String(rid))) {
        hasEduSet.add(String(rid))
        eduResIds.push(rid)
        eduInsts.push(r.education.institution)
        eduDegs.push(r.education.degree)
        eduYears.push(r.education.graduationYear)
      }
    }

    for (let i = 0; i < rsResIds.length; i += 5000) {
      await client.query(
        `INSERT INTO resume_skills (resume_id, skill_id, proficiency)
         SELECT * FROM UNNEST($1::bigint[], $2::bigint[], $3::text[])
         ON CONFLICT (resume_id, skill_id) DO NOTHING`,
        [rsResIds.slice(i, i + 5000), rsSkillIds.slice(i, i + 5000), rsProfs.slice(i, i + 5000)]
      )
    }

    for (let i = 0; i < eduResIds.length; i += 1000) {
      await client.query(
        `INSERT INTO education (resume_id, institution, degree, graduation_year)
         SELECT * FROM UNNEST($1::bigint[], $2::text[], $3::text[], $4::smallint[])`,
        [eduResIds.slice(i, i + 1000), eduInsts.slice(i, i + 1000), eduDegs.slice(i, i + 1000), eduYears.slice(i, i + 1000)]
      )
    }

    await client.query('ALTER TABLE resumes ENABLE TRIGGER trg_resume_insert_audit')
    await client.query('COMMIT')
    await client.query('ANALYZE')

    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM candidates) AS candidates,
        (SELECT COUNT(*) FROM resumes) AS resumes,
        (SELECT COUNT(*) FROM skills) AS skills,
        (SELECT COUNT(*) FROM resume_skills) AS resume_skills,
        (SELECT COUNT(*) FROM education) AS education
    `)
    const secs = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  4/4 Done in ${secs}s! Neon PostgreSQL totals:`, totals.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    try { await client.query('ALTER TABLE resumes ENABLE TRIGGER trg_resume_insert_audit') } catch {}
    console.error('Bulk import failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
