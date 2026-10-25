/**
 * Recommendation Ranking Engine
 * Applies ranking rules and returns explainable recommendations
 */

import type { InternalTrack, ScoreBreakdown } from './types'
import { scoreTrack, scoreTracks } from './scoring'
import { tasteProfile, type TasteProfile } from './tasteProfile'

export interface RankedTrack {
  track: InternalTrack
  score: number
  reason: string
  position: number
}

/**
 * Ranking rules
 */
const RANKING_RULES = {
  maxConsecutiveArtist: 2, // Max 2 consecutive tracks from same artist
  minTimeBetweenArtist: 3, // At least 3 tracks between same artist
  deduplication: true, // Remove exact duplicates
}

/**
 * Rank and filter candidate tracks
 * Returns top recommendations with explanations
 */
export function rankTracks(
  candidates: InternalTrack[],
  limit: number = 20,
  taste: TasteProfile = tasteProfile.getProfile(),
): RankedTrack[] {
  // Step 1: Remove duplicates
  const excludedIds = new Set([
    ...taste.skippedTrackIds,
    ...Object.entries(taste.feedbackByTrack)
      .filter(([, item]) => item.action === 'dislike')
      .map(([id]) => id),
  ])
  const deduplicated = deduplicateTracks(candidates.filter((track) => !excludedIds.has(track.id)))

  // Seen tracks remain eligible but receive a lower novelty score. Excluding
  // them here would hide the current view after its impressions are recorded.
  // Step 2: Score all tracks
  const scored = scoreTracks(deduplicated, taste)

  // Step 4: Sort by score
  const sorted = scored.sort((a, b) => (b.scoring?.totalScore || 0) - (a.scoring?.totalScore || 0))

  // Step 5: Apply ranking rules
  const ranked = applyRankingRules(sorted, RANKING_RULES)

  // Step 6: Return top N
  return ranked.slice(0, limit).map((item, index) => ({
    track: item.track,
    score: item.score,
    reason: item.reason,
    position: index + 1,
  }))
}

function deduplicateTracks(tracks: InternalTrack[]): InternalTrack[] {
  const seen = new Set<string>()
  return tracks.filter((track) => {
    if (seen.has(track.id)) {
      return false
    }
    seen.add(track.id)
    return true
  })
}

interface ScoredTrack {
  track: InternalTrack
  scoring: ScoreBreakdown
  score: number
  reason: string
}

function applyRankingRules(
  sorted: Array<InternalTrack & { scoring: ScoreBreakdown }>,
  rules: typeof RANKING_RULES,
): ScoredTrack[] {
  const result: ScoredTrack[] = []
  const artistTrackCount: { [artist: string]: number } = {}
  const remaining = [...sorted]

  // Reconsider skipped candidates after adding another artist. This lets a
  // high-scoring artist appear later once the spacing rule allows it.
  while (remaining.length > 0) {
    const eligibleIndex = remaining.findIndex((item) => {
      const count = artistTrackCount[item.artist] || 0
      if (count >= rules.maxConsecutiveArtist) return false
      const lastIndex = result.findLastIndex((ranked) => ranked.track.artist === item.artist)
      return lastIndex === -1 || result.length - lastIndex >= rules.minTimeBetweenArtist
    })
    // When a filtered/small catalog has no artist-eligible alternative, retain
    // the best remaining candidate instead of silently dropping it.
    const fallbackIndex = eligibleIndex === -1
      ? remaining.findIndex((item) => (artistTrackCount[item.artist] || 0) < rules.maxConsecutiveArtist)
      : eligibleIndex
    if (fallbackIndex === -1) break
    const [item] = remaining.splice(fallbackIndex, 1)
    const artist = item.artist
    const currentCount = artistTrackCount[artist] || 0
    result.push({
      track: item,
      scoring: item.scoring,
      score: item.scoring.totalScore,
      reason: item.scoring.reason,
    })

    artistTrackCount[artist] = currentCount + 1
  }

  return result
}

/**
 * Get recommendations based on user's taste and available candidates
 * Main entry point for the recommendation engine
 */
export function getRecommendations(
  candidates: InternalTrack[],
  options?: {
    limit?: number
    taste?: TasteProfile
  },
): RankedTrack[] {
  const limit = options?.limit ?? 20
  return rankTracks(candidates, limit, options?.taste)
}

/** Record recommendations after they have actually been rendered to the user. */
export function recordRecommendationsSeen(trackIds: string[]): void {
  trackIds.forEach((trackId) => tasteProfile.recordTrackSeen(trackId))
}

/**
 * Get seed-based recommendations (for future API integration)
 * When using real APIs with seed-based recommendations
 */
export function getSeededRecommendations(
  candidates: InternalTrack[],
  seedGenres?: string[],
  seedArtists?: string[],
): RankedTrack[] {
  const profile = tasteProfile.getProfile()

  // Use provided seeds or fall back to user preferences
  const genres = seedGenres || profile.favoriteGenres.slice(0, 3)
  const artists = seedArtists || profile.favoriteArtists.slice(0, 3)

  // Filter to tracks matching seeds (simple filter for MVP)
  const matched = candidates.filter((track) => {
    const hasGenreSeeds = genres.length > 0
    const hasArtistSeeds = artists.length > 0
    if (!hasGenreSeeds && !hasArtistSeeds) return true
    const genreMatch = hasGenreSeeds && track.genres?.some((g) => genres.includes(g))
    const artistMatch = hasArtistSeeds && (track.artists?.some((artist) => artists.includes(artist)) ?? artists.includes(track.artist))
    return genreMatch || artistMatch
  })

  return rankTracks(matched, 20, profile)
}

/**
 * Explain why a specific track was recommended
 */
export function explainRecommendation(track: InternalTrack, allTracks: InternalTrack[], taste?: TasteProfile): string {
  return scoreTrack(track, allTracks, taste).reason
}
