export const queryPresets = [
  {
    n: '01',
    title: 'Multi-table skill search (3NF JOIN)',
    tag: 'JOIN · FILTER',
    desc: 'Find candidates possessing PostgreSQL or Python skills across normalized tables.',
    sql: `SELECT c.full_name, r.current_title, r.experience_years, s.skill_name, rs.proficiency
FROM candidates c
JOIN resumes r ON r.candidate_id = c.candidate_id
JOIN resume_skills rs ON rs.resume_id = r.resume_id
JOIN skills s ON s.skill_id = rs.skill_id
WHERE s.skill_name IN ('PostgreSQL', 'Python')
ORDER BY r.experience_years DESC, c.full_name ASC;`,
    result: 'Normalized M:N join'
  },
  {
    n: '02',
    title: 'Top in-demand skills (v_skill_demand)',
    tag: 'AGGREGATION',
    desc: 'Count distinct resumes per canonical skill using GROUP BY.',
    sql: `SELECT s.skill_name,
       COUNT(DISTINCT rs.resume_id) AS profile_count,
       COUNT(*) FILTER (WHERE rs.proficiency = 'Expert') AS expert_count
FROM skills s
LEFT JOIN resume_skills rs ON rs.skill_id = s.skill_id
GROUP BY s.skill_id, s.skill_name
ORDER BY profile_count DESC, expert_count DESC
LIMIT 10;`,
    result: 'Top 10 skills'
  },
  {
    n: '03',
    title: 'Experience ranking (Window Function)',
    tag: 'WINDOW · DENSE_RANK',
    desc: 'Rank candidates within each resume status bucket by years of experience.',
    sql: `SELECT c.full_name, r.current_title, r.status, r.experience_years,
       DENSE_RANK() OVER (PARTITION BY r.status ORDER BY r.experience_years DESC) AS rank_in_status
FROM resumes r
JOIN candidates c ON c.candidate_id = r.candidate_id
ORDER BY r.status, rank_in_status
LIMIT 15;`,
    result: 'Window partition ranking'
  },
  {
    n: '04',
    title: 'Hiring pipeline funnel (CTE)',
    tag: 'CTE · LEFT JOIN',
    desc: 'Summarize open roles and active candidate applications by stage.',
    sql: `WITH job_stats AS (
  SELECT j.job_id, j.title, j.department, j.status,
         COUNT(a.application_id) AS total_applicants,
         COUNT(a.application_id) FILTER (WHERE a.stage IN ('Interview','Offer','Hired')) AS advanced_stage
  FROM job_openings j
  LEFT JOIN applications a ON a.job_id = j.job_id
  GROUP BY j.job_id, j.title, j.department, j.status
)
SELECT * FROM job_stats ORDER BY total_applicants DESC;`,
    result: 'Pipeline conversion'
  },
  {
    n: '05',
    title: 'Source effectiveness breakdown',
    tag: 'GROUP BY · AVG',
    desc: 'Analyze which recruiting channels bring the most experienced talent.',
    sql: `SELECT source,
       COUNT(*) AS total_resumes,
       ROUND(AVG(experience_years), 1) AS avg_experience,
       COUNT(*) FILTER (WHERE status = 'Active') AS active_profiles
FROM resumes
GROUP BY source
ORDER BY total_resumes DESC;`,
    result: 'Channel analytics'
  },
  {
    n: '06',
    title: 'Recent trigger audit trail',
    tag: 'TRIGGERS · AUDIT',
    desc: 'Inspect automated INSERT, UPDATE, and DELETE events captured by triggers.',
    sql: `SELECT audit_id, table_name, record_id, action, changed_at
FROM audit_logs
ORDER BY changed_at DESC, audit_id DESC
LIMIT 20;`,
    result: 'Trigger audit log'
  }
]

export const sampleProfiles = [
  {
    name: 'Kiran Deshmukh',
    email: 'kiran.deshmukh@example.com',
    phone: '+91 98220 12345',
    role: 'Senior Data Engineer',
    location: 'Pune, IN',
    experience: '6.5',
    skills: 'PostgreSQL, Python, Airflow, Snowflake, dbt',
    source: 'Referral',
    status: 'Active',
    summary: 'Data engineer specializing in scalable warehouse modeling, CDC pipelines, and query optimization.',
    company: 'Flipkart',
    jobTitle: 'Data Engineer II',
    institution: 'COEP Pune',
    degree: 'B.Tech Computer Engineering',
    graduationYear: '2019'
  },
  {
    name: 'Claire Vance',
    email: 'claire.vance@example.com',
    phone: '+1 415 555 0199',
    role: 'Staff Frontend Architect',
    location: 'San Francisco, CA',
    experience: '8.0',
    skills: 'React, TypeScript, Next.js, Design Systems, Accessibility',
    source: 'LinkedIn',
    status: 'In review',
    summary: 'Frontend architect focused on high-density B2B interfaces, sub-100ms interactions, and accessible component libraries.',
    company: 'Vercel',
    jobTitle: 'Senior UI Engineer',
    institution: 'University of Michigan',
    degree: 'B.S. Computer Science',
    graduationYear: '2017'
  }
]

export const avatarColors = ['teal', 'blue', 'clay', 'moss', 'plum', 'slate']
export const chartColors = ['#0f766e', '#b45309', '#1d4ed8', '#be185d', '#6d28d9', '#15803d', '#0369a1', '#c2410c']
