import { useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  source: 'demo' | 'musicbrainz' | 'audius'
  onSourceChange: (source: 'demo' | 'musicbrainz' | 'audius') => void
}

export default function SearchBar({ onSearch, source, onSourceChange }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    onSearch(value)
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
  }

  return (
    <div className="search-bar-container">
      <div className="search-source-switch" aria-label="Search source">
        <button type="button" className={source === 'demo' ? 'active' : ''} aria-pressed={source === 'demo'} onClick={() => onSourceChange('demo')}>
          Demo catalog
        </button>
        <button type="button" className={source === 'musicbrainz' ? 'active' : ''} aria-pressed={source === 'musicbrainz'} onClick={() => onSourceChange('musicbrainz')}>
          MusicBrainz
        </button>
        <button type="button" className={source === 'audius' ? 'active' : ''} aria-pressed={source === 'audius'} onClick={() => onSourceChange('audius')}>
          Audius
        </button>
      </div>
      <div className="search-bar">
        <input
          type="text"
          placeholder={source === 'demo' ? 'Search tracks, artists, playlists...' : source === 'musicbrainz' ? 'Search MusicBrainz recordings or artists...' : 'Search Audius tracks or artists...'}
          value={query}
          onChange={handleChange}
          className="search-input"
        />
        <button className="search-button">🔍</button>
        {query && (
          <button className="clear-button" onClick={handleClear}>
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
