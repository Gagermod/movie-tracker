import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import db from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 3001

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return req.socket.remoteAddress || ''
}

function fpOf(req) {
  const fp = req.headers['x-fp']
  return typeof fp === 'string' ? fp.slice(0, 128) : ''
}

async function resolveOwner(req, { create = true } = {}) {
  const fp = fpOf(req)
  if (!fp) return null
  let row = await db.get('SELECT * FROM owners WHERE fingerprint = ?', [fp])
  if (row) {
    const ip = getClientIp(req)
    if (row.ip !== ip) {
      await db.run('UPDATE owners SET ip = ? WHERE id = ?', [ip, row.id])
      row.ip = ip
    }
    return row
  }
  if (!create) return null
  const shareId = crypto.randomBytes(8).toString('hex')
  const info = await db.run(
    'INSERT INTO owners (share_id, fingerprint, ip) VALUES (?, ?, ?)',
    [shareId, fp, getClientIp(req)]
  )
  return db.get('SELECT * FROM owners WHERE id = ?', [Number(info.lastInsertRowid)])
}

async function loadOwnerData(ownerId) {
  const movies = (
    await db.all('SELECT * FROM movies WHERE owner_id = ?', [ownerId])
  ).map((r) => ({
    id: String(r.id),
    title: r.title,
    releaseYear: r.release_year,
    year: r.year,
    rating: r.rating,
    thoughts: r.thoughts,
    poster: r.poster ?? undefined,
  }))

  const series = await Promise.all(
    (
      await db.all('SELECT * FROM series WHERE owner_id = ?', [ownerId])
    ).map(async (r) => ({
      id: String(r.id),
      title: r.title,
      releaseYear: r.release_year,
      year: r.year,
      thoughts: r.thoughts,
      rating: r.rating,
      poster: r.poster ?? undefined,
      imdbID: r.imdb_id ?? undefined,
      totalSeasons: r.total_seasons ?? undefined,
      seasons: (
        await db.all(
          'SELECT * FROM seasons WHERE owner_id = ? AND series_id = ? ORDER BY idx',
          [ownerId, r.id]
        )
      ).map(async (s) => ({
        title: s.title,
        rating: s.rating,
        episodes: (
          await db.all(
            'SELECT * FROM episodes WHERE season_id = ? ORDER BY idx',
            [Number(s.id)]
          )
        ).map((e) => ({ name: e.name, watched: !!e.watched })),
      })),
    }))
  )

  // Flatten one level: seasons arrays inside each series are promises
  for (const s of series) {
    s.seasons = await Promise.all(s.seasons)
  }

  return { movies, series }
}

async function saveOwnerData(ownerId, data) {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM movies WHERE owner_id = ?', [ownerId])
    await tx.run('DELETE FROM series WHERE owner_id = ?', [ownerId])

    for (const m of data.movies || []) {
      await tx.run(
        'INSERT INTO movies (id, owner_id, title, release_year, year, rating, thoughts, poster) VALUES (?,?,?,?,?,?,?,?)',
        [
          String(m.id),
          ownerId,
          m.title,
          m.releaseYear ?? null,
          m.year,
          m.rating ?? 0,
          m.thoughts ?? '',
          m.poster ?? null,
        ]
      )
    }

    for (const s of data.series || []) {
      await tx.run(
        'INSERT INTO series (id, owner_id, title, release_year, year, thoughts, rating, poster, imdb_id, total_seasons) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [
          String(s.id),
          ownerId,
          s.title,
          s.releaseYear ?? null,
          s.year,
          s.thoughts ?? '',
          s.rating ?? 0,
          s.poster ?? null,
          s.imdbID ?? null,
          s.totalSeasons ?? null,
        ]
      )

      for (const [idx, season] of (s.seasons || []).entries()) {
        const seasonInfo = await tx.run(
          'INSERT INTO seasons (series_id, owner_id, idx, title, rating) VALUES (?,?,?,?,?)',
          [String(s.id), ownerId, idx, season.title ?? '', season.rating ?? 0]
        )
        const seasonId = Number(seasonInfo.lastInsertRowid)
        for (const [ei, ep] of (season.episodes || []).entries()) {
          await tx.run(
            'INSERT INTO episodes (season_id, idx, name, watched) VALUES (?,?,?,?)',
            [seasonId, ei, ep.name ?? '', ep.watched ? 1 : 0]
          )
        }
      }
    }
  })
}

// Wrap async handlers so unhandled rejections become 500s instead of crashing.
const h = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: 'internal error' })
  })
}

// --- Identity -------------------------------------------------------------
app.get(
  '/api/identity',
  h(async (req, res) => {
    const owner = await resolveOwner(req)
    if (!owner) return res.status(400).json({ error: 'missing fingerprint' })
    res.json({ ownerId: owner.id, shareUrl: `/share/${owner.share_id}` })
  })
)

// --- Owner data (read/write) ----------------------------------------------
app.get(
  '/api/data',
  h(async (req, res) => {
    const owner = await resolveOwner(req, { create: false })
    if (!owner) return res.status(401).json({ error: 'unauthorized' })
    res.json(await loadOwnerData(owner.id))
  })
)

app.put(
  '/api/data',
  h(async (req, res) => {
    const owner = await resolveOwner(req, { create: false })
    if (!owner) return res.status(401).json({ error: 'unauthorized' })
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'invalid payload' })
    }
    await saveOwnerData(owner.id, data)
    res.json({ ok: true })
  })
)

// --- Public share (read-only) ---------------------------------------------
app.get(
  '/api/share/:shareId',
  h(async (req, res) => {
    const owner = await db.get(
      'SELECT * FROM owners WHERE share_id = ?',
      [req.params.shareId]
    )
    if (!owner) return res.status(404).json({ error: 'not found' })
    res.json({ ...(await loadOwnerData(owner.id)), ownerId: owner.id })
  })
)

// --- Health check (used by uptime monitors) --------------------------------
app.get('/health', (req, res) => res.json({ ok: true }))

// --- Production static serving -------------------------------------------
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  app.get('/', (req, res) => res.send('MovieTracker API is running'))
}

app.listen(PORT, () => {
  console.log(
    `MovieTracker server listening on http://localhost:${PORT} (db: ${db.kind})`
  )
})