import { useEffect, useMemo, useRef, useState } from 'react'
import type { Movie, Series, RatingLevel, WatchLaterItem } from './types'
import { Header } from './components/Header'
import { FilterBar } from './components/FilterBar'
import { MovieCard } from './components/MovieCard'
import { SeriesCard } from './components/SeriesCard'
import { Modal } from './components/Modal'
import { WatchLaterCard } from './components/WatchLaterCard'
import {
  WatchLaterModal,
  type WatchLaterItemData,
} from './components/WatchLaterModal'
import {
  fetchIdentity,
  fetchData,
  saveData,
  fetchShared,
} from './api'
import { fetchSeriesSeasons } from './utils/omdb'
import { loadStoredData, saveDataToStorage } from './storage'
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

  const [storedData] = useState(() => loadStoredData())
  const [tab, setTab] = useState<'movies' | 'series' | 'watchLater'>('movies')
  const [movies, setMovies] = useState<Movie[]>(storedData?.movies ?? [])
  const [series, setSeries] = useState<Series[]>(storedData?.series ?? [])
  const [watchLater, setWatchLater] = useState<WatchLaterItem[]>(
    storedData?.watchLater ?? []
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [ratingItem, setRatingItem] = useState<WatchLaterItem | null>(null)
  const [watchModalOpen, setWatchModalOpen] = useState(false)
  const [watchFilter, setWatchFilter] = useState<'all' | 'movies' | 'series'>(
    'all'
  )
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
          setWatchLater(data.watchLater ?? [])
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
        const stored = storedData
        const hasStored =
          stored && (stored.movies.length > 0 || stored.series.length > 0)
        if (hasStored) {
          setMovies(stored.movies)
          setSeries(stored.series)
          setWatchLater(stored.watchLater ?? [])
          saveData({
            movies: stored.movies,
            series: stored.series,
            watchLater: stored.watchLater ?? [],
          }).catch(() => setOffline(true))
        } else {
          setMovies(data.movies)
          setSeries(data.series)
          setWatchLater(data.watchLater ?? [])
        }
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
  }, [readonly, shareId, storedData])

  const skipFirstSave = useRef(true)

  useEffect(() => {
    if (readonly) return
    saveDataToStorage({ movies, series, watchLater })
  }, [movies, series, watchLater, readonly])

  useEffect(() => {
    if (readonly || !loaded || offline) return
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    const t = setTimeout(() => {
      saveData({ movies, series, watchLater }).catch(() => setOffline(true))
    }, 500)
    return () => clearTimeout(t)
  }, [movies, series, watchLater, loaded, readonly, offline])

  const allYears = useMemo(() => collectYears(movies, series), [movies, series])
  const filteredMovies = useMemo(
    () => sortMovies(movies, yearFilter, sort),
    [movies, yearFilter, sort]
  )
  const filteredSeries = useMemo(
    () => sortSeries(series, yearFilter, sort),
    [series, yearFilter, sort]
  )
  const filteredWatchLater = useMemo(() => {
    if (watchFilter === 'movies') {
      return watchLater.filter((w) => w.type === 'movie')
    }
    if (watchFilter === 'series') {
      return watchLater.filter((w) => w.type === 'series')
    }
    return watchLater
  }, [watchLater, watchFilter])

  const ratedImdbIds = useMemo(() => {
    const ids = new Set<string>()
    series.forEach((s) => {
      if (s.imdbID) ids.add(s.imdbID)
    })
    return ids
  }, [series])

  const ratedKeys = useMemo(() => {
    const keys = new Set<string>()
    movies.forEach((m) =>
      keys.add(`movie:${m.title.trim().toLowerCase()}`)
    )
    series.forEach((s) =>
      keys.add(`series:${s.title.trim().toLowerCase()}`)
    )
    return keys
  }, [movies, series])

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

  const handleAddWatchLater = (data: WatchLaterItemData) => {
    setWatchLater((prev) => {
      if (data.imdbID && prev.some((w) => w.imdbID === data.imdbID)) return prev
      return [{ ...data, id: generateId() }, ...prev]
    })
  }

  const handleRemoveWatchLater = (id: string) => {
    setWatchLater((prev) => prev.filter((w) => w.id !== id))
  }

  const handleRemoveWatchLaterByImdb = (imdbID: string) => {
    setWatchLater((prev) => prev.filter((w) => w.imdbID !== imdbID))
  }

  const handleRateWatchLater = (item: WatchLaterItem) => {
    setRatingItem(item)
    setModalOpen(true)
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
          {tab !== 'watchLater' && (
            <FilterBar
              year={yearFilter}
              onYearChange={setYearFilter}
              sort={sort}
              onSortChange={setSort}
              years={allYears}
            />
          )}
          {tab === 'watchLater' && (
            <div className="app__watch-filter">
              <button
                className={`app__watch-filter-btn ${
                  watchFilter === 'all' ? 'active' : ''
                }`}
                onClick={() => setWatchFilter('all')}
              >
                All
              </button>
              <button
                className={`app__watch-filter-btn ${
                  watchFilter === 'movies' ? 'active' : ''
                }`}
                onClick={() => setWatchFilter('movies')}
              >
                Movies
              </button>
              <button
                className={`app__watch-filter-btn ${
                  watchFilter === 'series' ? 'active' : ''
                }`}
                onClick={() => setWatchFilter('series')}
              >
                Series
              </button>
            </div>
          )}
          {!readonly && tab !== 'watchLater' && (
            <button className="app__add-btn" onClick={() => setModalOpen(true)}>
              + Add
            </button>
          )}
          {!readonly && tab === 'watchLater' && (
            <button
              className="app__add-btn"
              onClick={() => setWatchModalOpen(true)}
            >
              + Watch later
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
            Backend unreachable — your changes are kept on this device.
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
            : tab === 'series'
              ? filteredSeries.map((s) => (
                  <SeriesCard
                    key={s.id}
                    series={s}
                    readonly={readonly}
                    onUpdate={handleUpdateSeries}
                    onDelete={handleDeleteSeries}
                    loading={seriesLoading.has(s.id)}
                  />
                ))
              : filteredWatchLater.map((item) => (
                  <WatchLaterCard
                    key={item.id}
                    item={item}
                    readonly={readonly}
                    onRate={handleRateWatchLater}
                    onDelete={handleRemoveWatchLater}
                  />
                ))}
        </div>

        {readonly &&
          !(
            (tab === 'movies' && filteredMovies.length === 0) ||
            (tab === 'series' && filteredSeries.length === 0) ||
            (tab === 'watchLater' && filteredWatchLater.length === 0)
          ) && (
            <div className="app__own-tracker-wrap">
              <a className="app__own-tracker" href="/">
                Open my tracker
              </a>
            </div>
          )}

        {tab === 'movies' && filteredMovies.length === 0 && (
          <div className="app__empty">
            {readonly ? (
              <>
                No movies in this tracker.{' '}
                <a href="/" className="app__empty-link">
                  Go to your tracker instead
                </a>
              </>
            ) : (
              'No movies yet'
            )}
          </div>
        )}
        {tab === 'series' && filteredSeries.length === 0 && (
          <div className="app__empty">
            {readonly ? (
              <>
                No series in this tracker.{' '}
                <a href="/" className="app__empty-link">
                  Go to your tracker instead
                </a>
              </>
            ) : (
              'No series yet'
            )}
          </div>
        )}
        {tab === 'watchLater' && filteredWatchLater.length === 0 && (
          <div className="app__empty">
            {watchLater.length === 0
              ? readonly
                ? (
                    <>
                      Nothing in the watch later list.{' '}
                      <a href="/" className="app__empty-link">
                        Go to your tracker instead
                      </a>
                    </>
                  )
                : 'No movies or series in your watch later list yet'
              : 'Nothing here.'}
          </div>
        )}

        {!readonly && modalOpen && (
          <Modal
            key={ratingItem?.id ?? 'add'}
            type={ratingItem ? ratingItem.type : tab === 'movies' ? 'movie' : 'series'}
            initial={
              ratingItem
                ? {
                    title: ratingItem.title,
                    releaseYear: ratingItem.releaseYear,
                    poster: ratingItem.poster,
                    imdbID: ratingItem.imdbID,
                    totalSeasons: ratingItem.totalSeasons,
                  }
                : undefined
            }
            existingImdbIds={ratedImdbIds}
            existingKeys={ratedKeys}
            onClose={() => {
              setModalOpen(false)
              setRatingItem(null)
            }}
            onAdd={(data) => {
              if (ratingItem) handleRemoveWatchLater(ratingItem.id)
              if (data.type === 'series') handleAddSeries(data)
              else handleAddMovie(data)
              setRatingItem(null)
            }}
          />
        )}

        {!readonly && watchModalOpen && (
          <WatchLaterModal
            onClose={() => setWatchModalOpen(false)}
            onAdd={handleAddWatchLater}
            onRemove={handleRemoveWatchLaterByImdb}
            existingIds={new Set(
              watchLater.map((w) => w.imdbID).filter((x): x is string => Boolean(x))
            )}
            ratedImdbIds={ratedImdbIds}
            ratedKeys={ratedKeys}
          />
        )}
      </main>
    </div>
  )
}

export default App
