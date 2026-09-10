import { useEffect, useRef, useState } from 'react'
import { searchOmdb, fetchOmdbDetail, type OmdbSearchItem } from '../utils/omdb'
import './Modal.scss'
import './WatchLaterModal.scss'

export type WatchLaterItemData = {
  title: string
  type: 'movie' | 'series'
  releaseYear: number | null
  poster?: string
  imdbID?: string
  totalSeasons?: number
}

type Props = {
  onClose: () => void
  onAdd: (item: WatchLaterItemData) => void
  onRemove: (imdbID: string) => void
  existingIds: Set<string>
  ratedImdbIds: Set<string>
  ratedKeys: Set<string>
}

export function WatchLaterModal({
  onClose,
  onAdd,
  onRemove,
  existingIds,
  ratedImdbIds,
  ratedKeys,
}: Props) {
  const [kind, setKind] = useState<'movie' | 'series'>('movie')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OmdbSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [addingKey, setAddingKey] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    const original = document.body.style.overflow
    const originalTouch = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = original
      document.body.style.touchAction = originalTouch
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = query.trim()
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) {
        setResults([])
        setSearching(false)
        return
      }
      setSearching(true)
      const items = await searchOmdb(q, kind)
      setResults(items)
      setSearching(false)
    }, q.length < 2 ? 0 : 400)
  }, [query, kind])

  const handleToggle = (item: OmdbSearchItem) => {
    const key = item.imdbID
    if (isRated(item)) return
    if (existingIds.has(key)) {
      onRemove(key)
      return
    }
    setAddingKey(key)
    ;(async () => {
      const detail = await fetchOmdbDetail(item.imdbID)
      const relYear = detail ? parseInt(detail.Year.slice(0, 4), 10) : NaN
      onAdd({
        title: item.Title,
        type: kind,
        releaseYear: Number.isNaN(relYear) ? null : relYear,
        poster: item.Poster !== 'N/A' ? item.Poster : undefined,
        imdbID: item.imdbID,
        totalSeasons: detail?.totalSeasons
          ? parseInt(detail.totalSeasons, 10)
          : undefined,
      })
    })().finally(() => setAddingKey(null))
  }

  const isRated = (item: OmdbSearchItem) => {
    const titleKey = `${kind}:${item.Title.trim().toLowerCase()}`
    return ratedImdbIds.has(item.imdbID) || ratedKeys.has(titleKey)
  }

  const showEmpty =
    query.trim().length >= 2 && !searching && results.length === 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Add to Watch Later</h2>
          <button className="modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="watch-modal__types">
            <button
              className={`watch-modal__type ${
                kind === 'movie' ? 'active' : ''
              }`}
              onClick={() => setKind('movie')}
            >
              Movies
            </button>
            <button
              className={`watch-modal__type ${
                kind === 'series' ? 'active' : ''
              }`}
              onClick={() => setKind('series')}
            >
              Series
            </button>
          </div>

          <div className="watch-modal__search">
            <input
              className="modal__input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                kind === 'movie'
                  ? 'Search movies to watch later'
                  : 'Search series to watch later'
              }
              autoFocus
            />
            {searching && <span className="modal__spinner" />}
          </div>

          <div className="watch-modal__results">
            {results.map((item) => {
              const added = existingIds.has(item.imdbID)
              const adding = addingKey === item.imdbID
              const rated = isRated(item)
              return (
                <button
                  key={item.imdbID}
                  className={`watch-modal__result ${
                    added ? 'watch-modal__result--added' : ''
                  } ${rated ? 'watch-modal__result--rated' : ''}`}
                  onClick={() => handleToggle(item)}
                  disabled={adding || rated}
                >
                  {item.Poster !== 'N/A' && (
                    <img
                      className="watch-modal__poster"
                      src={item.Poster}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span className="watch-modal__result-text">
                    <span className="watch-modal__result-title">
                      {item.Title}
                    </span>
                    <span className="watch-modal__result-year">
                      {item.Year}
                    </span>
                  </span>
                  {adding && <span className="watch-modal__spinner" />}
                  {!adding && rated && (
                    <span className="watch-modal__status">
                      ✓ Already rated
                    </span>
                  )}
                  {!adding && !rated && added && (
                    <span className="watch-modal__check">✓</span>
                  )}
                </button>
              )
            })}
            {showEmpty && (
              <div className="watch-modal__empty">No results found.</div>
            )}
          </div>
        </div>

        <div className="modal__footer">
          <button className="modal__btn-submit" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}