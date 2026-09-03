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

// Resolve (and lazily create) the owner identified by fingerprint.
function resolveOwner(req, { create = true } = {}) {
  const fp = fpOf(req)
  if (!fp) return null
  let row = db.prepare('SELECT * FROM owners WHERE fingerprint = ?').get(fp)
  if (row) {
    // refresh ip on activity
    const ip = getClientIp(req)
    if (row.ip !== ip) {
      db.prepare('UPDATE owners SET ip = ? WHERE id = ?').run(ip, row.id)
      row.ip = ip
    }
    return row
  }
  if (!create) return null
  const shareId = crypto.randomBytes(8).toString('hex')
  const info = db
    .prepare('INSERT INTO owners (share_id, fingerprint, ip) VALUES (?, ?, ?)')
    .run(shareId, fp, getClientIp(req))
  return db.prepare('SELECT * FROM owners WHERE id = ?').get(Number(info.lastInsertRowid))
}

function loadOwnerData(ownerId) {
  const movies = db
    .prepare('SELECT * FROM movies WHERE owner_id = ?')
    .all(ownerId)
    .map((r) => ({
      id: String(r.id),
      title: r.title,
      releaseYear: r.release_year,
      year: r.year,
      rating: r.rating,
      thoughts: r.thoughts,
      poster: r.poster ?? undefined,
    }))

  const series = db
    .prepare('SELECT * FROM series WHERE owner_id = ?')
    .all(ownerId)
    .map((r) => ({
      id: String(r.id),
      title: r.title,
      releaseYear: r.release_year,
      year: r.year,
      thoughts: r.thoughts,
      rating: r.rating,
      poster: r.poster ?? undefined,
      imdbID: r.imdb_id ?? undefined,
      totalSeasons: r.total_seasons ?? undefined,
      seasons: db
        .prepare(
          'SELECT * FROM seasons WHERE owner_id = ? AND series_id = ? ORDER BY idx'
        )
        .all(ownerId, r.id)
        .map((s) => ({
          title: s.title,
          rating: s.rating,
          episodes: db
            .prepare('SELECT * FROM episodes WHERE season_id = ? ORDER BY idx')
            .all(Number(s.id))
            .map((e) => ({ name: e.name, watched: !!e.watched })),
        })),
    }))

  return { movies, series }
}

function saveOwnerData(ownerId, data) {
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM movies WHERE owner_id = ?').run(ownerId)
    db.prepare('DELETE FROM series WHERE owner_id = ?').run(ownerId)

    const insMovie = db.prepare(
      'INSERT INTO movies (id, owner_id, title, release_year, year, rating, thoughts, poster) VALUES (?,?,?,?,?,?,?,?)'
    )
    for (const m of data.movies || []) {
      insMovie.run(
        String(m.id),
        ownerId,
        m.title,
        m.releaseYear ?? null,
        m.year,
        m.rating ?? 0,
        m.thoughts ?? '',
        m.poster ?? null
      )
    }

    const insSeries = db.prepare(
      'INSERT INTO series (id, owner_id, title, release_year, year, thoughts, rating, poster, imdb_id, total_seasons) VALUES (?,?,?,?,?,?,?,?,?,?)'
    )
    const insSeason = db.prepare(
      'INSERT INTO seasons (series_id, owner_id, idx, title, rating) VALUES (?,?,?,?,?)'
    )
    const insEpisode = db.prepare(
      'INSERT INTO episodes (season_id, idx, name, watched) VALUES (?,?,?,?)'
    )

    for (const s of data.series || []) {
      insSeries.run(
        String(s.id),
        ownerId,
        s.title,
        s.releaseYear ?? null,
        s.year,
        s.thoughts ?? '',
        s.rating ?? 0,
        s.poster ?? null,
        s.imdbID ?? null,
        s.totalSeasons ?? null
      )
      const seasons = s.seasons || []
      seasons.forEach((season, idx) => {
        const seasonInfo = insSeason.run(String(s.id), ownerId, idx, season.title ?? '', season.rating ?? 0)
        const seasonId = Number(seasonInfo.lastInsertRowid)
        ;(season.episodes || []).forEach((ep, ei) => {
          insEpisode.run(seasonId, ei, ep.name ?? '', ep.watched ? 1 : 0)
        })
      })
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// --- Identity -------------------------------------------------------------
app.get('/api/identity', (req, res) => {
  const owner = resolveOwner(req)
  if (!owner) return res.status(400).json({ error: 'missing fingerprint' })
  res.json({ ownerId: owner.id, shareUrl: `/share/${owner.share_id}` })
})

// --- Owner data (read/write) ----------------------------------------------
app.get('/api/data', (req, res) => {
  const owner = resolveOwner(req, { create: false })
  if (!owner) return res.status(401).json({ error: 'unauthorized' })
  res.json(loadOwnerData(owner.id))
})

app.put('/api/data', (req, res) => {
  const owner = resolveOwner(req, { create: false })
  if (!owner) return res.status(401).json({ error: 'unauthorized' })
  const data = req.body
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'invalid payload' })
  }
  saveOwnerData(owner.id, data)
  res.json({ ok: true })
})

// --- Public share (read-only) ---------------------------------------------
app.get('/api/share/:shareId', (req, res) => {
  const owner = db
    .prepare('SELECT * FROM owners WHERE share_id = ?')
    .get(req.params.shareId)
  if (!owner) return res.status(404).json({ error: 'not found' })
  res.json({ ...loadOwnerData(owner.id), ownerId: owner.id })
})

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
  console.log(`MovieTracker server listening on http://localhost:${PORT}`)
})
