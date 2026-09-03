import { Select, type SelectOption } from './Select'
import './FilterBar.scss'

export type SortOption = 'rating-desc' | 'rating-asc' | 'year-desc' | 'year-asc'

type Props = {
  year: number | null
  onYearChange: (year: number | null) => void
  sort: SortOption
  onSortChange: (sort: SortOption) => void
  years: number[]
}

export function FilterBar({
  year,
  onYearChange,
  sort,
  onSortChange,
  years,
}: Props) {
  const yearOptions: SelectOption[] = [
    { value: 'all', label: 'All years' },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ]

  const sortOptions: SelectOption[] = [
    { value: 'rating-desc', label: 'Rating ↓' },
    { value: 'rating-asc', label: 'Rating ↑' },
    { value: 'year-desc', label: 'Watched year ↓' },
    { value: 'year-asc', label: 'Watched year ↑' },
  ]

  return (
    <div className="filter-bar">
      <div className="filter-bar__group">
        <label className="filter-bar__label">Watched year:</label>
        <Select
          options={yearOptions}
          value={year === null ? 'all' : String(year)}
          onChange={(v) => onYearChange(v === 'all' ? null : Number(v))}
        />
      </div>

      <div className="filter-bar__group">
        <label className="filter-bar__label">Sort:</label>
        <Select
          options={sortOptions}
          value={sort}
          onChange={(v) => onSortChange(v as SortOption)}
        />
      </div>
    </div>
  )
}
