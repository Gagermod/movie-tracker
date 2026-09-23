import type { Series } from '../types'
import { fetchSeasonAiredTitles } from './omdb'

const THROTTLE_KEY = 'mt_episode_sync_v4'
const THROTTLE_MS = 24 * 60 * 60 * 1000
const SEASON_DELAY_MS = 300
const PLACEHOLDER_RE = /episode\s*#/i
const SEASON_NUM_RE = /season\s+(\d+)/i

export type SeasonSyncData = {
  seasonNum: number
  names: string[] | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readThrottle(): Record<string, number> {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, number>
  } catch {
    return {}
  }
}

function writeThrottle(map: Record<string, number>): void {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(map))
  } catch {
    // storage unavailable — worst case we sync more often
  }
}

function seasonNumberOf(season: Series['seasons'][number], index: number): number {
  const match = season.title.match(SEASON_NUM_RE)
  return match ? Number(match[1]) : index + 1
}

export function seriesNeedsSync(series: Series): boolean {
  const imdbID = series.imdbID
  if (!imdbID || series.seasons.length === 0) return false
  const last = readThrottle()[imdbID]
  if (last !== undefined && Date.now() - last < THROTTLE_MS) return false
  if (last === undefined) return true
  return series.seasons.some((season) =>
    season.episodes.some((ep) => PLACEHOLDER_RE.test(ep.name))
  )
}

export async function fetchSeasonSyncData(
  series: Series
): Promise<SeasonSyncData[]> {
  const imdbID = series.imdbID
  if (!imdbID) return []

  const firstSync = readThrottle()[imdbID] === undefined

  const seasonNums = new Set<number>()
  series.seasons.forEach((season, index) => {
    const hasPlaceholder = season.episodes.some((ep) =>
      PLACEHOLDER_RE.test(ep.name)
    )
    const isLast = index === series.seasons.length - 1
    if (hasPlaceholder || (isLast && firstSync)) {
      seasonNums.add(seasonNumberOf(season, index))
    }
  })

  const result: SeasonSyncData[] = []
  let first = true
  for (const seasonNum of Array.from(seasonNums).sort((a, b) => a - b)) {
    if (!first) await sleep(SEASON_DELAY_MS)
    first = false
    let names: string[] | null
    try {
      names = await fetchSeasonAiredTitles(imdbID, seasonNum)
    } catch {
      names = null
    }
    result.push({ seasonNum, names })
  }

  if (result.every((item) => item.names !== null)) {
    const throttle = readThrottle()
    throttle[imdbID] = Date.now()
    writeThrottle(throttle)
  }
  return result
}

export function applySeasonSync(
  series: Series,
  fetched: SeasonSyncData[]
): Series {
  let seasons = series.seasons
  let changed = false

  for (const { seasonNum, names } of fetched) {
    if (names === null) continue
    const idx = seasons.findIndex(
      (season, index) => seasonNumberOf(season, index) === seasonNum
    )
    if (idx < 0) continue
    const season = seasons[idx]

    if (names.length === 0) {
      const hasUserData =
        season.rating !== 0 || season.episodes.some((ep) => ep.watched)
      if (hasUserData) continue
      if (!changed) {
        seasons = [...seasons]
        changed = true
      }
      seasons.splice(idx, 1)
      continue
    }

    const episodes = names.slice(0, season.episodes.length).map((name, i) => ({
      name,
      watched: season.episodes[i].watched,
    }))
    const differs =
      episodes.length !== season.episodes.length ||
      episodes.some((ep, i) => ep.name !== season.episodes[i].name)
    if (!differs) continue
    if (!changed) {
      seasons = [...seasons]
      changed = true
    }
    seasons[idx] = { ...season, episodes }
  }

  return changed ? { ...series, seasons } : series
}
