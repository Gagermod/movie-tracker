import { useState } from 'react'
import type { Series, Season, RatingLevel } from '../types'
import { Rating } from './Rating'
import { smallPoster } from '../utils/poster'
import { fetchEpisodeTitle, fetchSeason } from '../utils/omdb'
import './SeriesCard.scss'

type Props = {
  series: Series
  onUpdate: (series: Series) => void
  onDelete: (id: string) => void
  loading?: boolean
  readonly?: boolean
}

export function SeriesCard({
  series,
  onUpdate,
  onDelete,
  loading,
  readonly,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingThoughts, setEditingThoughts] = useState(false)
  const [thoughts, setThoughts] = useState(series.thoughts)
  const [addingEpisode, setAddingEpisode] = useState<string | null>(null)
  const [addingSeason, setAddingSeason] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const notify = (text: string) => {
    setMessage(text)
    window.setTimeout(() => {
      setMessage((cur) => (cur === text ? null : cur))
    }, 4000)
  }

  const toggleEpisode = (seasonIdx: number, episodeIdx: number) => {
    const updated = { ...series }
    updated.seasons = [...updated.seasons]
    updated.seasons[seasonIdx] = {
      ...updated.seasons[seasonIdx],
      episodes: [...updated.seasons[seasonIdx].episodes],
    }
    updated.seasons[seasonIdx].episodes[episodeIdx] = {
      ...updated.seasons[seasonIdx].episodes[episodeIdx],
      watched: !updated.seasons[seasonIdx].episodes[episodeIdx].watched,
    }
    onUpdate(updated)
  }

  const setSeasonRating = (seasonIdx: number, rating: RatingLevel) => {
    const updated = { ...series }
    updated.seasons = [...updated.seasons]
    updated.seasons[seasonIdx] = {
      ...updated.seasons[seasonIdx],
      rating,
    }
    onUpdate(updated)
  }

  const setOverallRating = (rating: RatingLevel) => {
    onUpdate({ ...series, rating })
  }

  const addEpisode = async (seasonIdx: number) => {
    setAddingEpisode((cur) => (cur ? cur : `season-${seasonIdx}`))
    setMessage(null)
    try {
      const season = series.seasons[seasonIdx]
      const next = season.episodes.length + 1
      let name: string | null = null
      if (series.imdbID) {
        name = await fetchEpisodeTitle(series.imdbID, seasonIdx + 1, next)
      }
      if (!name) {
        notify('No new episode available.')
        return
      }
      const updated = { ...series }
      updated.seasons = [...updated.seasons]
      updated.seasons[seasonIdx] = {
        ...updated.seasons[seasonIdx],
        episodes: [...updated.seasons[seasonIdx].episodes, { name, watched: false }],
      }
      onUpdate(updated)
    } finally {
      setAddingEpisode(null)
    }
  }

  const addSeason = async () => {
    if (addingSeason) return
    if (!series.imdbID) {
      notify('Unable to check for a new season.')
      return
    }
    setAddingSeason(true)
    setMessage(null)
    try {
      const next = series.seasons.length + 1
      const seasonData = await fetchSeason(series.imdbID, next)
      if (!seasonData) {
        notify('No new season available.')
        return
      }
      const updated = { ...series }
      updated.seasons = [
        ...updated.seasons,
        {
          title: seasonData.title,
          rating: 0,
          episodes: seasonData.episodes.map((name) => ({ name, watched: false })),
        },
      ]
      onUpdate(updated)
      setExpanded(`season-${updated.seasons.length - 1}`)
    } finally {
      setAddingSeason(false)
    }
  }

  const getSeasonProgress = (season: Season) => {
    const watched = season.episodes.filter((e) => e.watched).length
    return { watched, total: season.episodes.length }
  }

  const saveThoughts = () => {
    onUpdate({ ...series, thoughts })
    setEditingThoughts(false)
  }

  return (
    <div className="series-card">
      {series.poster && (
        <img
          className="series-card__poster"
          src={smallPoster(series.poster)}
          alt={`${series.title} poster`}
          width={100}
          height={150}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="series-card__head">
        <div className="series-card__info">
          <h3 className="series-card__title">
            {series.title}
            {series.releaseYear && (
              <span className="series-card__release">
                {' '}({series.releaseYear})
              </span>
            )}
          </h3>
          <span className="series-card__year">Watched in {series.year}</span>
        </div>

        <div className="series-card__overall">
          <Rating
            value={series.rating}
            readonly={readonly}
            onChange={setOverallRating}
          />
        </div>
      </div>

      <div className="series-card__thoughts">
        {readonly || !editingThoughts ? (
          <div
            className={`series-card__thoughts-view ${
              readonly ? 'series-card__thoughts-view--static' : ''
            }`}
            onClick={readonly ? undefined : () => setEditingThoughts(true)}
          >
            {series.thoughts ||
              (readonly ? 'No thoughts.' : 'Click to add your thoughts...')}
          </div>
        ) : (
          <div className="series-card__thoughts-edit">
              <textarea
                className="series-card__textarea"
                value={thoughts}
                onChange={(e) => setThoughts(e.target.value)}
                placeholder="Your thoughts on this series..."
                rows={2}
              />
              <div className="series-card__thoughts-actions">
                <button className="series-card__btn-save" onClick={saveThoughts}>
                  Save
                </button>
                <button
                  className="series-card__btn-cancel"
                  onClick={() => {
                    setThoughts(series.thoughts)
                    setEditingThoughts(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="series-card__seasons">
          {loading && (
            <div className="series-card__loading">
              <span className="series-card__spinner" /> Fetching seasons…
            </div>
          )}
          {series.seasons.map((season, sIdx) => {
            const progress = getSeasonProgress(season)
            const isExpanded = expanded === `season-${sIdx}`

            return (
              <div className="season" key={sIdx}>
                <div className="season__head">
                  <button
                    className="season__expand"
                    onClick={() =>
                      setExpanded(isExpanded ? null : `season-${sIdx}`)
                    }
                  >
                    <div className="season__title-row">
                      <span
                        className={`season__arrow ${isExpanded ? 'open' : ''}`}
                      >
                        ▸
                      </span>
                      <span className="season__title">{season.title}</span>
                      <span className="season__progress">
                        {progress.watched}/{progress.total}
                      </span>
                    </div>
                    <div className="season__bar">
                      <div
                        className="season__bar-fill"
                        style={{
                          width: progress.total
                            ? `${(progress.watched / progress.total) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </button>

                  <Rating
                    value={season.rating}
                    readonly={readonly}
                    onChange={(rating) => setSeasonRating(sIdx, rating)}
                  />
                </div>

                {isExpanded && (
                  <div className="season__episodes">
                    {season.episodes.map((ep, eIdx) => (
                      <label className="episode" key={eIdx}>
                        <input
                          type="checkbox"
                          className="episode__check"
                          checked={ep.watched}
                          disabled={readonly}
                          onChange={() => toggleEpisode(sIdx, eIdx)}
                        />
                        <span className="episode__name">{ep.name}</span>
                      </label>
                    ))}
                    {!readonly && (
                      <button
                        className="season__add-episode"
                        disabled={addingEpisode === `season-${sIdx}`}
                        onClick={() => addEpisode(sIdx)}
                      >
                        {addingEpisode === `season-${sIdx}`
                          ? 'Fetching…'
                          : '+ Episode'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!readonly && (
            <button
              className="series-card__add-season"
              disabled={addingSeason}
              onClick={addSeason}
            >
              {addingSeason ? 'Fetching…' : '+ Season'}
            </button>
          )}
          {message && <div className="series-card__message">{message}</div>}
        </div>

      {!readonly && (
        <button
          className="series-card__delete"
          onClick={() => onDelete(series.id)}
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  )
}
