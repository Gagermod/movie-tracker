import { useEffect, useRef, useState } from 'react'
import type { RatingLevel } from '../types'
import { Rating } from './Rating'
import { Select } from './Select'
import { searchOmdb, fetchOmdbDetail, type OmdbSearchItem } from '../utils/omdb'
import './Modal.scss'

type Props = {
  type: 'movie' | 'series'
  onClose: () => void
  onAdd: (data: {
    type: 'movie' | 'series'
    title: string
    releaseYear: number | null
    year: number
    rating: RatingLevel
    thoughts: string
    poster?: string
    imdbID?: string
    totalSeasons?: number
  }) => void
  initial?: {
    title: string
    releaseYear: number | null
    poster?: string
    imdbID?: string
    totalSeasons?: number
  }
  existingImdbIds?: Set<string>
  existingKeys?: Set<string>
}

export function Modal({ type, onClose, onAdd, initial, existingImdbIds, existingKeys }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [releaseYear, setReleaseYear] = useState<number | null>(
    initial?.releaseYear ?? null
  )
  const [year, setYear] = useState(new Date().getFullYear())
  const [rating, setRating] = useState<RatingLevel>(0)
  const [thoughts, setThoughts] = useState('')
  const [poster, setPoster] = useState<string | undefined>(initial?.poster)
  const [imdbID, setImdbID] = useState<string | undefined>(initial?.imdbID)
  const [totalSeasons, setTotalSeasons] = useState<number | undefined>(
    initial?.totalSeasons
  )

  const [results, setResults] = useState<OmdbSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSearchOnMount = useRef(Boolean(initial))

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
    if (skipSearchOnMount.current) {
      skipSearchOnMount.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = title.trim()
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) {
        setResults([])
        setSearching(false)
        return
      }
      setSearching(true)
      const items = await searchOmdb(q, type)
      setResults(items)
      setSearching(false)
    }, q.length < 2 ? 0 : 400)
  }, [title, type])

  const handleSelect = async (item: OmdbSearchItem) => {
    setTitle(item.Title)
    setPoster(item.Poster !== 'N/A' ? item.Poster : undefined)
    setShowResults(false)
    setResults([])

    const detail = await fetchOmdbDetail(item.imdbID)
    if (detail) {
      const relYear = parseInt(detail.Year.slice(0, 4), 10)
      if (!Number.isNaN(relYear)) setReleaseYear(relYear)
      if (detail.Poster && detail.Poster !== 'N/A') setPoster(detail.Poster)
      setImdbID(detail.imdbID)
      if (detail.totalSeasons) {
        setTotalSeasons(parseInt(detail.totalSeasons, 10))
      }
    }
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    if (isAdded(title)) return
    onAdd({
      type,
      title: title.trim(),
      releaseYear,
      year,
      rating,
      thoughts,
      poster,
      imdbID,
      totalSeasons,
    })
    onClose()
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 85 }, (_, i) => currentYear - i)

  const isAdded = (value: string): boolean => {
    const titleKey = `${type}:${value.trim().toLowerCase()}`
    return Boolean(
      existingImdbIds?.has(value) || existingKeys?.has(titleKey)
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            {initial
              ? type === 'movie'
                ? 'Rate Movie'
                : 'Rate Series'
              : type === 'movie'
                ? 'Add Movie'
                : 'Add Series'}
          </h2>
          <button className="modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal__body">
          <div className="modal__field">
            <label className="modal__label">
              Title <span className="modal__hint">(search OMDb)</span>
            </label>
            <div className="modal__search">
              <input
                className="modal__input"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setPoster(undefined)
                  setImdbID(undefined)
                  setTotalSeasons(undefined)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
                placeholder={type === 'movie' ? 'e.g. Interstellar' : 'e.g. Lost'}
                autoFocus
              />
              {searching && <span className="modal__spinner" />}

              {showResults && results.length > 0 && (
                <div className="modal__results">
                  {results.map((item) => {
                    const added = isAdded(item.imdbID)
                    return (
                      <button
                        key={item.imdbID}
                        className={`modal__result ${
                          added ? 'modal__result--rated' : ''
                        }`}
                        onClick={() => handleSelect(item)}
                        disabled={added}
                      >
                        {item.Poster !== 'N/A' && (
                          <img
                            className="modal__result-poster"
                            src={item.Poster}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <span className="modal__result-text">
                          <span className="modal__result-title">
                            {item.Title}
                          </span>
                          <span className="modal__result-year">{item.Year}</span>
                        </span>
                        {added && (
                          <span className="modal__result-status">
                            ✓ Added
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {poster && (
            <div className="modal__poster-wrap">
              <img className="modal__poster" src={poster} alt={title} />
            </div>
          )}

          <div className="modal__field">
            <label className="modal__label">Year watched</label>
            <Select
              className="modal__select"
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
            />
          </div>

          <div className="modal__field">
            <label className="modal__label">Overall rating</label>
            <div className="modal__rating">
              <Rating value={rating} onChange={setRating} />
            </div>
            <div className="modal__rating-hints">
                <span>
                  <i className="modal__dot modal__dot--red filled" />
                  <i className="modal__dot modal__dot--red filled" />
                  Dropped
                </span>
                <span>
                  <i className="modal__dot modal__dot--red filled" />
                  Finished, disliked
                </span>
                <i className="modal__hint-divider" />
                <span>
                  <i className="modal__dot modal__dot--green filled" />
                  Liked
                </span>
                <span>
                  <i className="modal__dot modal__dot--green filled" />
                  <i className="modal__dot modal__dot--green filled" />
                  Would rewatch
                </span>
              </div>
            </div>

          <div className="modal__field">
            <label className="modal__label">Thoughts</label>
            <textarea
              className="modal__textarea"
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              placeholder="What did you think about it?"
              rows={3}
            />
          </div>
        </div>

        <div className="modal__footer">
          <button className="modal__btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal__btn-submit"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
