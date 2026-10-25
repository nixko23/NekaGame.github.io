/**
 * SoundCloud Discovery Recommendation Engine
 * Provider-independent core for personalized music discovery
 *
 * This is the central abstraction that will work with any data source:
 * - Mock data (current MVP)
 * - Spotify API (Phase 1)
 * - Last.fm API (Phase 2)
 * - SoundCloud API (Phase 3+)
 */

// Export types
export type { ScoreBreakdown, InternalTrack } from './types'
export type { TasteProfile } from './tasteProfile'
export type { FeedbackAction, TrackFeedback } from './tasteProfile'
export type { RankedTrack } from './ranking'
export type { CandidateFilterCriteria } from './candidateBuilder'

// Export functions
export { buildCandidatesFromMock, filterCandidates, mergeCandidates } from './candidateBuilder'
export { buildCandidatesFromSpotify, buildCandidatesFromLastfm, buildCandidatesFromSoundcloud, enrichCandidates } from './candidateBuilder'
export { tasteProfile } from './tasteProfile'
export { scoreTrack, scoreTracks } from './scoring'
export { rankTracks, getRecommendations, getSeededRecommendations, explainRecommendation, recordRecommendationsSeen } from './ranking'

import type { RankedTrack } from './ranking'
import type { TasteProfile } from './tasteProfile'
import type { CandidateFilterCriteria } from './candidateBuilder'
import { getRecommendations, getSeededRecommendations, recordRecommendationsSeen } from './ranking'
import { tasteProfile } from './tasteProfile'
import {
  buildCandidatesFromMock,
  buildCandidatesFromSpotify,
  buildCandidatesFromLastfm,
  buildCandidatesFromSoundcloud,
  filterCandidates,
} from './candidateBuilder'

/**
 * Main Recommendation Engine API
 */
export class RecommendationEngine {
  /**
   * Get personalized recommendations based on user's taste
   */
  static getRecommendations(
    tracks: any[], // Can be mock tracks, API response, or InternalTrack[]
    options?: {
      limit?: number
      source?: 'mock' | 'spotify' | 'lastfm' | 'soundcloud'
      taste?: TasteProfile
    },
  ): RankedTrack[] {
    // Convert to internal format
    const candidates = buildCandidates(tracks, options?.source)

    // Get recommendations
    return getRecommendations(candidates, { limit: options?.limit ?? 20, taste: options?.taste })
  }

  /**
   * Get recommendations based on seed genres/artists
   * Useful for "similar to X" features
   */
  static getSeededRecommendations(
    tracks: any[],
    seedGenres?: string[],
    seedArtists?: string[],
    source: 'mock' | 'spotify' | 'lastfm' | 'soundcloud' = 'mock',
  ): RankedTrack[] {
    const candidates = buildCandidates(tracks, source)
    return getSeededRecommendations(candidates, seedGenres, seedArtists)
  }

  /**
   * Filter candidates before recommendation
   */
  static filterCandidates(
    tracks: any[],
    criteria: CandidateFilterCriteria,
    source: 'mock' | 'spotify' | 'lastfm' | 'soundcloud' = 'mock',
  ) {
    const candidates = buildCandidates(tracks, source)
    return filterCandidates(candidates, criteria)
  }

  /** Record recommendations after they have actually appeared in the UI. */
  static recordRecommendationsSeen(trackIds: string[]): void {
    recordRecommendationsSeen(trackIds)
  }

  /**
   * Record user interaction for better recommendations
   */
  static recordLike(
    trackId: string,
    genres: string[],
    artist: string,
    existingLikedTracks?: Array<{ id: string; genres: string[]; artist: string }>,
  ): void {
    tasteProfile.recordTrackLiked(trackId, genres, artist, existingLikedTracks)
  }

  static setTrackFeedback(
    trackId: string,
    action: import('./tasteProfile').FeedbackAction | null,
    metadata: { title?: string; genres?: string[]; artist?: string; sourceUrl?: string } = {},
  ): void {
    tasteProfile.setTrackFeedback(trackId, action, metadata)
  }

  /**
   * Record user unfavoriting track
   */
  static recordUnlike(trackId: string, remainingLikedTracks?: Array<{ id: string; genres: string[]; artist: string }>): void {
    tasteProfile.recordTrackUnliked(trackId, remainingLikedTracks)
  }

  /**
   * Get user's taste profile
   */
  static getUserTaste() {
    return tasteProfile.getProfile()
  }

  /**
   * Clear all data (for testing)
   */
  static reset(): void {
    tasteProfile.clear()
  }
}

function buildCandidates(
  tracks: any[],
  source: 'mock' | 'spotify' | 'lastfm' | 'soundcloud' = 'mock',
) {
  switch (source) {
    case 'spotify': return buildCandidatesFromSpotify(tracks)
    case 'lastfm': return buildCandidatesFromLastfm(tracks)
    case 'soundcloud': return buildCandidatesFromSoundcloud(tracks)
    default: return buildCandidatesFromMock(tracks)
  }
}

export default RecommendationEngine
