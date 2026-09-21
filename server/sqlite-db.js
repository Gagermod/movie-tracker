import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
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
    watched_snapshot TEXT,
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

  CREATE TABLE IF NOT EXISTS watch_later (
    id TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    release_year INTEGER,
    poster TEXT,
    imdb_id TEXT,
    total_seasons INTEGER,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
  );
`

export default function createSqliteDb(dbPath) {
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA)

  // Direct operations run inside the transaction's exclusive slot.
  const txApi = {
    get: (sql, params = []) => db.prepare(sql).get(...params),
    all: (sql, params = []) => db.prepare(sql).all(...params),
    run: (sql, params = []) => {
      const info = db.prepare(sql).run(...params)
      return { lastInsertRowid: Number(info.lastInsertRowid) }
    },
  }

  // Serialize every operation so async handlers can never interleave with an
  // open transaction (single shared connection like the original sync code).
  let chain = Promise.resolve()
  function enqueue(fn) {
    const next = chain.then(fn)
    chain = next.catch(() => {})
    return next
  }

  // Migrate: swap rating values 1 <-> 2 (Dropped/Disliked were swapped)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
  `)
  const migRows = db.prepare('SELECT name FROM migrations').all()
  const applied = new Set(migRows.map((r) => r.name))
  if (!applied.has('swap-rating-1-2')) {
    db.exec(`
      UPDATE movies SET rating = CASE rating WHEN 1 THEN 2 WHEN 2 THEN 1 END WHERE rating IN (1,2);
      UPDATE series SET rating = CASE rating WHEN 1 THEN 2 WHEN 2 THEN 1 END WHERE rating IN (1,2);
      UPDATE seasons SET rating = CASE rating WHEN 1 THEN 2 WHEN 2 THEN 1 END WHERE rating IN (1,2);
      INSERT INTO migrations (name) VALUES ('swap-rating-1-2');
    `)
  }
  if (!applied.has('season-watched-snapshot')) {
    const seasonCols = db.prepare('PRAGMA table_info(seasons)').all()
    const hasSnapshot = seasonCols.some((c) => c.name === 'watched_snapshot')
    if (!hasSnapshot) {
      db.exec('ALTER TABLE seasons ADD COLUMN watched_snapshot TEXT')
    }
    db.exec(
      "INSERT INTO migrations (name) VALUES ('season-watched-snapshot')"
    )
  }

  return {
    kind: 'sqlite',
    init: async () => {},
    exec: (sql) => db.exec(sql),
    get: (sql, params) => enqueue(() => txApi.get(sql, params)),
    all: (sql, params) => enqueue(() => txApi.all(sql, params)),
    run: (sql, params) => enqueue(() => txApi.run(sql, params)),
    transaction: (fn) =>
      enqueue(async () => {
        db.exec('BEGIN')
        try {
          const result = await fn(txApi)
          db.exec('COMMIT')
          return result
        } catch (err) {
          db.exec('ROLLBACK')
          throw err
        }
      }),
  }
}