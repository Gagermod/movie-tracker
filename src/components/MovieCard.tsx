import { useState } from 'react'
import type { Movie } from '../types'
import { Rating } from './Rating'
import { smallPoster } from '../utils/poster'
import './MovieCard.scss'

type Props = {
  movie: Movie
  onUpdate: (movie: Movie) => void
  onDelete: (id: string) => void
  readonly?: boolean
  priority?: boolean
}

export function MovieCard({ movie, onUpdate, onDelete, readonly, priority }: Props) {
  const [editing, setEditing] = useState(false)
  const [thoughts, setThoughts] = useState(movie.thoughts)

  const handleSaveThoughts = () => {
    onUpdate({ ...movie, thoughts })
    setEditing(false)
  }

  return (
    <div className="movie-card">
      {movie.poster && (
        <img
          className="movie-card__poster"
          src={smallPoster(movie.poster)}
          alt={`${movie.title} poster`}
          width={100}
          height={150}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          {...(priority ? { fetchPriority: 'high' as const } : {})}
        />
      )}
      <div className="movie-card__head">
        <div className="movie-card__info">
          <h3 className="movie-card__title">
            {movie.title}
            {movie.releaseYear && (
              <span className="movie-card__release"> ({movie.releaseYear})</span>
            )}
          </h3>
          <span className="movie-card__year">Watched in {movie.year}</span>
        </div>

        <div className="movie-card__rating">
          <Rating
            value={movie.rating}
            readonly={readonly}
            onChange={(rating) => onUpdate({ ...movie, rating })}
          />
        </div>
      </div>

      <div className="movie-card__thoughts">
        {readonly ? (
          <div className="movie-card__thoughts-view movie-card__thoughts-view--static">
            {movie.thoughts || 'No thoughts.'}
          </div>
        ) : editing ? (
          <div className="movie-card__thoughts-edit">
            <textarea
              className="movie-card__textarea"
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              placeholder="Your thoughts on this movie..."
              rows={3}
            />
            <div className="movie-card__thoughts-actions">
              <button
                className="movie-card__btn-save"
                onClick={handleSaveThoughts}
              >
                Save
              </button>
              <button
                className="movie-card__btn-cancel"
                onClick={() => {
                  setThoughts(movie.thoughts)
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="movie-card__thoughts-view"
            onClick={() => setEditing(true)}
          >
            {movie.thoughts || 'Click to add your thoughts...'}
          </div>
        )}
      </div>

      {!readonly && (
        <button
          className="movie-card__delete"
          onClick={() => onDelete(movie.id)}
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  )
}
