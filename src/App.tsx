import { useEffect, useMemo, useRef, useState } from 'react'
import type { Movie, Series, RatingLevel } from './types'
import { Header } from './components/Header'
import { FilterBar } from './components/FilterBar'
import { MovieCard } from './components/MovieCard'
import { SeriesCard } from './components/SeriesCard'
import { Modal } from './components/Modal'
import {
  fetchIdentity,
  fetchData,
  saveData,
  fetchShared,
} from './api'
import { fetchSeriesSeasons } from './utils/omdb'
import './App.scss'

type SortOption = 'rating-desc' | 'rating-asc' | 'year-desc' | 'year-asc'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function getShareIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/share\/([^/]+)/)
  return m ? m[1] : null
}

function collectYears(movies: Movie[], series: Series[]): number[] {
  const years = new Set<number>()
  movies.forEach((m) => years.add(m.year))
  series.forEach((s) => years.add(s.year))
  return Array.from(years).sort((a, b) => b - a)
}

function sortMovies(
  movies: Movie[],
  yearFilter: number | null,
  sort: SortOption
): Movie[] {
  let result = [...movies]
  if (yearFilter !== null) result = result.filter((m) => m.year === yearFilter)
  result.sort((a, b) => {
    switch (sort) {
      case 'rating-desc':
        return b.rating - a.rating
      case 'rating-asc':
        return a.rating - b.rating
      case 'year-desc':
        return b.year - a.year
      case 'year-asc':
        return a.year - b.year
    }
  })
  return result
}

function sortSeries(
  series: Series[],
  yearFilter: number | null,
  sort: SortOption
): Series[] {
  let result = [...series]
  if (yearFilter !== null) result = result.filter((s) => s.year === yearFilter)
  result.sort((a, b) => {
    switch (sort) {
      case 'rating-desc':
        return b.rating - a.rating
      case 'rating-asc':
        return a.rating - b.rating
      case 'year-desc':
        return b.year - a.year
      case 'year-asc':
        return a.year - b.year
    }
  })
  return result
}

function App() {
  const [shareId] = useState(() => getShareIdFromPath())
  const readonly = shareId !== null

  const [tab, setTab] = useState<'movies' | 'series'>('movies')
  const [movies, setMovies] = useState<Movie[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [seriesLoading, setSeriesLoading] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortOption>('year-desc')

  const [loaded, setLoaded] = useState(false)
  const [offline, setOffline] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  )

  useEffect(() => {
    let cancelled = false

    if (readonly) {
      fetchShared(shareId!)
        .then((data) => {
          if (cancelled) return
          setMovies(data.movies)
          setSeries(data.series)
          setLoadState('ready')
        })
        .catch(() => {
          if (!cancelled) setLoadState('error')
        })
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      try {
        const identity = await fetchIdentity()
        if (cancelled) return
        setShareUrl(`${window.location.origin}${identity.shareUrl}`)
        const data = await fetchData()
        if (cancelled) return
        setMovies(data.movies)
        setSeries(data.series)
      } catch {
        if (cancelled) return
        setOffline(true)
      } finally {
        if (!cancelled) {
          setLoaded(true)
          setLoadState('ready')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [readonly, shareId])

  const skipFirstSave = useRef(true)
  useEffect(() => {
    if (readonly || !loaded || offline) return
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    const t = setTimeout(() => {
      saveData({ movies, series }).catch(() => setOffline(true))
    }, 500)
    return () => clearTimeout(t)
  }, [movies, series, loaded, readonly, offline])

  const allYears = useMemo(() => collectYears(movies, series), [movies, series])
  const filteredMovies = useMemo(
    () => sortMovies(movies, yearFilter, sort),
    [movies, yearFilter, sort]
  )
  const filteredSeries = useMemo(
    () => sortSeries(series, yearFilter, sort),
    [series, yearFilter, sort]
  )

  const handleAddMovie = (data: {
    title: string
    releaseYear: number | null
    year: number
    rating: RatingLevel
    thoughts: string
    poster?: string
  }) => {
    setMovies((prev) => [{ ...data, id: generateId() }, ...prev])
  }

  const handleAddSeries = (data: {
    title: string
    releaseYear: number | null
    year: number
    rating: RatingLevel
    thoughts: string
    poster?: string
    imdbID?: string
    totalSeasons?: number
  }) => {
    const id = generateId()
    const newSeries: Series = {
      id,
      title: data.title,
      releaseYear: data.releaseYear,
      year: data.year,
      thoughts: data.thoughts,
      rating: data.rating,
      poster: data.poster,
      imdbID: data.imdbID,
      totalSeasons: data.totalSeasons,
      seasons: [],
    }
    setSeries((prev) => [newSeries, ...prev])

    if (data.imdbID && data.totalSeasons && data.totalSeasons > 0) {
      setSeriesLoading((prev) => new Set(prev).add(id))
      fetchSeriesSeasons(data.imdbID, data.totalSeasons)
        .then((seasonData) => {
          setSeries((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    seasons: seasonData.map((sd) => ({
                      title: sd.title,
                      rating: 0,
                      episodes: sd.episodes.map((name) => ({ name, watched: false })),
                    })),
                  }
                : s
            )
          )
        })
        .finally(() => {
          setSeriesLoading((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        })
    }
  }

  const handleUpdateMovie = (updated: Movie) => {
    setMovies((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  const handleDeleteMovie = (id: string) => {
    setMovies((prev) => prev.filter((m) => m.id !== id))
  }

  const handleUpdateSeries = (updated: Series) => {
    setSeries((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  const handleDeleteSeries = (id: string) => {
    setSeries((prev) => prev.filter((s) => s.id !== id))
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="app">
        <div className="app__loading">Loading…</div>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="app">
        <div className="app__empty">Shared tracker not found.</div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header tab={tab} onTabChange={setTab} />

      <main className="app__main">
        {readonly && (
          <div className="app__shared-banner">Read-only view</div>
        )}

        <div className="app__toolbar">
          <FilterBar
            year={yearFilter}
            onYearChange={setYearFilter}
            sort={sort}
            onSortChange={setSort}
            years={allYears}
          />
          {!readonly && (
            <button className="app__add-btn" onClick={() => setModalOpen(true)}>
              + Add
            </button>
          )}
        </div>

        {!readonly && shareUrl && (
          <div className="app__share">
            <span className="app__share-label">Share your tracker:</span>
            <input
              className="app__share-input"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
            />
            <button className="app__share-btn" onClick={copyShareLink}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {!readonly && offline && (
          <div className="app__offline">
            Backend unreachable — changes won't be saved.
          </div>
        )}

        <div className="app__list">
          {tab === 'movies'
            ? filteredMovies.map((movie, i) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  readonly={readonly}
                  onUpdate={handleUpdateMovie}
                  onDelete={handleDeleteMovie}
                  priority={i === 0}
                />
              ))
            : filteredSeries.map((s) => (
                <SeriesCard
                  key={s.id}
                  series={s}
                  readonly={readonly}
                  onUpdate={handleUpdateSeries}
                  onDelete={handleDeleteSeries}
                  loading={seriesLoading.has(s.id)}
                />
              ))}
        </div>

        {tab === 'movies' && filteredMovies.length === 0 && (
          <div className="app__empty">
            {readonly ? 'No movies in this tracker.' : 'No movies yet'}
          </div>
        )}
        {tab === 'series' && filteredSeries.length === 0 && (
          <div className="app__empty">
            {readonly ? 'No series in this tracker.' : 'No series yet'}
          </div>
        )}

        {!readonly && modalOpen && (
          <Modal
            type={tab === 'movies' ? 'movie' : 'series'}
            onClose={() => setModalOpen(false)}
            onAdd={tab === 'movies' ? handleAddMovie : handleAddSeries}
          />
        )}
      </main>
    </div>
  )
}

export default App
