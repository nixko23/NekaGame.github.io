/**
 * User Taste Profile
 * Stores user preferences and listening history for personalized recommendations
 * Persisted in localStorage during MVP
 */

export interface TasteProfile {
  favoriteGenres: string[]
  favoriteArtists: string[]
  dislikedGenres: string[]
  recentlySeenTrackIds: string[] // Last 50 tracks shown to user
  skippedTrackIds: string[] // Tracks user explicitly skipped
  likedTrackIds: string[] // Tracks user favorited
  likedTrackPreferences: Record<string, { genres: string[]; artist: string }>
  feedbackByTrack: Record<string, TrackFeedback>
}

export type FeedbackAction = 'like' | 'skip' | 'dislike'

export interface TrackFeedback {
  action: FeedbackAction
  title: string
  artist: string
  genres: string[]
  sourceUrl?: string
}

const STORAGE_KEY = 'soundcloud_taste_profile'
const MAX_HISTORY = 50

export class TasteProfileManager {
  private profile: TasteProfile
  private legacyDislikedGenres: string[] = []

  constructor() {
    this.profile = this.loadProfile()
  }

  private loadProfile(): TasteProfile {
    try {
      if (typeof localStorage === 'undefined') return this.defaultProfile()
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: unknown = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') {
          const value = parsed as Partial<TasteProfile>
          const legacyGenres = validStrings(value.dislikedGenres)
          const feedbackByTrack = sanitizeFeedback(value.feedbackByTrack)

          if (!Object.prototype.hasOwnProperty.call(value, 'feedbackByTrack')) {
            const legacyPreferences = sanitizeLikedPreferences(value.likedTrackPreferences)
            for (const id of validStrings(value.likedTrackIds)) {
              feedbackByTrack[id] = {
                action: 'like',
                title: '',
                artist: legacyPreferences[id]?.artist ?? '',
                genres: legacyPreferences[id]?.genres ?? [],
              }
            }
            for (const id of validStrings(value.skippedTrackIds)) {
              feedbackByTrack[id] = { action: 'skip', title: '', artist: '', genres: [] }
            }
          }

          const profile = this.defaultProfile()
          profile.recentlySeenTrackIds = validStrings(value.recentlySeenTrackIds).slice(0, MAX_HISTORY)
          profile.feedbackByTrack = feedbackByTrack
          this.profile = profile
          this.legacyDislikedGenres = legacyGenres
          this.rebuildDerivedPreferences()
          return this.profile
        }
      }
    } catch {
      // Ignore malformed data
    }
    return this.defaultProfile()
  }

  private defaultProfile(): TasteProfile {
    return {
      favoriteGenres: [],
      favoriteArtists: [],
      dislikedGenres: [],
      recentlySeenTrackIds: [],
      skippedTrackIds: [],
      likedTrackIds: [],
      likedTrackPreferences: {},
      feedbackByTrack: {},
    }
  }

  private save(): void {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile))
    } catch {
      console.warn('Failed to save taste profile')
    }
  }

  /**
   * Record that user saw a track (for deduplication)
   */
  recordTrackSeen(trackId: string): void {
    this.profile.recentlySeenTrackIds = [
      trackId,
      ...this.profile.recentlySeenTrackIds.filter((id) => id !== trackId),
    ].slice(0, MAX_HISTORY)
    this.save()
  }

  /**
   * Record that user favorited a track
   */
  recordTrackLiked(
    trackId: string,
    genres: string[],
    artist: string,
    existingLikedTracks?: Array<{ id: string; genres: string[]; artist: string }>,
  ): void {
    existingLikedTracks?.forEach(({ id, genres, artist }) => {
      if (!this.profile.feedbackByTrack[id]) {
        this.profile.feedbackByTrack[id] = { action: 'like', title: '', genres: validStrings(genres), artist }
      }
    })
    this.setTrackFeedback(trackId, 'like', { genres, artist })
  }

  /**
   * Record that user unfavorited a track
   */
  recordTrackUnliked(
    trackId: string,
    remainingLikedTracks?: Array<{ id: string; genres: string[]; artist: string }>,
  ): void {
    if (this.profile.feedbackByTrack[trackId]?.action === 'like') {
      this.setTrackFeedback(trackId, null)
    }
    remainingLikedTracks?.forEach(({ id, genres, artist }) => {
      if (!this.profile.feedbackByTrack[id]) {
        this.profile.feedbackByTrack[id] = { action: 'like', title: '', genres: validStrings(genres), artist }
      }
    })
    this.rebuildDerivedPreferences()
    this.save()
  }

  /** Set or clear the single feedback state for a track, preventing contradictions. */
  setTrackFeedback(
    trackId: string,
    action: FeedbackAction | null,
    metadata: { title?: string; genres?: string[]; artist?: string; sourceUrl?: string } = {},
  ): void {
    if (!trackId) return
    if (action === null) {
      if (!this.profile.feedbackByTrack[trackId]) return
      delete this.profile.feedbackByTrack[trackId]
    } else {
      this.profile.feedbackByTrack[trackId] = {
        action,
        title: safeText(metadata.title),
        artist: safeText(metadata.artist),
        genres: [...new Set(validStrings(metadata.genres).map((genre) => genre.trim()).filter(Boolean))],
        ...(safeMusicBrainzUrl(metadata.sourceUrl) ? { sourceUrl: safeMusicBrainzUrl(metadata.sourceUrl) } : {}),
      }
    }
    this.rebuildDerivedPreferences()
    this.save()
  }

  private rebuildDerivedPreferences(): void {
    const entries = Object.entries(this.profile.feedbackByTrack)
    const likedEntries = entries.filter(([, feedback]) => feedback.action === 'like')
    const likedPreferences = likedEntries.map(([, feedback]) => feedback)
    this.profile.likedTrackIds = likedEntries.map(([id]) => id)
    this.profile.skippedTrackIds = entries.filter(([, feedback]) => feedback.action === 'skip').map(([id]) => id)
    this.profile.likedTrackPreferences = Object.fromEntries(likedEntries.map(([id, feedback]) => [
      id,
      { genres: [...feedback.genres], artist: feedback.artist },
    ]))
    this.profile.favoriteGenres = [...new Set(likedPreferences.flatMap(({ genres }) => genres))]
    this.profile.favoriteArtists = [...new Set(likedPreferences.map(({ artist }) => artist).filter(Boolean))]
    this.profile.dislikedGenres = [...new Set([
      ...this.legacyDislikedGenres,
      ...entries.filter(([, feedback]) => feedback.action === 'dislike').flatMap(([, feedback]) => feedback.genres),
    ])]
  }

  /**
   * Get current taste profile
   */
  getProfile(): TasteProfile {
    return {
      favoriteGenres: [...this.profile.favoriteGenres],
      favoriteArtists: [...this.profile.favoriteArtists],
      dislikedGenres: [...this.profile.dislikedGenres],
      recentlySeenTrackIds: [...this.profile.recentlySeenTrackIds],
      skippedTrackIds: [...this.profile.skippedTrackIds],
      likedTrackIds: [...this.profile.likedTrackIds],
      likedTrackPreferences: Object.fromEntries(
        Object.entries(this.profile.likedTrackPreferences).map(([id, preferences]) => [id, {
          genres: [...preferences.genres],
          artist: preferences.artist,
        }]),
      ),
      feedbackByTrack: Object.fromEntries(
        Object.entries(this.profile.feedbackByTrack).map(([id, feedback]) => [id, {
          ...feedback,
          genres: [...feedback.genres],
        }]),
      ),
    }
  }

  /**
   * Check if track was recently seen
   */
  hasSeenTrack(trackId: string): boolean {
    return this.profile.recentlySeenTrackIds.includes(trackId)
  }

  /**
   * Check if track is liked
   */
  isLiked(trackId: string): boolean {
    return this.profile.likedTrackIds.includes(trackId)
  }

  getFeedback(trackId: string): TrackFeedback | undefined {
    const feedback = this.profile.feedbackByTrack[trackId]
    return feedback ? { ...feedback, genres: [...feedback.genres] } : undefined
  }

  /**
   * Get user's top genres (for seeding recommendations)
   */
  getTopGenres(limit: number = 5): string[] {
    return this.profile.favoriteGenres.slice(0, limit)
  }

  /**
   * Get user's top artists (for seeding recommendations)
   */
  getTopArtists(limit: number = 5): string[] {
    return this.profile.favoriteArtists.slice(0, limit)
  }

  /**
   * Clear all data (for testing or reset)
   */
  clear(): void {
    this.profile = this.defaultProfile()
    this.legacyDislikedGenres = []
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Clearing in-memory preferences still works when storage is unavailable.
    }
  }
}

function validStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length <= 256).slice(0, 200)
    : []
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

function sanitizeLikedPreferences(value: unknown): Record<string, { genres: string[]; artist: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([id, item]) => {
    if (!item || typeof item !== 'object') return []
    const preference = item as { genres?: unknown; artist?: unknown }
    return [[id, { genres: validStrings(preference.genres), artist: safeText(preference.artist) }]]
  }))
}

function sanitizeFeedback(value: unknown): Record<string, TrackFeedback> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).slice(0, 200).flatMap(([id, item]) => {
    if (!item || typeof item !== 'object') return []
    const feedback = item as Partial<TrackFeedback>
    if (feedback.action !== 'like' && feedback.action !== 'skip' && feedback.action !== 'dislike') return []
    return [[id, {
      action: feedback.action,
      title: safeText(feedback.title),
      artist: safeText(feedback.artist),
      genres: [...new Set(validStrings(feedback.genres).map((genre) => genre.trim()).filter(Boolean))],
      ...(safeMusicBrainzUrl(feedback.sourceUrl) ? { sourceUrl: safeMusicBrainzUrl(feedback.sourceUrl) } : {}),
    }]]
  }))
}

function safeMusicBrainzUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'musicbrainz.org' && /^\/recording\/[0-9a-f-]{36}$/i.test(url.pathname)
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

// Singleton instance
export const tasteProfile = new TasteProfileManager()
