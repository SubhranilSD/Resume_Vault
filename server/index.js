import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import { pool } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', async (_req, res) => {
  const start = performance.now()
  try {
    const { rows } = await pool.query('SELECT current_database() AS database, version() AS version')
    const latencyMs = Math.round((performance.now() - start) * 100) / 100
    res.json({
      status: 'connected',
      database: rows[0].database,
      version: rows[0].version.split(' ').slice(0, 2).join(' '),
      latencyMs,
      poolTotal: pool.totalCount,
      poolIdle: pool.idleCount
    })
  } catch (err) {
    res.status(503).json({
      status: 'offline',
      message: 'Database connection unavailable',
      details: err.message
    })
  }
})

app.get('/api/stats', async (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30))
  try {
    const [summaryRes, skillsRes, sourcesRes, activityRes, statusRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_resumes,
          COUNT(*) FILTER (WHERE status = 'Active')::int AS active_count,
          COUNT(*) FILTER (WHERE status = 'In review')::int AS review_count,
          COUNT(*) FILTER (WHERE status = 'Archived')::int AS archived_count,
          COALESCE(ROUND(AVG(experience_years)::numeric, 1), 0) AS avg_experience,
          (SELECT COUNT(*)::int FROM skills) AS total_skills,
          (SELECT COUNT(*)::int FROM job_openings WHERE status = 'Open') AS open_jobs,
          (SELECT COUNT(*)::int FROM applications) AS total_applications
        FROM resumes
      `),
      pool.query(`
        SELECT s.skill_name AS skill, COUNT(DISTINCT rs.resume_id)::int AS count
        FROM skills s
        JOIN resume_skills rs ON rs.skill_id = s.skill_id
        GROUP BY s.skill_id, s.skill_name
        ORDER BY count DESC, s.skill_name ASC
        LIMIT 12
      `),
      pool.query(`
        SELECT source, COUNT(*)::int AS count,
               ROUND(AVG(experience_years)::numeric, 1) AS avg_exp
        FROM resumes
        GROUP BY source
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT d::date AS day, COUNT(r.resume_id)::int AS additions
        FROM generate_series(
          CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS d
        LEFT JOIN resumes r ON r.created_at::date = d::date
        GROUP BY d::date
        ORDER BY d::date ASC
      `, [days]),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM resumes
        GROUP BY status
        ORDER BY count DESC
      `)
    ])

    res.json({
      summary: summaryRes.rows[0],
      topSkills: skillsRes.rows,
      sources: sourcesRes.rows,
      activity: activityRes.rows,
      statusBreakdown: statusRes.rows
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to load analytics', details: error.message })
  }
})

app.get('/api/resumes', async (req, res) => {
  const search = String(req.query.search || '').trim()
  const status = String(req.query.status || '').trim()
  const skill = String(req.query.skill || '').trim()
  const sort = String(req.query.sort || 'updated_desc')
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10))
  const offset = (page - 1) * limit

  const orderMap = {
    updated_desc: 'r.updated_at DESC, r.resume_id DESC',
    experience_desc: 'r.experience_years DESC, r.updated_at DESC',
    experience_asc: 'r.experience_years ASC, r.updated_at DESC',
    name_asc: 'c.full_name ASC, r.resume_id DESC'
  }
  const orderBy = orderMap[sort] || orderMap.updated_desc

  try {
    const whereClause = `
      WHERE ($1 = '' OR c.full_name ILIKE '%' || $1 || '%'
             OR c.email ILIKE '%' || $1 || '%'
             OR c.location ILIKE '%' || $1 || '%'
             OR r.current_title ILIKE '%' || $1 || '%'
             OR EXISTS (
               SELECT 1 FROM resume_skills rs2
               JOIN skills s2 ON s2.skill_id = rs2.skill_id
               WHERE rs2.resume_id = r.resume_id AND s2.skill_name ILIKE '%' || $1 || '%'
             ))
        AND ($2 = '' OR r.status = $2)
        AND ($3 = '' OR EXISTS (
               SELECT 1 FROM resume_skills rs3
               JOIN skills s3 ON s3.skill_id = rs3.skill_id
               WHERE rs3.resume_id = r.resume_id AND s3.skill_name = $3
             ))
    `

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT r.resume_id)::int AS total
       FROM resumes r
       JOIN candidates c ON c.candidate_id = r.candidate_id
       ${whereClause}`,
      [search, status, skill]
    )

    const { rows } = await pool.query(
      `SELECT r.resume_id AS id, c.candidate_id AS "candidateId", c.full_name AS name,
              c.email, c.phone, c.location, c.linkedin_url AS "linkedinUrl", c.github_url AS "githubUrl",
              r.current_title AS role, r.summary, r.experience_years AS experience,
              r.status, r.source, r.created_at AS "createdAt", r.updated_at AS "updatedAt",
              COALESCE(array_agg(DISTINCT s.skill_name ORDER BY s.skill_name)
                FILTER (WHERE s.skill_name IS NOT NULL), ARRAY[]::text[]) AS skills
       FROM resumes r
       JOIN candidates c ON c.candidate_id = r.candidate_id
       LEFT JOIN resume_skills rs ON rs.resume_id = r.resume_id
       LEFT JOIN skills s ON s.skill_id = rs.skill_id
       ${whereClause}
       GROUP BY r.resume_id, c.candidate_id, c.full_name, c.email, c.phone, c.location,
                c.linkedin_url, c.github_url, r.current_title, r.summary,
                r.experience_years, r.status, r.source, r.created_at, r.updated_at
       ORDER BY ${orderBy}
       LIMIT $4 OFFSET $5`,
      [search, status, skill, limit, offset]
    )

    res.json({
      data: rows,
      total: countResult.rows[0].total,
      page,
      limit
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to retrieve resumes', details: error.message })
  }
})

app.get('/api/resumes/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid resume ID' })
  }
  try {
    const [profileRes, skillsRes, expRes, eduRes, appsRes] = await Promise.all([
      pool.query(`
        SELECT r.resume_id AS id, c.candidate_id AS "candidateId", c.full_name AS name,
               c.email, c.phone, c.location, c.linkedin_url AS "linkedinUrl", c.github_url AS "githubUrl",
               r.current_title AS role, r.summary, r.experience_years AS experience,
               r.status, r.source, r.created_at AS "createdAt", r.updated_at AS "updatedAt"
        FROM resumes r
        JOIN candidates c ON c.candidate_id = r.candidate_id
        WHERE r.resume_id = $1
      `, [id]),
      pool.query(`
        SELECT s.skill_id, s.skill_name AS name, rs.proficiency
        FROM resume_skills rs
        JOIN skills s ON s.skill_id = rs.skill_id
        WHERE rs.resume_id = $1
        ORDER BY s.skill_name
      `, [id]),
      pool.query(`
        SELECT experience_id, company_name AS company, job_title AS title,
               started_on AS "startedOn", ended_on AS "endedOn", description
        FROM work_experience
        WHERE resume_id = $1
        ORDER BY started_on DESC
      `, [id]),
      pool.query(`
        SELECT education_id, institution, degree, field_of_study AS field, graduation_year AS "graduationYear"
        FROM education
        WHERE resume_id = $1
        ORDER BY graduation_year DESC NULLS LAST
      `, [id]),
      pool.query(`
        SELECT a.application_id, a.stage, a.applied_at AS "appliedAt",
               j.job_id, j.title AS "jobTitle", j.department, j.location AS "jobLocation"
        FROM applications a
        JOIN job_openings j ON j.job_id = a.job_id
        WHERE a.resume_id = $1
        ORDER BY a.applied_at DESC
      `, [id])
    ])

    if (!profileRes.rows.length) {
      return res.status(404).json({ error: 'Resume not found' })
    }

    res.json({
      ...profileRes.rows[0],
      skillDetails: skillsRes.rows,
      skills: skillsRes.rows.map(s => s.name),
      workExperience: expRes.rows,
      education: eduRes.rows,
      applications: appsRes.rows
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to fetch resume details', details: error.message })
  }
})

app.post('/api/resumes', async (req, res) => {
  const {
    name, email, phone = '', role, location = '', summary = '',
    experience = 0, skills = [], source = 'Direct upload', status = 'Active',
    linkedinUrl = '', githubUrl = '',
    company = '', jobTitle = '', institution = '', degree = '', graduationYear = null
  } = req.body

  if (!name?.trim() || !email?.trim() || !role?.trim()) {
    return res.status(400).json({ error: 'Name, email and current role are required' })
  }

  let client
  let transactionStarted = false
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    const candidate = await client.query(
      `INSERT INTO candidates (full_name, email, phone, location, linkedin_url, github_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = COALESCE(NULLIF(EXCLUDED.phone, ''), candidates.phone),
         location = EXCLUDED.location,
         linkedin_url = COALESCE(NULLIF(EXCLUDED.linkedin_url, ''), candidates.linkedin_url),
         github_url = COALESCE(NULLIF(EXCLUDED.github_url, ''), candidates.github_url),
         updated_at = CURRENT_TIMESTAMP
       RETURNING candidate_id`,
      [name.trim(), email.trim().toLowerCase(), phone.trim(), location.trim(), linkedinUrl.trim(), githubUrl.trim()]
    )

    const validStatus = ['Active', 'In review', 'Archived'].includes(status) ? status : 'Active'
    const resume = await client.query(
      `INSERT INTO resumes (candidate_id, current_title, summary, experience_years, source, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING resume_id`,
      [candidate.rows[0].candidate_id, role.trim(), summary.trim(), Math.max(0, Number(experience) || 0), source.trim() || 'Direct upload', validStatus]
    )
    const resumeId = resume.rows[0].resume_id

    const uniqueSkills = [...new Set((Array.isArray(skills) ? skills : []).map(v => String(v).trim()).filter(Boolean))]
    for (const label of uniqueSkills) {
      const skill = await client.query(
        `INSERT INTO skills (skill_name) VALUES ($1)
         ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name
         RETURNING skill_id`,
        [label]
      )
      await client.query(
        `INSERT INTO resume_skills (resume_id, skill_id, proficiency)
         VALUES ($1, $2, 'Advanced') ON CONFLICT DO NOTHING`,
        [resumeId, skill.rows[0].skill_id]
      )
    }

    if (company?.trim() && jobTitle?.trim()) {
      await client.query(
        `INSERT INTO work_experience (resume_id, company_name, job_title, started_on, description)
         VALUES ($1, $2, $3, CURRENT_DATE - INTERVAL '2 years', 'Added via ResumeVault intake')`,
        [resumeId, company.trim(), jobTitle.trim()]
      )
    }

    if (institution?.trim() && degree?.trim()) {
      const yr = Number(graduationYear)
      await client.query(
        `INSERT INTO education (resume_id, institution, degree, graduation_year)
         VALUES ($1, $2, $3, $4)`,
        [resumeId, institution.trim(), degree.trim(), yr >= 1950 && yr <= 2035 ? yr : null]
      )
    }

    await client.query('COMMIT')
    transactionStarted = false
    res.status(201).json({ id: resumeId, message: 'Resume saved to PostgreSQL' })
  } catch (error) {
    console.error(error)
    if (client && transactionStarted) {
      try { await client.query('ROLLBACK') } catch (e) { console.error(e) }
    }
    res.status(500).json({ error: 'Unable to save resume', details: error.message })
  } finally {
    if (client) client.release()
  }
})

app.patch('/api/resumes/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid resume ID' })
  }

  const { name, email, phone, location, role, summary, experience, status, source, skills } = req.body
  let client
  let transactionStarted = false
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    const existing = await client.query('SELECT candidate_id FROM resumes WHERE resume_id = $1', [id])
    if (!existing.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Resume not found' })
    }
    const candidateId = existing.rows[0].candidate_id

    if (name !== undefined || email !== undefined || phone !== undefined || location !== undefined) {
      await client.query(
        `UPDATE candidates SET
          full_name = COALESCE($1, full_name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          location = COALESCE($4, location),
          updated_at = CURRENT_TIMESTAMP
         WHERE candidate_id = $5`,
        [name?.trim() || null, email?.trim().toLowerCase() || null, phone?.trim() ?? null, location?.trim() ?? null, candidateId]
      )
    }

    await client.query(
      `UPDATE resumes SET
        current_title = COALESCE($1, current_title),
        summary = COALESCE($2, summary),
        experience_years = COALESCE($3, experience_years),
        status = COALESCE($4, status),
        source = COALESCE($5, source),
        updated_at = CURRENT_TIMESTAMP
       WHERE resume_id = $6`,
      [
        role?.trim() || null,
        summary !== undefined ? summary.trim() : null,
        experience !== undefined ? Math.max(0, Number(experience) || 0) : null,
        ['Active', 'In review', 'Archived'].includes(status) ? status : null,
        source?.trim() || null,
        id
      ]
    )

    if (Array.isArray(skills)) {
      await client.query('DELETE FROM resume_skills WHERE resume_id = $1', [id])
      for (const label of [...new Set(skills.map(v => String(v).trim()).filter(Boolean))]) {
        const skill = await client.query(
          `INSERT INTO skills (skill_name) VALUES ($1)
           ON CONFLICT (skill_name) DO UPDATE SET skill_name = EXCLUDED.skill_name
           RETURNING skill_id`,
          [label]
        )
        await client.query(
          'INSERT INTO resume_skills (resume_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, skill.rows[0].skill_id]
        )
      }
    }

    await client.query('COMMIT')
    transactionStarted = false
    res.json({ id, message: 'Resume updated in PostgreSQL' })
  } catch (error) {
    console.error(error)
    if (client && transactionStarted) {
      try { await client.query('ROLLBACK') } catch (e) { console.error(e) }
    }
    res.status(500).json({ error: 'Unable to update resume', details: error.message })
  } finally {
    if (client) client.release()
  }
})

app.delete('/api/resumes/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid resume ID' })
  }
  try {
    const result = await pool.query('DELETE FROM resumes WHERE resume_id = $1 RETURNING resume_id', [id])
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Resume not found' })
    }
    res.json({ id, message: 'Resume deleted (cascaded child rows & logged to audit_logs)' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to delete resume', details: error.message })
  }
})

// Job Openings & Applications
app.get('/api/jobs', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT j.job_id AS id, j.title, j.department, j.location, j.status, j.created_at AS "createdAt",
             COUNT(a.application_id)::int AS "applicantCount",
             COUNT(a.application_id) FILTER (WHERE a.stage IN ('Interview', 'Offer', 'Hired'))::int AS "activePipeline"
      FROM job_openings j
      LEFT JOIN applications a ON a.job_id = j.job_id
      GROUP BY j.job_id
      ORDER BY j.created_at DESC
    `)
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: 'Unable to load job openings', details: error.message })
  }
})

app.post('/api/jobs', async (req, res) => {
  const { title, department, location = 'Remote', status = 'Open' } = req.body
  if (!title?.trim() || !department?.trim()) {
    return res.status(400).json({ error: 'Title and department are required' })
  }
  try {
    const validStatus = ['Open', 'Paused', 'Closed'].includes(status) ? status : 'Open'
    const { rows } = await pool.query(
      `INSERT INTO job_openings (title, department, location, status)
       VALUES ($1, $2, $3, $4)
       RETURNING job_id AS id, title, department, location, status, created_at AS "createdAt"`,
      [title.trim(), department.trim(), location.trim(), validStatus]
    )
    res.status(201).json({ ...rows[0], applicantCount: 0, activePipeline: 0 })
  } catch (error) {
    res.status(500).json({ error: 'Unable to create job opening', details: error.message })
  }
})

app.patch('/api/jobs/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { status } = req.body
  if (!['Open', 'Paused', 'Closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  try {
    const { rows } = await pool.query(
      'UPDATE job_openings SET status = $1 WHERE job_id = $2 RETURNING job_id AS id, status',
      [status, id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Job not found' })
    res.json(rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Unable to update job', details: error.message })
  }
})

app.get('/api/jobs/:id/applications', async (req, res) => {
  const id = Number(req.params.id)
  try {
    const { rows } = await pool.query(`
      SELECT a.application_id AS id, a.stage, a.applied_at AS "appliedAt",
             r.resume_id AS "resumeId", r.current_title AS role, r.experience_years AS experience,
             c.full_name AS name, c.email, c.location
      FROM applications a
      JOIN resumes r ON r.resume_id = a.resume_id
      JOIN candidates c ON c.candidate_id = r.candidate_id
      WHERE a.job_id = $1
      ORDER BY a.applied_at DESC
    `, [id])
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: 'Unable to load applications', details: error.message })
  }
})

app.post('/api/applications', async (req, res) => {
  const { resumeId, jobId, stage = 'New' } = req.body
  if (!resumeId || !jobId) {
    return res.status(400).json({ error: 'resumeId and jobId are required' })
  }
  try {
    const validStage = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'].includes(stage) ? stage : 'New'
    const { rows } = await pool.query(
      `INSERT INTO applications (resume_id, job_id, stage)
       VALUES ($1, $2, $3)
       ON CONFLICT (resume_id, job_id) DO UPDATE SET stage = EXCLUDED.stage
       RETURNING application_id AS id, resume_id AS "resumeId", job_id AS "jobId", stage, applied_at AS "appliedAt"`,
      [Number(resumeId), Number(jobId), validStage]
    )
    res.status(201).json(rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Unable to create application', details: error.message })
  }
})

app.patch('/api/applications/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { stage } = req.body
  if (!['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'].includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage' })
  }
  try {
    const { rows } = await pool.query(
      'UPDATE applications SET stage = $1 WHERE application_id = $2 RETURNING application_id AS id, stage',
      [stage, id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Application not found' })
    res.json(rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Unable to update application stage', details: error.message })
  }
})

// Schema Explorer & Storage Stats
app.get('/api/schema', async (_req, res) => {
  try {
    const [tablesRes, colsRes, idxRes, sizeRes] = await Promise.all([
      pool.query(`
        SELECT relname AS table_name,
               n_live_tup::int AS row_count,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
               pg_total_relation_size(relid)::bigint AS size_bytes
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY relname
      `),
      pool.query(`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `),
      pool.query(`
        SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `),
      pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
               pg_database_size(current_database())::bigint AS db_bytes
      `)
    ])

    res.json({
      databaseSize: sizeRes.rows[0],
      tables: tablesRes.rows,
      columns: colsRes.rows,
      indexes: idxRes.rows
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to inspect schema', details: error.message })
  }
})

app.get('/api/audit-logs', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT audit_id AS id, table_name AS "tableName", record_id AS "recordId",
             action, changed_at AS "changedAt"
      FROM audit_logs
      ORDER BY changed_at DESC, audit_id DESC
      LIMIT 40
    `)
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: 'Unable to load audit logs', details: error.message })
  }
})

// Safe Read-Only SQL Query Runner
app.post('/api/query/run', async (req, res) => {
  const rawSql = String(req.body.sql || '').trim()
  const explain = Boolean(req.body.explain)
  if (!rawSql) {
    return res.status(400).json({ error: 'SQL query cannot be empty' })
  }

  const normalized = rawSql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim().toLowerCase()
  const forbidden = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy)\b/
  if (forbidden.test(normalized) || !(normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('explain'))) {
    return res.status(400).json({
      error: 'Query Lab executes read-only SELECT / WITH / EXPLAIN queries for safety.'
    })
  }

  const sqlToRun = explain && !normalized.startsWith('explain')
    ? `EXPLAIN ANALYZE ${rawSql.replace(/;+$/, '')}`
    : rawSql

  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN READ ONLY')
    const start = performance.now()
    const result = await client.query(sqlToRun)
    const executionMs = Math.round((performance.now() - start) * 100) / 100
    await client.query('COMMIT')

    res.json({
      columns: result.fields.map(f => f.name),
      rows: result.rows.slice(0, 100),
      rowCount: result.rowCount,
      executionMs
    })
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK') } catch {}
    }
    res.status(400).json({ error: error.message })
  } finally {
    if (client) client.release()
  }
})

app.post('/api/database/analyze', async (_req, res) => {
  try {
    await pool.query('ANALYZE')
    res.json({ message: 'PostgreSQL ANALYZE completed — planner statistics updated' })
  } catch (error) {
    res.status(500).json({ error: 'ANALYZE failed', details: error.message })
  }
})

app.post('/api/database/seed', async (_req, res) => {
  try {
    const seedPath = path.resolve(__dirname, '../database/seed_resumedataset.sql')
    const sql = fs.readFileSync(seedPath, 'utf8')
    await pool.query(sql)
    res.json({ message: 'Resume dataset seeded into PostgreSQL' })
  } catch (error) {
    res.status(500).json({ error: 'Seed failed', details: error.message })
  }
})

// AI Auto-Shortlisting Engine (evaluates all job openings against PostgreSQL resumes)
function inferJobProfile(job) {
  const text = `${job.title} ${job.department}`.toLowerCase()
  const rules = [
    { match: /full[\s-]?stack|web|frontend|react/, skills: ['React', 'TypeScript', 'JavaScript', 'Node.js', 'PostgreSQL', 'HTML', 'CSS'], keywords: ['full-stack', 'fullstack', 'frontend', 'react', 'node', 'web', 'engineer', 'developer'] },
    { match: /machine learning|ml|ai|data scien/, skills: ['Python', 'Machine Learning', 'PyTorch', 'SQL', 'Data Analysis', 'PostgreSQL'], keywords: ['machine learning', 'ml', 'ai', 'data scientist', 'research', 'model', 'analytics'] },
    { match: /design|ux|ui|product design/, skills: ['Figma', 'Design Systems', 'Accessibility', 'Prototyping', 'User Research', 'Adobe Creative Suite'], keywords: ['designer', 'design', 'ux', 'ui', 'research', 'figma', 'prototype'] },
    { match: /cloud|devops|infra|sre|platform|architect/, skills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Linux', 'Azure'], keywords: ['cloud', 'architect', 'devops', 'infrastructure', 'sre', 'platform', 'kubernetes', 'aws'] },
    { match: /dba|database|postgres|sql|data eng/, skills: ['PostgreSQL', 'SQL', 'Linux', 'Oracle', 'Python', 'Snowflake'], keywords: ['database', 'dba', 'postgresql', 'sql', 'data engineer', 'warehouse', 'etl'] },
    { match: /security|cyber|secops|devsecops/, skills: ['Security', 'AWS', 'Kubernetes', 'Linux', 'Compliance', 'Risk Management', 'Networking'], keywords: ['security', 'cyber', 'secops', 'compliance', 'iam', 'risk', 'audit'] },
    { match: /product manager|product/, skills: ['Product Strategy', 'SQL', 'Agile', 'Scrum', 'Project Management', 'Leadership'], keywords: ['product manager', 'product', 'strategy', 'roadmap', 'agile'] },
    { match: /finance|account|audit/, skills: ['Accounting', 'Financial Analysis', 'Budgeting', 'Auditing', 'Excel', 'SAP'], keywords: ['finance', 'accounting', 'accountant', 'audit', 'financial', 'payroll'] },
    { match: /hr|human resource|recruit|talent/, skills: ['HRIS', 'Recruiting', 'Employee Relations', 'Onboarding', 'Training', 'Leadership'], keywords: ['hr', 'human resources', 'recruiter', 'talent', 'people', 'onboarding'] },
    { match: /market|sales|growth/, skills: ['Marketing', 'SEO', 'CRM', 'Salesforce', 'Public Relations', 'Copywriting'], keywords: ['marketing', 'sales', 'brand', 'growth', 'digital', 'crm'] }
  ]

  const matched = rules.filter(r => r.match.test(text))
  const targetSkills = [...new Set(matched.flatMap(r => r.skills))]
  const keywords = [...new Set([
    ...matched.flatMap(r => r.keywords),
    ...text.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !['the', 'and', 'for', 'with'].includes(w))
  ])]

  if (!targetSkills.length) {
    targetSkills.push('SQL', 'Python', 'Project Management', 'Leadership', 'Communication')
  }

  let targetExp = 4
  if (/principal|staff|architect|director/.test(text)) targetExp = 8
  else if (/senior|lead/.test(text)) targetExp = 5
  else if (/junior|intern|entry/.test(text)) targetExp = 1

  return { targetSkills, keywords, targetExp }
}

app.post('/api/ai-shortlist', async (req, res) => {
  const {
    minExperience = 2,
    statusMode = 'active_review', // 'active_only' | 'active_review' | 'all'
    topN = 5,
    customSkills = '',
    sortBy = 'skills_desc', // 'skills_desc' | 'experience_desc' | 'updated_desc'
    jobId = null
  } = req.body || {}

  const minExpNum = Math.max(0, Number(minExperience) || 0)
  const limitPerJob = Math.max(1, Math.min(500, Number(topN) || 5))
  const extraSkills = String(customSkills || '').split(',').map(s => s.trim()).filter(Boolean)

  const start = performance.now()
  try {
    const statusClause =
      statusMode === 'active_only' ? `WHERE r.status = 'Active'`
      : statusMode === 'active_review' ? `WHERE r.status IN ('Active', 'In review')`
      : ''

    const jobFilterClause = jobId ? `WHERE job_id = ${Number(jobId)}` : ''

    const [jobsRes, appsRes, resumesRes] = await Promise.all([
      pool.query(`
        SELECT job_id AS id, title, department, location, status, created_at AS "createdAt"
        FROM job_openings
        ${jobFilterClause}
        ORDER BY CASE status WHEN 'Open' THEN 0 WHEN 'Paused' THEN 1 ELSE 2 END, created_at DESC
      `),
      pool.query(`SELECT job_id, resume_id, stage FROM applications`),
      pool.query(`
        SELECT r.resume_id AS id, c.candidate_id AS "candidateId", c.full_name AS name,
               c.email, c.location, r.current_title AS role, COALESCE(r.summary, '') AS summary,
               r.experience_years AS experience, r.status, r.source, r.updated_at AS "updatedAt",
               COALESCE(
                 json_agg(json_build_object('name', s.skill_name, 'proficiency', rs.proficiency))
                 FILTER (WHERE s.skill_name IS NOT NULL),
                 '[]'::json
               ) AS "skillDetails"
        FROM resumes r
        JOIN candidates c ON c.candidate_id = r.candidate_id
        LEFT JOIN resume_skills rs ON rs.resume_id = r.resume_id
        LEFT JOIN skills s ON s.skill_id = rs.skill_id
        ${statusClause}
        GROUP BY r.resume_id, c.candidate_id, c.full_name, c.email, c.location,
                 r.current_title, r.summary, r.experience_years, r.status, r.source, r.updated_at
      `)
    ])

    const appMap = new Map()
    for (const a of appsRes.rows) {
      appMap.set(`${a.job_id}:${a.resume_id}`, a.stage)
    }

    const candidates = resumesRes.rows
    const results = jobsRes.rows.map(job => {
      const profile = inferJobProfile(job)
      const targetSkills = [...new Set([...profile.targetSkills, ...extraSkills])]
      const targetLower = targetSkills.map(s => s.toLowerCase())
      const extraLower = extraSkills.map(s => s.toLowerCase())

      const matched = []
      for (const cand of candidates) {
        const exp = Number(cand.experience) || 0
        if (exp < minExpNum) continue

        const candSkills = Array.isArray(cand.skillDetails) ? cand.skillDetails : []
        const candSkillNames = candSkills.map(s => s.name)
        const candSkillLower = candSkillNames.map(s => String(s).toLowerCase())

        // If user specified custom required skills, candidate must have at least one of them
        if (extraLower.length && !extraLower.some(es => candSkillLower.includes(es))) continue

        const matchedSkills = candSkillNames.filter(s => targetLower.includes(String(s).toLowerCase()))
        const haystack = `${cand.role} ${cand.summary} ${cand.source}`.toLowerCase()
        const roleHit = profile.keywords.some(kw => haystack.includes(kw))

        if (matchedSkills.length === 0 && !roleHit) continue

        matched.push({
          id: cand.id,
          candidateId: cand.candidateId,
          name: cand.name,
          email: cand.email,
          role: cand.role,
          location: cand.location,
          experience: exp,
          status: cand.status,
          source: cand.source,
          updatedAt: cand.updatedAt,
          skills: candSkillNames,
          matchedSkills,
          pipelineStage: appMap.get(`${job.id}:${cand.id}`) || null
        })
      }

      if (sortBy === 'experience_desc') {
        matched.sort((a, b) => b.experience - a.experience || b.matchedSkills.length - a.matchedSkills.length)
      } else if (sortBy === 'updated_desc') {
        matched.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      } else {
        matched.sort((a, b) => b.matchedSkills.length - a.matchedSkills.length || b.experience - a.experience)
      }

      return {
        job,
        targetSkills,
        totalQualified: matched.length,
        shortlisted: matched.slice(0, limitPerJob)
      }
    })

    const executionMs = Math.round((performance.now() - start) * 100) / 100
    res.json({
      evaluatedResumes: candidates.length,
      executionMs,
      jobs: results
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Shortlisting failed', details: error.message })
  }
})

function effectiveMinExpSafe(v) { return Number(v) || 0 }

app.post('/api/ai-shortlist/apply-batch', async (req, res) => {
  const { assignments } = req.body || {}
  if (!Array.isArray(assignments) || !assignments.length) {
    return res.status(400).json({ error: 'No assignments provided' })
  }
  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    let count = 0
    for (const item of assignments) {
      if (!item.jobId || !item.resumeId) continue
      await client.query(
        `INSERT INTO applications (resume_id, job_id, stage)
         VALUES ($1, $2, 'Screening')
         ON CONFLICT (resume_id, job_id) DO NOTHING`,
        [Number(item.resumeId), Number(item.jobId)]
      )
      count++
    }
    await client.query('COMMIT')
    res.status(201).json({ assigned: count, message: `Added ${count} auto-shortlisted candidate(s) to Screening pipeline` })
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK') } catch {} }
    res.status(500).json({ error: 'Batch assignment failed', details: error.message })
  } finally {
    if (client) client.release()
  }
})

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 4000)
  app.listen(port, () => console.log(`ResumeVault API running on http://localhost:${port}`))
}

export default app
