import pg from 'pg'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS owners (
    id BIGSERIAL PRIMARY KEY,
    share_id TEXT NOT NULL UNIQUE,
    fingerprint TEXT UNIQUE,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS movies (
    id TEXT NOT NULL,
    owner_id BIGINT NOT NULL,
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
    owner_id BIGINT NOT NULL,
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
    id BIGSERIAL PRIMARY KEY,
    series_id TEXT NOT NULL,
    owner_id BIGINT NOT NULL,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 0,
    watched_snapshot TEXT,
    FOREIGN KEY (owner_id, series_id) REFERENCES series(owner_id, id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL,
    idx INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    watched INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS watch_later (
    id TEXT NOT NULL,
    owner_id BIGINT NOT NULL,
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

export default function createPostgresDb(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false },
  })
  pool.on('error', (err) => console.error('Postgres pool error:', err.message))

  function toPg(sql, params = []) {
    let i = 0
    const text = sql.replace(/\?/g, () => `$${++i}`)
    return { text, values: params }
  }

  function makeRun(query) {
    return async (sql, params = []) => {
      const queryConfig = toPg(sql, params)
      if (/^\s*INSERT/i.test(queryConfig.text)) {
        if (!/RETURNING/i.test(queryConfig.text)) queryConfig.text += ' RETURNING id'
        const res = await query(queryConfig)
        return { lastInsertRowid: res.rows[0]?.id }
      }
      const res = await query(queryConfig)
      return { changes: res.rowCount || 0 }
    }
  }

  return {
    kind: 'postgres',
    init: async () => {
      await pool.query(SCHEMA)
      // Migrate: swap rating values 1 <-> 2 (Dropped/Disliked were swapped)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      const migRows = await pool.query('SELECT name FROM migrations')
      const applied = new Set(migRows.rows.map((r) => r.name))
      if (!applied.has('swap-rating-1-2')) {
        await pool.query(`
          UPDATE movies SET rating = CASE rating WHEN 1 THEN 2 WHEN 2 THEN 1 END WHERE rating IN (1,2);
          UPDATE series SET rating = CASE rating WHEN 1 THEN 2 WHEN 2 THEN 1 END WHERE rating IN (1,2);
          UPDATE seasons SET rating = CASE rating WHEN 1 THEN 2 WHEN 2 THEN 1 END WHERE rating IN (1,2);
          INSERT INTO migrations (name) VALUES ('swap-rating-1-2')
        `)
      }
      await pool.query(
        'ALTER TABLE seasons ADD COLUMN IF NOT EXISTS watched_snapshot TEXT'
      )
    },
    exec: async (sql) => {
      await pool.query(sql)
    },
    get: async (sql, params = []) => {
      const res = await pool.query(toPg(sql, params))
      return res.rows[0]
    },
    all: async (sql, params = []) => {
      const res = await pool.query(toPg(sql, params))
      return res.rows
    },
    run: makeRun((q) => pool.query(q)),
    transaction: async (fn) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const tx = {
          get: async (sql, params = []) => {
            const res = await client.query(toPg(sql, params))
            return res.rows[0]
          },
          all: async (sql, params = []) => {
            const res = await client.query(toPg(sql, params))
            return res.rows
          },
          run: makeRun((q) => client.query(q)),
        }
        const result = await fn(tx)
        await client.query('COMMIT')
        return result
      } catch (err) {
        try {
          await client.query('ROLLBACK')
        } catch (_) {}
        throw err
      } finally {
        client.release()
      }
    },
  }
}