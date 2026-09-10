import type { WatchLaterItem } from '../types'
import { smallPoster } from '../utils/poster'
import './WatchLaterCard.scss'

type Props = {
  item: WatchLaterItem
  onRate: (item: WatchLaterItem) => void
  onDelete: (id: string) => void
  readonly?: boolean
}

export function WatchLaterCard({ item, onRate, onDelete, readonly }: Props) {
  return (
    <div className="watch-card">
      {item.poster && (
        <img
          className="watch-card__poster"
          src={smallPoster(item.poster)}
          alt={`${item.title} poster`}
          width={100}
          height={150}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="watch-card__info">
        <h3 className="watch-card__title">
          {item.title}
          {item.releaseYear && (
            <span className="watch-card__release"> ({item.releaseYear})</span>
          )}
        </h3>
        <span className="watch-card__type">
          {item.type === 'movie' ? 'Movie' : 'Series'} · To watch
        </span>
      </div>

      {!readonly && (
        <div className="watch-card__actions">
          <button
            className="watch-card__rate"
            onClick={() => onRate(item)}
            title="I watched this — rate it"
          >
            ✓ Watched
          </button>
          <button
            className="watch-card__delete"
            onClick={() => onDelete(item.id)}
            title="Remove from watch later"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}