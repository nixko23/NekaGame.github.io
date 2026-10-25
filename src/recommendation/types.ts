/**
 * Provider-independent internal Track model
 * Designed to work with any music API (Spotify, SoundCloud, Last.fm, etc.)
 */

export interface ScoreBreakdown {
  genreScore: number
  artistScore: number
  noveltyScore: number
  diversityScore: number
  totalScore: number
  reason: string
}

export interface InternalTrack {
  // Core identification
  id: string // Unique internal ID (e.g., "spotify_123" or "soundcloud_456")
  source: 'mock' | 'spotify' | 'soundcloud' | 'lastfm' | 'musicbrainz' | 'audius' // Data source
  sourceId?: string // Original provider ID (optional, for lookups)

  // Metadata
  title: string
  artist: string
  artists?: string[] // For multi-artist tracks
  album?: string
  artwork?: string // Image URL

  // Classification
  genres: string[] // Array of genres (e.g., ["synthwave", "electronic"])
  tags?: string[] // User-generated or provider tags
  popularity?: number // 0-100 scale (normalized across providers)

  // Duration & Playback
  duration: number // In seconds
  releaseDate?: string
  previewUrl?: string // Preview audio URL (if available)
  externalUrl?: string // Link to provider (Spotify URL, SoundCloud link, etc.)

  // Discovery Signals
  isNew?: boolean // Track released recently
  isPopular?: boolean // Trending or highly played
  isSimilarToLiked?: boolean // Algorithmically similar to liked tracks (set by engine)

  // Metadata for recommendations
  mood?: string // Optional: "energetic", "chill", "melancholic", etc.
  energy?: number // 0-100 (if available from provider)
  danceability?: number // 0-100 (if available from provider)

  // UI state (not persisted)
  matchReason?: string // Why this was recommended ("Similar genre", "New artist", etc.)
  score?: number // Recommendation score (0-100)
}

/**
 * Convert external Track (from API or mock) to InternalTrack
 */
export function toInternalTrack(track: any, source: InternalTrack['source']): InternalTrack {
  return {
    id: track.id || '',
    source,
    sourceId: track.sourceId,
    title: track.title || track.name || '',
    artist: track.artist || '',
    artists: track.artists,
    album: track.album,
    artwork: track.image || track.artwork,
    genres: Array.isArray(track.genres) ? track.genres : track.genre ? [track.genre] : [],
    tags: track.tags,
    popularity: track.popularity !== undefined ? track.popularity : track.plays ? Math.min(100, track.plays / 1000) : 50,
    duration: track.duration || 0,
    previewUrl: track.previewUrl,
    externalUrl: track.sourceUrl || track.externalUrl,
    isNew: track.isNew,
    isPopular: track.isPopular,
    mood: track.mood,
    energy: track.energy,
    danceability: track.danceability,
  }
}

/**
 * Convert InternalTrack back to display format
 */
export function toDisplayTrack(internal: InternalTrack): any {
  return {
    id: internal.id,
    title: internal.title,
    artist: internal.artist,
    genre: internal.genres[0] || 'Unknown',
    image: internal.artwork,
    duration: internal.duration,
    plays: internal.popularity ? internal.popularity * 1000 : 0,
    isFavorite: false, // UI state, managed by App
    sourceUrl: internal.externalUrl,
  }
}
