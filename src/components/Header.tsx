import './Header.scss'

export type Tab = 'movies' | 'series' | 'watchLater'

type Props = {
  tab: Tab
  onTabChange: (tab: Tab) => void
}

export function Header({ tab, onTabChange }: Props) {
  return (
    <header className="header">
      <a className="header__brand" href="/" title="Open your tracker">
        MovieTracker
      </a>
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
      <div className="header__watch">
        <button
          className={`header__tab ${tab === 'watchLater' ? 'active' : ''}`}
          onClick={() => onTabChange('watchLater')}
        >
          Watch Later
        </button>
      </div>
    </header>
  )
}
