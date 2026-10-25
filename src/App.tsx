import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { Track, Playlist } from './types'
import './App.css'
import SearchBar from './components/SearchBar'
import TrackCard from './components/TrackCard'
import GenreFilter from './components/GenreFilter'
import PlaylistView from './components/PlaylistView'
import PlaylistDetail from './components/PlaylistDetail'
import FeedbackHistory from './components/FeedbackHistory'
import RecommendationEngine from './recommendation'
import type { FeedbackAction, InternalTrack, TrackFeedback } from './recommendation'
import { rankTracks } from './recommendation/ranking'
import { musicBrainzProvider } from './providers/musicbrainz'
import { audiusProvider, type AudiusTrack } from './providers/audius'
import AudiusPlaybackPlayer, { type AudiusPlaybackPlayerHandle } from './components/AudiusPlaybackPlayer'

const mockTracks: Track[] = [
  // Fictional sample tracks; the catalog is intentionally local demo data.
  {
    id: '1',
    title: 'Neon Dreams',
    artist: 'Synthwave Master',
    genre: 'synthwave',
    image: 'https://via.placeholder.com/200?text=Neon+Dreams',
    duration: 240,
    plays: 125000,
    isFavorite: false,
  },
  {
    id: '2',
    title: 'Lo-Fi Beats',
    artist: 'Chill Vibes',
    genre: 'lofi',
    image: 'https://via.placeholder.com/200?text=Lo-Fi+Beats',
    duration: 180,
    plays: 89000,
    isFavorite: false,
  },
  {
    id: '3',
    title: 'Deep House Sessions',
    artist: 'House Collective',
    genre: 'house',
    image: 'https://via.placeholder.com/200?text=Deep+House',
    duration: 360,
    plays: 156000,
    isFavorite: false,
  },
  {
    id: '4',
    title: 'Hip-Hop Cipher',
    artist: 'Rap Kings',
    genre: 'hip-hop',
    image: 'https://via.placeholder.com/200?text=Hip-Hop',
    duration: 200,
    plays: 234000,
    isFavorite: false,
  },
  {
    id: '5',
    title: 'Ambient Meditation',
    artist: 'Zen Sounds',
    genre: 'ambient',
    image: 'https://via.placeholder.com/200?text=Ambient',
    duration: 600,
    plays: 45000,
    isFavorite: false,
  },
  {
    id: '6',
    title: 'Indie Folk Tales',
    artist: 'Acoustic Dreams',
    genre: 'indie',
    image: 'https://via.placeholder.com/200?text=Indie+Folk',
    duration: 220,
    plays: 78000,
    isFavorite: false,
  },
  {
    id: '7',
    title: 'Glass Horizon',
    artist: 'Comet Arcade',
    genre: 'synthwave',
    image: 'https://via.placeholder.com/200?text=Glass+Horizon',
    duration: 226,
    plays: 67000,
    isFavorite: false,
  },
  {
    id: '8',
    title: 'Night Run',
    artist: 'Synthwave Master',
    genre: 'synthwave',
    image: 'https://via.placeholder.com/200?text=Night+Run',
    duration: 248,
    plays: 98000,
    isFavorite: false,
  },
  {
    id: '9',
    title: 'Soft Focus',
    artist: 'Chill Vibes',
    genre: 'lofi',
    image: 'https://via.placeholder.com/200?text=Soft+Focus',
    duration: 194,
    plays: 51000,
    isFavorite: false,
  },
]

const mockPlaylists: Playlist[] = [
  {
    id: 'p1',
    name: 'Late Night Vibes',
    description: 'Perfect for unwinding',
    trackCount: 42,
    image: 'https://via.placeholder.com/200?text=Late+Night',
    tracks: mockTracks.slice(0, 3),
  },
  {
    id: 'p2',
    name: 'Workout Pulse',
    description: 'High energy tracks',
    trackCount: 35,
    image: 'https://via.placeholder.com/200?text=Workout',
    tracks: mockTracks.slice(1, 4),
  },
  {
    id: 'p3',
    name: 'Chill Study Beats',
    description: 'Focus and concentration',
    trackCount: 28,
    image: 'https://via.placeholder.com/200?text=Study',
    tracks: mockTracks.slice(2, 5),
  },
]

function App() {
  const [searchSource, setSearchSource] = useState<'demo' | 'musicbrainz' | 'audius'>('demo')
  const [playlists] = useState<Playlist[]>(mockPlaylists)
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [musicBrainzResults, setMusicBrainzResults] = useState<InternalTrack[]>([])
  const [musicBrainzLoading, setMusicBrainzLoading] = useState(false)
  const [musicBrainzError, setMusicBrainzError] = useState('')
  const [audiusResults, setAudiusResults] = useState<AudiusTrack[]>([])
  const [audiusLoading, setAudiusLoading] = useState(false)
  const [audiusError, setAudiusError] = useState('')
  const [currentAudiusTrackId, setCurrentAudiusTrackId] = useState<string | null>(null)
  const [audiusIsPlaying, setAudiusIsPlaying] = useState(false)
  const [queuedTrackIds, setQueuedTrackIds] = useState<Set<string>>(() => new Set())
  const notifyQueueChange = useCallback((trackIds: string[]) => setQueuedTrackIds(new Set(trackIds)), [])
  const audiusPlayerRef = useRef<AudiusPlaybackPlayerHandle>(null)
  const searchTimeout = useRef<number | null>(null)
  const [activeTab, setActiveTab] = useState<'discover' | 'playlists' | 'favorites' | 'feedback'>('discover')
  const [feedbackByTrack, setFeedbackByTrack] = useState<Record<string, TrackFeedback>>(
    () => RecommendationEngine.getUserTaste().feedbackByTrack,
  )
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const stored = localStorage.getItem('soundcloud_favorites')
      const parsed: unknown = stored ? JSON.parse(stored) : []
      const favoriteIds = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
      return mockTracks
        .filter((track) => favoriteIds.has(track.id))
        .map((track) => ({ ...track, isFavorite: true }))
    } catch {
      return []
    }
  })
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)

  const filteredTracks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return mockTracks.filter((track) => {
      const matchesQuery = !normalizedQuery ||
        track.title.toLowerCase().includes(normalizedQuery) ||
        track.artist.toLowerCase().includes(normalizedQuery)
      const matchesGenre = selectedGenre === 'all' || track.genre === selectedGenre
      return matchesQuery && matchesGenre
    })
  }, [searchQuery, selectedGenre])

  const filteredTrackById = useMemo(
    () => new Map(filteredTracks.map((track) => [track.id, track])),
    [filteredTracks],
  )
  const favoriteIds = useMemo(() => new Set(favorites.map((track) => track.id)), [favorites])

  const rankedAudiusTracks = useMemo(() => rankTracks(audiusResults, 50, {
    ...RecommendationEngine.getUserTaste(),
    feedbackByTrack,
  }), [audiusResults, feedbackByTrack])

  const rankedMusicBrainzTracks = useMemo(() => {
    const candidates = musicBrainzResults.filter((track) => track.artist.trim())
    return rankTracks(candidates, 50, {
      ...RecommendationEngine.getUserTaste(),
      feedbackByTrack,
    })
  }, [feedbackByTrack, musicBrainzResults])

  useEffect(() => {
    return () => {
      if (searchTimeout.current !== null) window.clearTimeout(searchTimeout.current)
    }
  }, [])

  // Keep render pure. Seen history is recorded only after Discover renders.
  const rankedTracks = useMemo(
    () => filteredTracks.length > 0
      ? RecommendationEngine.getRecommendations(filteredTracks, {
          limit: 50,
          taste: { ...RecommendationEngine.getUserTaste(), feedbackByTrack },
        })
      : [],
    [feedbackByTrack, filteredTracks],
  )

  useEffect(() => {
    if (activeTab !== 'discover') return
    const shownIds = searchSource === 'demo'
      ? rankedTracks.map(({ track }) => track.id)
      : searchSource === 'musicbrainz'
        ? rankedMusicBrainzTracks.map(({ track }) => track.id)
        : rankedAudiusTracks.map(({ track }) => track.id)
    RecommendationEngine.recordRecommendationsSeen(shownIds)
  }, [activeTab, rankedAudiusTracks, rankedMusicBrainzTracks, rankedTracks, searchSource])

  useEffect(() => {
    if (searchSource !== 'musicbrainz') return
    const query = searchQuery.trim()
    if (!query) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setMusicBrainzLoading(true)
      setMusicBrainzError('')
      void musicBrainzProvider.search(query, controller.signal).then((results) => {
        if (!controller.signal.aborted) setMusicBrainzResults(results)
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMusicBrainzResults([])
        setMusicBrainzError(error instanceof Error ? error.message : 'MusicBrainz search failed. Please try again.')
      }).finally(() => {
        if (!controller.signal.aborted) setMusicBrainzLoading(false)
      })
    }, 500)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [searchQuery, searchSource])

  useEffect(() => {
    if (searchSource !== 'audius') return
    const query = searchQuery.trim()
    if (!query) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void audiusProvider.search(query, controller.signal).then((results) => {
        if (!controller.signal.aborted) setAudiusResults(results)
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return
        setAudiusResults([])
        setAudiusError(error instanceof Error ? error.message : 'Audius search failed. Please try again.')
      }).finally(() => {
        if (!controller.signal.aborted) setAudiusLoading(false)
      })
    }, 500)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [searchQuery, searchSource])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current !== null) window.clearTimeout(searchTimeout.current)
    if (searchSource === 'musicbrainz' || searchSource === 'audius') {
      setIsLoading(false)
      if (!query.trim()) {
        setMusicBrainzResults([])
        setMusicBrainzLoading(false)
        setMusicBrainzError('')
        setAudiusResults([])
        setAudiusLoading(false)
        setAudiusError('')
      } else if (searchSource === 'musicbrainz') {
        setMusicBrainzLoading(true)
      } else {
        setAudiusResults([])
        setAudiusError('')
        setAudiusLoading(true)
      }
      return
    }
    if (!query.trim()) {
      searchTimeout.current = null
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    searchTimeout.current = window.setTimeout(() => {
      searchTimeout.current = null
      setIsLoading(false)
    }, 500)
  }

  const handleSearchSourceChange = (source: 'demo' | 'musicbrainz' | 'audius') => {
    setSearchSource(source)
    setSelectedGenre('all')
    setIsLoading(false)
    if (source !== 'musicbrainz') {
      setMusicBrainzLoading(false)
      setMusicBrainzError('')
    }
    if (source !== 'audius') {
      setAudiusLoading(false)
      setAudiusError('')
    }
    if (source === 'musicbrainz' && searchQuery.trim()) setMusicBrainzLoading(true)
    if (source === 'audius') {
      setAudiusResults([])
      setAudiusError('')
      setAudiusLoading(!!searchQuery.trim())
    }
    if (searchTimeout.current !== null) {
      window.clearTimeout(searchTimeout.current)
      searchTimeout.current = null
    }
  }

  const handleGenreFilter = (genre: string) => {
    setSelectedGenre(genre)
  }

  const handleToggleFavorite = (trackId: string) => {
    const isFavorited = favorites.some((track) => track.id === trackId)
    const nextFavorites = isFavorited
      ? favorites.filter((track) => track.id !== trackId)
      : (() => {
          const track = mockTracks.find((candidate) => candidate.id === trackId)
          return track ? [...favorites, { ...track, isFavorite: true }] : favorites
        })()
    setFavorites(nextFavorites)
    try {
      localStorage.setItem('soundcloud_favorites', JSON.stringify(nextFavorites.map((track) => track.id)))
    } catch {
      setFeedbackMessage('Favorites are available for this session, but browser storage is unavailable.')
    }
  }

  const handleFeedback = (
    trackId: string,
    action: FeedbackAction | null,
    metadata?: { title?: string; genres?: string[]; artist?: string; sourceUrl?: string },
  ) => {
    const track = mockTracks.find((candidate) => candidate.id === trackId)
    const existing = feedbackByTrack[trackId]
    const nextAction = action === existing?.action ? null : action
    const trackMetadata = {
      title: metadata?.title || track?.title || existing?.title,
      artist: metadata?.artist || track?.artist || existing?.artist,
      genres: metadata?.genres || (track?.genre ? [track.genre] : existing?.genres),
      sourceUrl: metadata?.sourceUrl || existing?.sourceUrl,
    }
    RecommendationEngine.setTrackFeedback(trackId, nextAction, trackMetadata)
    const updated = RecommendationEngine.getUserTaste().feedbackByTrack
    setFeedbackByTrack(updated)

    if (nextAction) {
      setFeedbackMessage(`${nextAction === 'like' ? 'Liked' : nextAction === 'skip' ? 'Skipped' : 'Disliked'} ${trackMetadata.title || 'track'}.`)
    } else {
      setFeedbackMessage(`Feedback cleared for ${trackMetadata.title || 'track'}.`)
    }
  }

  const handleViewPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist)
  }

  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🎵 SoundCloud Discovery</h1>
          <p>Discover amazing music from around the world</p>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-button ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover
        </button>
        <button
          className={`nav-button ${activeTab === 'playlists' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          Playlists
        </button>
        <button
          className={`nav-button favorites ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
          title="View your favorite tracks"
        >
          ❤️ Favorites ({favorites.length})
        </button>
        <button
          className={`nav-button ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback ({Object.keys(feedbackByTrack).length})
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'discover' && (
          <>
            <SearchBar onSearch={handleSearch} source={searchSource} onSourceChange={handleSearchSourceChange} />
            {searchSource === 'demo' ? <GenreFilter
              selectedGenre={selectedGenre}
              onGenreChange={handleGenreFilter}
            /> : searchSource === 'musicbrainz' ? <p className="catalog-note">MusicBrainz provides recording metadata. It does not provide artwork, genres, or playable audio.</p> : null}

            <div className="tracks-section">
              <h2>
                {searchSource === 'musicbrainz' ? 'MusicBrainz Recordings' : searchSource === 'audius' ? 'Audius Tracks' : selectedGenre === 'all'
                  ? 'All Tracks'
                  : `${selectedGenre.charAt(0).toUpperCase() + selectedGenre.slice(1)} Tracks`}
              </h2>
              {searchSource === 'demo' && <p className="catalog-note">Fictional demo catalog · feedback examples are based on these sample tracks.</p>}
              {searchSource === 'audius' && <p className="catalog-note">Searches Audius creator uploads. Playback is enabled only for tracks Audius reports as streamable, public, and using its default license.</p>}

              {(searchSource === 'demo' ? isLoading : searchSource === 'musicbrainz' ? musicBrainzLoading : audiusLoading) ? (
                <div className="loading" role="status">{searchSource === 'demo' ? 'Loading tracks...' : searchSource === 'musicbrainz' ? 'Searching MusicBrainz...' : 'Searching Audius...'}</div>
              ) : searchSource === 'musicbrainz' && musicBrainzError ? (
                <div className="no-results" role="alert">{musicBrainzError}</div>
              ) : searchSource === 'audius' && audiusError ? (
                <div className="no-results" role="alert">{audiusError}</div>
              ) : searchSource === 'musicbrainz' && !searchQuery.trim() ? (
                <div className="no-results">Search for a recording or artist to explore MusicBrainz metadata.</div>
              ) : searchSource === 'audius' && !searchQuery.trim() ? (
                <div className="no-results">Search Audius for a track or creator to discover music.</div>
              ) : searchSource === 'demo' && rankedTracks.length > 0 || searchSource === 'musicbrainz' && (rankedMusicBrainzTracks.length > 0 || musicBrainzResults.some((track) => !track.artist.trim())) || searchSource === 'audius' && rankedAudiusTracks.length > 0 ? (
                <div className="tracks-grid">
                  {searchSource === 'demo' ? rankedTracks.map((ranked) => {
                    const track = filteredTrackById.get(ranked.track.id)
                    if (!track) return null
                    return (
                      <TrackCard
                        key={ranked.track.id}
                        track={{ ...track, isFavorite: favoriteIds.has(track.id) }}
                        onToggleFavorite={handleToggleFavorite}
                        feedback={feedbackByTrack[ranked.track.id]?.action ?? null}
                        onFeedback={(action) => handleFeedback(track.id, action)}
                        recommendation={{ reason: ranked.reason, score: ranked.score }}
                      />
                    )
                  }) : searchSource === 'musicbrainz' ? [
                    ...rankedMusicBrainzTracks.map((ranked) => ({ track: ranked.track, ranked })),
                    ...musicBrainzResults.filter((track) => !track.artist.trim()).map((track) => ({ track, ranked: undefined })),
                  ].map(({ track: internal, ranked }) => {
                    const track: Track = {
                      id: internal.id, title: internal.title, artist: internal.artist, genre: undefined,
                      image: undefined, duration: internal.duration > 0 ? internal.duration : undefined,
                      plays: undefined, isFavorite: false, sourceName: 'MusicBrainz', sourceUrl: internal.externalUrl,
                      album: internal.album, releaseDate: internal.releaseDate,
                    }
                    return <TrackCard
                      key={internal.id} track={track} favoriteEnabled={false} onToggleFavorite={handleToggleFavorite}
                      feedback={feedbackByTrack[internal.id]?.action ?? null}
                      onFeedback={internal.artist.trim() ? (action) => handleFeedback(internal.id, action, { title: internal.title, artist: internal.artist, genres: [], sourceUrl: internal.externalUrl }) : undefined}
                      recommendation={ranked ? { reason: ranked.reason, score: ranked.score } : undefined}
                    />
                  }) : rankedAudiusTracks.map(({ track: internal, reason, score }) => {
                    const track: Track = {
                      id: internal.id, title: internal.title, artist: internal.artist, genre: internal.genres[0],
                      image: internal.artwork, duration: internal.duration || undefined,
                      plays: internal.popularity !== undefined ? Math.round(internal.popularity * 1000) : undefined,
                      isFavorite: false, sourceName: 'Audius', sourceUrl: internal.externalUrl,
                      playbackId: (internal as AudiusTrack).playbackId, playbackAvailable: (internal as AudiusTrack).playbackAvailable,
                      playbackUnavailableReason: (internal as AudiusTrack).playbackUnavailableReason,
                    }
                    return <TrackCard
                      key={internal.id} track={track} favoriteEnabled={false} onToggleFavorite={handleToggleFavorite}
                      onPlay={() => audiusPlayerRef.current?.playTrack(internal as AudiusTrack)}
                      onQueue={() => audiusPlayerRef.current?.queueTrack(internal as AudiusTrack)}
                      isQueued={queuedTrackIds.has(internal.id)}
                      isCurrentTrack={currentAudiusTrackId === internal.id} isPlaying={audiusIsPlaying}
                      feedback={feedbackByTrack[internal.id]?.action ?? null}
                      onFeedback={(action) => handleFeedback(internal.id, action, { title: internal.title, artist: internal.artist, genres: internal.genres, sourceUrl: internal.externalUrl })}
                      recommendation={{ reason, score }}
                    />
                  })}
                </div>
              ) : (
                <div className="no-results">
                  {searchSource === 'musicbrainz' ? (
                    <>No MusicBrainz recordings matched “{searchQuery.trim()}”. Check the spelling or try another search. <a href="https://musicbrainz.org/" target="_blank" rel="noreferrer">Browse MusicBrainz</a></>
                  ) : searchSource === 'audius' ? (
                    <>No Audius tracks matched “{searchQuery.trim()}”. Try another track or creator name, or open <a href="https://audius.co/" target="_blank" rel="noreferrer">Audius</a>.</>
                  ) : filteredTracks.length === 0 ? (
                    'No tracks found. Try a different search or genre.'
                  ) : (
                    <>
                      <p>No recommendations match your feedback. Review or undo feedback to see these tracks again.</p>
                      <button className="feedback-recovery" onClick={() => setActiveTab('feedback')}>
                        Review feedback ({Object.keys(feedbackByTrack).length})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'favorites' && (
          <div className="favorites-section">
            <h2>Your Favorite Tracks</h2>
            {favorites.length > 0 ? (
              <div className="tracks-grid">
                {favorites.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onToggleFavorite={handleToggleFavorite}
                    feedback={feedbackByTrack[track.id]?.action ?? null}
                    onFeedback={(action) => handleFeedback(track.id, action)}
                  />
                ))}
              </div>
            ) : (
              <div className="no-results">
                No favorites yet. Click the ❤️ icon on tracks to add them.
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <FeedbackHistory feedbackByTrack={feedbackByTrack} onFeedback={handleFeedback} />
        )}

        {activeTab === 'playlists' && !selectedPlaylist && (
          <div className="playlists-section">
            <h2>Popular Playlists</h2>
            <div className="playlists-grid">
              {playlists.map((playlist) => (
                <PlaylistView
                  key={playlist.id}
                  playlist={playlist}
                  onViewPlaylist={handleViewPlaylist}
                />
              ))}
            </div>
          </div>
        )}

        {selectedPlaylist && (
          <PlaylistDetail
            playlist={selectedPlaylist}
            onBack={handleBackToPlaylists}
            onToggleFavorite={handleToggleFavorite}
            feedbackByTrack={feedbackByTrack}
            onFeedback={handleFeedback}
          />
        )}
      </main>

      <AudiusPlaybackPlayer
        ref={audiusPlayerRef}
        recommendations={rankedAudiusTracks.map(({ track }) => track as AudiusTrack)}
        feedbackByTrack={feedbackByTrack}
        onTrackChange={setCurrentAudiusTrackId}
        onPlayingChange={setAudiusIsPlaying}
        onQueueChange={notifyQueueChange}
      />

      <div className="sr-only" role="status" aria-live="polite">{feedbackMessage}</div>

      <footer className="app-footer">
        <p>
          © 2026 SoundCloud Discovery - Built with React & Vite | Made with ❤️
        </p>
      </footer>
    </div>
  )
}

export default App
