import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import pg from 'pg'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connStr) {
  console.error('Missing DATABASE_URL. Run: $env:DATABASE_URL="postgresql://..." first.')
  process.exit(1)
}

const isRemote = !connStr.includes('localhost') && !connStr.includes('127.0.0.1')
const pool = new pg.Pool({
  connectionString: connStr,
  ssl: isRemote ? { rejectUnauthorized: false } : false
})

try {
  console.log('1/4 Running database/schema.sql...')
  await pool.query(fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8'))

  console.log('2/4 Running database/seed_resumedataset.sql...')
  await pool.query(fs.readFileSync(path.resolve(__dirname, 'seed_resumedataset.sql'), 'utf8'))
} finally {
  await pool.end()
}

console.log('3/4 Importing ResumeDataset/Resume.csv (2,484 resumes)...')
execFileSync(process.execPath, [path.resolve(__dirname, 'import_resume_dataset.js')], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: connStr }
})

console.log('4/4 Importing ResumeDataset/resumes_dataset.jsonl (3,500 ResumeAtlas 2024 resumes)...')
execFileSync(process.execPath, [path.resolve(__dirname, 'import_resumeatlas.js')], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: connStr }
})

console.log('\nCloud PostgreSQL setup complete! All ~6,024 resumes are now live.')
