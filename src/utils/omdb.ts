const API_KEY = '7a87ea9f'
const BASE_URL = 'https://www.omdbapi.com'

export type OmdbSearchItem = {
  Title: string
  Year: string
  imdbID: string
  Type: string
  Poster: string
}

export type OmdbSearchResponse = {
  Search?: OmdbSearchItem[]
  Error?: string
  Response: string
}

export type OmdbDetail = {
  Title: string
  Year: string
  Poster: string
  Type: string
  imdbID: string
  totalSeasons?: string
}

export type OmdbDetailResponse = OmdbDetail & {
  Response: string
  Error?: string
}

export type SeriesSeasonData = {
  title: string
  episodes: string[]
}

type OmdbSeasonResponse = {
  Response: string
  Error?: string
  Episodes?: { Title: string; Episode: string }[]
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export async function searchOmdb(query: string, type: 'movie' | 'series'): Promise<OmdbSearchItem[]> {
  const url = `${BASE_URL}/?apikey=${API_KEY}&s=${encodeURIComponent(query)}&type=${type}`
  const data = (await fetchJson<OmdbSearchResponse>(url))
  if (data.Response === 'False' || !data.Search) return []
  return data.Search
}

export async function fetchOmdbDetail(imdbID: string): Promise<OmdbDetailResponse | null> {
  const url = `${BASE_URL}/?apikey=${API_KEY}&i=${imdbID}`
  const data = (await fetchJson<OmdbDetailResponse>(url))
  if (data.Response === 'False') return null
  return data
}

const MAX_SEASONS = 60
const SEASON_DELAY_MS = 300
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchSeasonData(
  imdbID: string,
  seasonNum: number
): Promise<OmdbSeasonResponse | null> {
  const url = `${BASE_URL}/?apikey=${API_KEY}&i=${imdbID}&Season=${seasonNum}`
  let data: OmdbSeasonResponse | null = null
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS)
    try {
      data = await fetchJson<OmdbSeasonResponse>(url)
    } catch {
      data = null
    }
    if (data && data.Response === 'True') break
  }
  return data
}

export async function fetchSeriesSeasons(
  imdbID: string,
  totalSeasons: number
): Promise<SeriesSeasonData[]> {
  const seasons: SeriesSeasonData[] = []
  const limit = Math.min(totalSeasons, MAX_SEASONS)
  for (let n = 1; n <= limit; n++) {
    if (n > 1) await sleep(SEASON_DELAY_MS)
    const data = await fetchSeasonData(imdbID, n)
    if (data && data.Response === 'True' && data.Episodes?.length) {
      seasons.push({
        title: `Season ${n}`,
        episodes: data.Episodes.map((ep) => `${ep.Episode}. ${ep.Title}`),
      })
    } else {
      break
    }
  }
  return seasons
}

export async function fetchSeason(
  imdbID: string,
  seasonNum: number
): Promise<SeriesSeasonData | null> {
  const data = await fetchSeasonData(imdbID, seasonNum)
  if (!data || data.Response !== 'True' || !data.Episodes?.length) return null
  return {
    title: `Season ${seasonNum}`,
    episodes: data.Episodes.map((ep) => `${ep.Episode}. ${ep.Title}`),
  }
}

export async function fetchEpisodeTitle(
  imdbID: string,
  seasonNum: number,
  nextEpisode: number
): Promise<string | null> {
  const data = await fetchSeasonData(imdbID, seasonNum)
  if (!data || data.Response !== 'True' || !data.Episodes) return null
  const idx = data.Episodes.findIndex(
    (ep) => Number(ep.Episode) === nextEpisode
  )
  if (idx >= 0) return `${nextEpisode}. ${data.Episodes[idx].Title}`
  return null
}
