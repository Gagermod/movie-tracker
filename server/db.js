import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import createPostgresDb from './pg-db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db
if (process.env.DATABASE_URL) {
  db = createPostgresDb(process.env.DATABASE_URL)
} else {
  // Lazy import so node:sqlite is never loaded in Postgres deployments.
  const { default: createSqliteDb } = await import('./sqlite-db.js')
  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  db = createSqliteDb(path.join(dataDir, 'tracker.db'))
}

await db.init()

export default db