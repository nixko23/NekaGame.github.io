/**
 * Recommendation Scoring System
 * Provider-independent scoring formula
 * Explainable and tunable for future provider integration
 */

import type { InternalTrack } from './types'
import { tasteProfile, type TasteProfile } from './tasteProfile'

export interface ScoreBreakdown {
  genreScore: number
  artistScore: number
  noveltyScore: number
  diversityScore: number
  totalScore: number
  reason: string
}

/**
 * Weights for scoring components
 * Can be tuned per user or A/B tested
 */
const SCORE_WEIGHTS = {
  genre: 0.35,
  artist: 0.3,
  novelty: 0.2,
  diversity: 0.15,
}

/**
 * Score a single track against user's taste profile
 *
 * Formula:
 * Score = (0.35 × Genre) + (0.30 × Artist) + (0.20 × Novelty) + (0.15 × Diversity)
 *
 * Each component is 0-100
 */
export function scoreTrack(
  track: InternalTrack,
  allTracks: InternalTrack[],
  profile: TasteProfile = tasteProfile.getProfile(),
): ScoreBreakdown {

  // Genre score: Match against favorite genres
  const genreScore = calculateGenreScore(track, profile)

  // Artist score: Boost if artist is favorite, penalize if seen recently from this artist
  const artistScore = calculateArtistScore(track, profile)

  // Novelty score: Reward new releases and unknown artists
  const noveltyScore = calculateNoveltyScore(track, profile)

  // Diversity score: Avoid repetition from same artist
  const diversityScore = calculateDiversityScore(track, allTracks, profile)

  const totalScore =
    genreScore * SCORE_WEIGHTS.genre +
    artistScore * SCORE_WEIGHTS.artist +
    noveltyScore * SCORE_WEIGHTS.novelty +
    diversityScore * SCORE_WEIGHTS.diversity

  const reason = generateReason(track, profile, genreScore, artistScore, noveltyScore, diversityScore)

  return {
    genreScore: Math.round(genreScore),
    artistScore: Math.round(artistScore),
    noveltyScore: Math.round(noveltyScore),
    diversityScore: Math.round(diversityScore),
    totalScore: Math.round(totalScore),
    reason,
  }
}

function calculateGenreScore(track: InternalTrack, profile: TasteProfile): number {
  if (!track.genres?.length) return 50
  const scores = track.genres.map((genre) => preferenceScore(countPreference(profile, 'genre', genre)))
  return scores.reduce((total, score) => total + score, 0) / scores.length
}

function calculateArtistScore(track: InternalTrack, profile: TasteProfile): number {
  if (!track.artist?.trim()) return 50
  return preferenceScore(countPreference(profile, 'artist', track.artist))
}

function calculateNoveltyScore(track: InternalTrack, profile: TasteProfile): number {
  const { recentlySeenTrackIds } = profile

  // If track was recently shown, lower novelty
  if (recentlySeenTrackIds.includes(track.id)) {
    return 20
  }

  // New releases get bonus
  if (track.isNew) {
    return 90
  }

  // Popular tracks get slight boost (trusted by community)
  if (track.popularity && track.popularity > 70) {
    return 70
  }

  // Default novelty for unknown tracks
  return 50
}

function calculateDiversityScore(track: InternalTrack, allTracks: InternalTrack[], profile: TasteProfile): number {
  const { recentlySeenTrackIds } = profile

  // Count recent tracks from same artist
  const recentTracksFromArtist = allTracks
    .filter((t) => recentlySeenTrackIds.includes(t.id) && t.artist === track.artist)
    .length

  // Penalize if artist already well-represented in recent tracks
  if (recentTracksFromArtist >= 3) {
    return 30
  }
  if (recentTracksFromArtist >= 2) {
    return 50
  }
  if (recentTracksFromArtist >= 1) {
    return 70
  }

  // Artist not recently seen; good diversity
  return 100
}

function generateReason(
  track: InternalTrack,
  profile: TasteProfile,
  genreScore: number,
  artistScore: number,
  noveltyScore: number,
  diversityScore: number
): string {
  const matchedLikedGenre = track.genres?.find((genre) => countPreference(profile, 'genre', genre) > 0)
  if (matchedLikedGenre) return `Similar genre: ${matchedLikedGenre}`

  const matchedDislikedGenre = track.genres?.find((genre) => countPreference(profile, 'genre', genre) < 0)
  if (matchedDislikedGenre) return `Lower priority: disliked genre ${matchedDislikedGenre}`

  const artistPreference = track.artist ? countPreference(profile, 'artist', track.artist) : 0
  if (artistPreference > 0) return `Artist you like: ${track.artist}`
  if (artistPreference < 0) return `Lower priority: disliked artist ${track.artist}`
  if (track.artist?.trim() && profile.favoriteArtists.length > 0) return 'Outside your favorite artists'

  // Find the highest-scoring component
  const contributions = [
    { name: 'genre', score: genreScore * SCORE_WEIGHTS.genre },
    { name: 'artist', score: artistScore * SCORE_WEIGHTS.artist },
    { name: 'novelty', score: noveltyScore * SCORE_WEIGHTS.novelty },
    { name: 'diversity', score: diversityScore * SCORE_WEIGHTS.diversity },
  ]

  const topComponent = contributions.reduce((a, b) => (a.score > b.score ? a : b))

  switch (topComponent.name) {
    case 'genre':
      {
        const matchedGenre = track.genres?.find((genre) => profile.favoriteGenres.some((favorite) => sameValue(favorite, genre)))
        if (matchedGenre) return `Similar genre: ${matchedGenre}`
      }
      return 'Recommended for you'

    case 'artist':
      if (profile.favoriteArtists.includes(track.artist)) {
        return `Artist you like: ${track.artist}`
      }
      return 'Outside your favorite artists'

    case 'novelty':
      if (track.isNew) {
        return 'New release'
      }
      if (track.popularity && track.popularity > 70) {
        return 'Trending now'
      }
      return 'Recommended for you'

    case 'diversity':
      return `Discover new music`

    default:
      return 'Recommended for you'
  }
}

function preferenceScore(netPreference: number): number {
  if (netPreference > 0) return Math.min(100, 60 + netPreference * 40)
  if (netPreference < 0) return Math.max(10, 50 + netPreference * 35)
  return 50
}

function countPreference(profile: TasteProfile, kind: 'genre' | 'artist', value: string): number {
  const normalized = value.trim().toLocaleLowerCase()
  if (!normalized) return 0
  let likes = 0
  let dislikes = 0

  Object.values(profile.feedbackByTrack ?? {}).forEach((feedback) => {
    const matches = kind === 'genre'
      ? feedback.genres.some((genre) => sameValue(genre, normalized))
      : sameValue(feedback.artist, normalized)
    if (matches && feedback.action === 'like') likes++
    if (matches && feedback.action === 'dislike') dislikes++
  })

  // Retain compatibility with stored profiles created before per-track feedback.
  if (kind === 'genre' && !Object.keys(profile.feedbackByTrack ?? {}).length && profile.favoriteGenres.some((genre) => sameValue(genre, normalized))) likes++
  if (kind === 'genre' && !Object.keys(profile.feedbackByTrack ?? {}).length && profile.dislikedGenres.some((genre) => sameValue(genre, normalized))) dislikes++
  if (kind === 'artist' && !Object.keys(profile.feedbackByTrack ?? {}).length && profile.favoriteArtists.some((artist) => sameValue(artist, normalized))) likes++

  return likes - dislikes
}

function sameValue(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

/**
 * Score all tracks and return with scores attached
 */
export function scoreTracks(
  tracks: InternalTrack[],
  profile: TasteProfile = tasteProfile.getProfile(),
): Array<InternalTrack & { scoring: ScoreBreakdown }> {
  return tracks.map((track) => ({
    ...track,
    scoring: scoreTrack(track, tracks, profile),
  }))
}
