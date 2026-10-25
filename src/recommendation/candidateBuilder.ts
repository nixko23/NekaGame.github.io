/**
 * Candidate Builder
 * Converts mock data or API responses into candidates for recommendation
 * Provider-agnostic; works with any data source
 */

import type { InternalTrack } from './types'
import { toInternalTrack } from './types'
import { mapSoundCloudTrack } from '../providers/soundcloud'

/**
 * Build candidates from mock tracks
 */
export function buildCandidatesFromMock(mockTracks: any[]): InternalTrack[] {
  return mockTracks.map((track) => toInternalTrack(track, 'mock'))
}

/**
 * Build candidates from Spotify API response (for future integration)
 */
export function buildCandidatesFromSpotify(spotifyTracks: any[]): InternalTrack[] {
  return spotifyTracks.map((track) => {
    const internal = toInternalTrack(
      {
        id: `spotify_${track.id}`,
        sourceId: track.id,
        name: track.name,
        artist: track.artists?.[0]?.name || 'Unknown',
        artists: track.artists?.map((a: any) => a.name),
        album: track.album?.name,
        image: track.album?.images?.[0]?.url,
        genres: track.genres || [],
        duration: Math.floor((track.duration_ms || 0) / 1000),
        popularity: track.popularity || 50,
        previewUrl: track.preview_url,
        externalUrl: track.external_urls?.spotify,
      },
      'spotify',
    )
    return internal
  })
}

/**
 * Build candidates from Last.fm API response (for future integration)
 */
export function buildCandidatesFromLastfm(lastfmTracks: any[]): InternalTrack[] {
  return lastfmTracks.map((track) =>
    toInternalTrack(
      {
        id: `lastfm_${track.name}_${track.artist?.name}`,
        sourceId: track.mbid,
        name: track.name,
        artist: track.artist?.name || 'Unknown',
        image: track.image?.[3]?.['#text'], // Last.fm returns images in array
        duration: track.duration ? Math.floor(track.duration / 1000) : 0,
        externalUrl: track.url,
      },
      'lastfm',
    ),
  )
}

/**
 * Build candidates from SoundCloud API response (for future integration)
 */
export function buildCandidatesFromSoundcloud(soundcloudTracks: any[]): InternalTrack[] {
  return soundcloudTracks.flatMap((track) => {
    const mapped = mapSoundCloudTrack(track)
    return mapped ? [mapped] : []
  })
}

/**
 * Enrich candidates with additional metadata (for AI/ML providers)
 * Placeholder for future provider-specific enrichment
 */
export function enrichCandidates(
  candidates: InternalTrack[],
  _enrichmentSource?: 'musicbrainz' | 'acousticbrainz',
): InternalTrack[] {
  // Placeholder for future enrichment logic
  // Could add audio features, mood detection, etc.
  return candidates
}

/**
 * Filter candidates by criteria
 */
export function filterCandidates(candidates: InternalTrack[], criteria: CandidateFilterCriteria): InternalTrack[] {
  return candidates.filter((track) => {
    if (criteria.genres && criteria.genres.length > 0) {
      const hasGenre = track.genres.some((g) => criteria.genres!.includes(g))
      if (!hasGenre && criteria.genres.length > 0) return false
    }

    if (criteria.minDuration && track.duration < criteria.minDuration) {
      return false
    }

    if (criteria.maxDuration && track.duration > criteria.maxDuration) {
      return false
    }

    if (criteria.minPopularity && (track.popularity || 0) < criteria.minPopularity) {
      return false
    }

    if (criteria.sources && !criteria.sources.includes(track.source)) {
      return false
    }

    if (criteria.excludeTrackIds && criteria.excludeTrackIds.includes(track.id)) {
      return false
    }

    return true
  })
}

export interface CandidateFilterCriteria {
  genres?: string[]
  minDuration?: number
  maxDuration?: number
  minPopularity?: number
  sources?: InternalTrack['source'][]
  excludeTrackIds?: string[]
}

/**
 * Merge candidates from multiple sources
 * Deduplicates by track title + artist
 */
export function mergeCandidates(...candidateArrays: InternalTrack[][]): InternalTrack[] {
  const merged = candidateArrays.flat()
  const seen = new Set<string>()
  const result: InternalTrack[] = []

  for (const track of merged) {
    const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(track)
    }
  }

  return result
}
