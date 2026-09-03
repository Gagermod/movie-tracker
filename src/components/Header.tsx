import './Header.scss'

type Props = {
  tab: 'movies' | 'series'
  onTabChange: (tab: 'movies' | 'series') => void
}

export function Header({ tab, onTabChange }: Props) {
  return (
    <header className="header">
      <div className="header__brand">MovieTracker</div>
      <nav className="header__nav">
        <button
          className={`header__tab ${tab === 'movies' ? 'active' : ''}`}
          onClick={() => onTabChange('movies')}
        >
          Movies
        </button>
        <button
          className={`header__tab ${tab === 'series' ? 'active' : ''}`}
          onClick={() => onTabChange('series')}
        >
          Series
        </button>
      </nav>
    </header>
  )
}
