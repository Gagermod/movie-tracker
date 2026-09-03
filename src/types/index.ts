export type RatingLevel = 0 | 1 | 2 | 3 | 4

export type Movie = {
  id: string
  title: string
  releaseYear: number | null
  year: number
  rating: RatingLevel
  thoughts: string
  poster?: string
}

export type Episode = {
  name: string
  watched: boolean
}

export type Season = {
  title: string
  rating: RatingLevel
  episodes: Episode[]
}

export type Series = {
  id: string
  title: string
  releaseYear: number | null
  year: number
  thoughts: string
  rating: RatingLevel
  poster?: string
  imdbID?: string
  totalSeasons?: number
  seasons: Season[]
}

export type Entry = Movie & { type: 'movie' }
export type SeriesEntry = Series & { type: 'series' }
