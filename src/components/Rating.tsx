import type { RatingLevel } from '../types'
import './Rating.scss'

type Props = {
  value: RatingLevel
  onChange?: (value: RatingLevel) => void
  readonly?: boolean
}

const labels: Record<RatingLevel, string> = {
  0: 'Not rated',
  1: 'Finished, disliked',
  2: 'Dropped',
  3: 'Liked',
  4: 'Would rewatch',
}

// Dot layout: [red outer][red inner] | [green inner][green outer]
// Red group lit when value is 1 (inner) or 2 (both).
// Green group lit when value is 3 (inner) or 4 (both).
export function Rating({ value, onChange, readonly }: Props) {
  const click = (newValue: RatingLevel) => {
    if (readonly) return
    onChange?.(value === newValue ? 0 : newValue)
  }

  return (
    <div className={`rating ${readonly ? 'rating--readonly' : ''}`}>
      <div className="rating__dots">
        <button
          type="button"
          className={`rating__dot rating__dot--red ${
            value === 2 ? 'filled' : ''
          }`}
          onClick={() => click(2)}
          disabled={readonly}
          title="Dropped"
          aria-label="Dropped"
        />
        <button
          type="button"
          className={`rating__dot rating__dot--red ${
            value === 1 || value === 2 ? 'filled' : ''
          }`}
          onClick={() => click(1)}
          disabled={readonly}
          title="Finished, disliked"
          aria-label="Finished, disliked"
        />
        <span className="rating__divider" />
        <button
          type="button"
          className={`rating__dot rating__dot--green ${
            value === 3 || value === 4 ? 'filled' : ''
          }`}
          onClick={() => click(3)}
          disabled={readonly}
          title="Liked"
          aria-label="Liked"
        />
        <button
          type="button"
          className={`rating__dot rating__dot--green ${
            value === 4 ? 'filled' : ''
          }`}
          onClick={() => click(4)}
          disabled={readonly}
          title="Would rewatch"
          aria-label="Would rewatch"
        />
      </div>
      <span className="rating__label">{labels[value]}</span>
    </div>
  )
}
