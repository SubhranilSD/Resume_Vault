import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const csvPath = path.resolve(__dirname, '../ResumeDataset/Resume.csv')

const FIRST_NAMES = [
  'Aarav', 'Sophia', 'Liam', 'Olivia', 'Noah', 'Emma', 'Ethan', 'Ava', 'Lucas', 'Mia',
  'Mason', 'Isabella', 'Logan', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Elijah', 'Abigail',
  'Rohan', 'Priya', 'Arjun', 'Ananya', 'Kabir', 'Diya', 'Vikram', 'Neha', 'Siddharth', 'Kavya',
  'Daniel', 'Chloe', 'Matthew', 'Grace', 'Henry', 'Zoe', 'Sebastian', 'Hannah', 'Jack', 'Aria'
]
const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Mehta', 'Kapoor', 'Nair', 'Rao', 'Gupta', 'Malhotra', 'Deshmukh',
  'Chen', 'Wang', 'Kim', 'Park', 'Tanaka', 'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Hernandez',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
  'OConnor', 'Meyer', 'Rossi', 'Dubois', 'Silva', 'Kowalski', 'Novak', 'Jensen', 'Lindqvist', 'Sato'
]

const SKILL_DICTIONARY = [
  'Python', 'SQL', 'PostgreSQL', 'Java', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS',
  'Azure', 'Docker', 'Kubernetes', 'Linux', 'Git', 'Machine Learning', 'Data Analysis', 'Excel',
  'Tableau', 'PowerBI', 'Project Management', 'Agile', 'Scrum', 'Leadership', 'Communication',
  'Accounting', 'Financial Analysis', 'Budgeting', 'Auditing', 'Payroll', 'HRIS', 'Recruiting',
  'Employee Relations', 'Onboarding', 'Training', 'Marketing', 'SEO', 'CRM', 'Salesforce',
  'Customer Service', 'Operations', 'Supply Chain', 'AutoCAD', 'SolidWorks', 'SAP', 'Oracle',
  'C++', 'C#', '.NET', 'HTML', 'CSS', 'Figma', 'Adobe Creative Suite', 'Networking', 'Security',
  'Testing', 'QA', 'Compliance', 'Risk Management', 'Public Relations', 'Copywriting'
]

const LOCATIONS = [
  'New York, NY', 'San Francisco, CA', 'Bengaluru, IN', 'London, UK', 'Austin, TX',
  'Seattle, WA', 'Chicago, IL', 'Mumbai, IN', 'Toronto, CA', 'Gurugram, IN', 'Boston, MA', 'Remote'
]

const STATUSES = ['Active', 'Active', 'Active', 'In review', 'In review', 'Archived']

function parseCsvRows(text) {
  const records = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(field)
      field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length >= 4) records.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field || row.length) {
    row.push(field)
    if (row.length >= 4) records.push(row)
  }
  return records
}

function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function extractTitle(resumeStr, category) {
  const cleaned = resumeStr.replace(/\s+/g, ' ').trim()
  const firstChunk = cleaned.split(/\s{2,}|Summary|Highlights|Experience|Objective|Profile/i)[0].trim()
  if (firstChunk && firstChunk.length >= 4 && firstChunk.length <= 90) {
    return titleCase(firstChunk)
  }
  return titleCase(category.replace(/-/g, ' '))
}

function extractExperience(resumeStr, idNum) {
  const match = resumeStr.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\s+(?:of\s+)?experience/i)
  if (match) {
    const yrs = Number(match[1])
    if (yrs >= 0 && yrs <= 35) return yrs
  }
  return Number((1.5 + (idNum % 12) * 0.5).toFixed(1))
}

function extractSkills(resumeStr, category) {
  const lower = resumeStr.toLowerCase()
  const found = []
  for (const skill of SKILL_DICTIONARY) {
    const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    if (re.test(lower)) {
      found.push(skill)
    }
    if (found.length >= 6) break
  }
  if (found.length === 0) {
    found.push(titleCase(category.replace(/-/g, ' ')))
  }
  return found
}

async function run() {
  if (!fs.existsSync(csvPath)) {
    console.error('ResumeDataset/Resume.csv not found at:', csvPath)
    process.exit(1)
  }

  console.log('Reading ResumeDataset/Resume.csv...')
  const raw = fs.readFileSync(csvPath, 'utf8')
  const rows = parseCsvRows(raw)
  const dataRows = rows.slice(1) // skip header
  console.log(`Parsed ${dataRows.length} resumes from Resume.csv.`)

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

    // Pre-insert all dictionary skills
    const skillIdMap = new Map()
    for (const s of SKILL_DICTIONARY) {
      const res = await client.query(
        'INSERT INTO skills(skill_name) VALUES ($1) ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name RETURNING skill_id',
        [s]
      )
      skillIdMap.set(s, res.rows[0].skill_id)
    }

    let imported = 0
    for (let i = 0; i < dataRows.length; i++) {
      const [idStr, resumeStr = '', , categoryRaw = 'General'] = dataRows[i]
      const idNum = Number(idStr) || (i + 1000)
      const category = categoryRaw.trim() || 'General'

      const firstName = FIRST_NAMES[idNum % FIRST_NAMES.length]
      const lastName = LAST_NAMES[Math.floor(idNum / 7) % LAST_NAMES.length]
      const fullName = `${firstName} ${lastName}`
      const email = `resume.${idStr.trim()}@resumedataset.vault`
      const location = LOCATIONS[idNum % LOCATIONS.length]
      const title = extractTitle(resumeStr, category).slice(0, 135)
      const experience = extractExperience(resumeStr, idNum)
      const summary = resumeStr.replace(/\s+/g, ' ').trim().slice(0, 480)
      const status = STATUSES[idNum % STATUSES.length]
      const daysAgo = idNum % 30
      const skills = extractSkills(resumeStr, category)

      const candRes = await client.query(
        `INSERT INTO candidates (full_name, email, location)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, location = EXCLUDED.location
         RETURNING candidate_id`,
        [fullName, email, location]
      )
      const candidateId = candRes.rows[0].candidate_id

      const existingResume = await client.query(
        'SELECT resume_id FROM resumes WHERE candidate_id = $1 LIMIT 1',
        [candidateId]
      )

      let resumeId
      if (existingResume.rows.length > 0) {
        resumeId = existingResume.rows[0].resume_id
      } else {
        const resInsert = await client.query(
          `INSERT INTO resumes (candidate_id, current_title, summary, experience_years, source, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - ($7 || ' days')::interval, CURRENT_TIMESTAMP - ($7 || ' days')::interval)
           RETURNING resume_id`,
          [candidateId, title, summary, experience, `ResumeDataset · ${category}`, status, String(daysAgo)]
        )
        resumeId = resInsert.rows[0].resume_id
      }

      for (const s of skills) {
        let sId = skillIdMap.get(s)
        if (!sId) {
          const sr = await client.query(
            'INSERT INTO skills(skill_name) VALUES ($1) ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name RETURNING skill_id',
            [s]
          )
          sId = sr.rows[0].skill_id
          skillIdMap.set(s, sId)
        }
        await client.query(
          'INSERT INTO resume_skills (resume_id, skill_id, proficiency) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [resumeId, sId, experience >= 6 ? 'Expert' : experience >= 3 ? 'Advanced' : 'Intermediate']
        )
      }

      imported++
      if (imported % 500 === 0) {
        console.log(`Imported ${imported} / ${dataRows.length} resumes...`)
      }
    }

    await client.query('COMMIT')
    console.log(`Done! Successfully imported ${imported} resumes from ResumeDataset/Resume.csv into PostgreSQL.`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Import failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
