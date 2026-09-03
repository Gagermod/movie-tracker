import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'tracker.db')
const db = new DatabaseSync(dbPath)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS owners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT NOT NULL UNIQUE,
    fingerprint TEXT UNIQUE,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS movies (
    id TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    release_year INTEGER,
    year INTEGER NOT NULL,
    rating INTEGER NOT NULL DEFAULT 0,
    thoughts TEXT NOT NULL DEFAULT '',
    poster TEXT,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS series (
    id TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    release_year INTEGER,
    year INTEGER NOT NULL,
    thoughts TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 0,
    poster TEXT,
    imdb_id TEXT,
    total_seasons INTEGER,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id, series_id) REFERENCES series(owner_id, id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    watched INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
  );
`)

const seriesCols = db.prepare('PRAGMA table_info(series)').all()
if (!seriesCols.some((c) => c.name === 'rating')) {
  db.exec('ALTER TABLE series ADD COLUMN rating INTEGER NOT NULL DEFAULT 0')
}
if (!seriesCols.some((c) => c.name === 'imdb_id')) {
  db.exec('ALTER TABLE series ADD COLUMN imdb_id TEXT')
}
if (!seriesCols.some((c) => c.name === 'total_seasons')) {
  db.exec('ALTER TABLE series ADD COLUMN total_seasons INTEGER')
}

export default db
