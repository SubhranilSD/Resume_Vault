import pg from 'pg'
import 'dotenv/config'
const { Pool } = pg

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
const isRemote = Boolean(connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'))

export const pool = new Pool(connectionString ? {
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  max: process.env.VERCEL ? 5 : 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
} : {
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.PG_DATABASE || 'resume_vault',
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err.message)
})
