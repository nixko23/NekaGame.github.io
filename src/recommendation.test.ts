/**
 * Recommendation Engine Unit Tests
 * Focused on pure function behavior without external dependencies
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { scoreTrack, scoreTracks } from './recommendation/scoring'
import { explainRecommendation, getRecommendations, getSeededRecommendations, rankTracks } from './recommendation/ranking'
import {
  buildCandidatesFromMock,
  buildCandidatesFromSpotify,
  mergeCandidates,
  RecommendationEngine,
  tasteProfile,
  type InternalTrack,
} from './recommendation'
import { TasteProfileManager } from './recommendation/tasteProfile'

beforeEach(() => {
  tasteProfile.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Recommendation Engine - Scoring', () => {
  describe('Score Calculation', () => {
    it('should return numeric scores between 0 and 100', () => {
      const track: InternalTrack = {
        id: 'test',
        source: 'mock',
        title: 'Test',
        artist: 'Test',
        genres: ['rock'],
        duration: 200,
        popularity: 50,
      }
      const tracks = [track]

      const result = scoreTracks(tracks)
      expect(result[0].scoring.totalScore).toBeGreaterThanOrEqual(0)
      expect(result[0].scoring.totalScore).toBeLessThanOrEqual(100)
    })

    it('should increase artist and genre scores for matching preferences', () => {
      tasteProfile.recordTrackLiked('liked', ['rock'], 'Favorite Artist')
      const result = scoreTrack({
        id: 'candidate', source: 'mock', title: 'Candidate', artist: 'Favorite Artist',
        genres: ['rock'], duration: 180,
      }, [])
      expect(result.genreScore).toBe(100)
      expect(result.artistScore).toBe(100)
    })

    it('should provide explainable reasons', () => {
      const track: InternalTrack = {
        id: 'test',
        source: 'mock',
        title: 'Test Track',
        artist: 'Test Artist',
        genres: ['synthwave'],
        duration: 200,
        popularity: 75,
      }
      const tracks = [track]

      const result = scoreTracks(tracks)
      expect(result[0].scoring.reason).toBeDefined()
      expect(result[0].scoring.reason.length).toBeGreaterThan(0)
    })

    it('should have component scores between 0-100', () => {
      const track: InternalTrack = {
        id: 'test',
        source: 'mock',
        title: 'Test',
        artist: 'Test',
        genres: ['rock'],
        duration: 200,
        popularity: 50,
      }
      const tracks = [track]

      const result = scoreTracks(tracks)
      const scoring = result[0].scoring
      expect(scoring.genreScore).toBeGreaterThanOrEqual(0)
      expect(scoring.genreScore).toBeLessThanOrEqual(100)
      expect(scoring.artistScore).toBeGreaterThanOrEqual(0)
      expect(scoring.artistScore).toBeLessThanOrEqual(100)
      expect(scoring.noveltyScore).toBeGreaterThanOrEqual(0)
      expect(scoring.noveltyScore).toBeLessThanOrEqual(100)
      expect(scoring.diversityScore).toBeGreaterThanOrEqual(0)
      expect(scoring.diversityScore).toBeLessThanOrEqual(100)
    })

    it('should calculate total score as weighted combination', () => {
      const track: InternalTrack = {
        id: 'test',
        source: 'mock',
        title: 'Test',
        artist: 'Test',
        genres: ['rock'],
        duration: 200,
        popularity: 50,
      }
      const tracks = [track]

      const result = scoreTracks(tracks)
      const scoring = result[0].scoring

      // Verify formula: 0.35*G + 0.30*A + 0.20*N + 0.15*D
      const expected =
        scoring.genreScore * 0.35 +
        scoring.artistScore * 0.3 +
        scoring.noveltyScore * 0.2 +
        scoring.diversityScore * 0.15

      expect(scoring.totalScore).toBe(Math.round(expected))
    })
  })

  describe('Edge Cases', () => {
    it('should handle tracks with no genres', () => {
      const track: InternalTrack = {
        id: 'no_genre',
        source: 'mock',
        title: 'No Genre',
        artist: 'Artist',
        genres: [],
        duration: 200,
        popularity: 50,
      }
      const result = scoreTracks([track])
      expect(result[0].scoring.totalScore).toBeGreaterThanOrEqual(0)
      expect(result[0].scoring.totalScore).toBeLessThanOrEqual(100)
    })

    it('should handle tracks with missing optional fields', () => {
      const track: InternalTrack = {
        id: 'minimal',
        source: 'mock',
        title: 'Minimal',
        artist: 'Artist',
        genres: [],
        duration: 0,
      }
      const result = scoreTracks([track])
      expect(result[0].scoring).toBeDefined()
      expect(result[0].scoring.totalScore).toBeGreaterThanOrEqual(0)
    })

    it('should handle extreme popularity values', () => {
      const lowPop: InternalTrack = {
        id: 'low',
        source: 'mock',
        title: 'Low',
        artist: 'A',
        genres: [],
        duration: 200,
        popularity: 1,
      }
      const highPop: InternalTrack = {
        id: 'high',
        source: 'mock',
        title: 'High',
        artist: 'B',
        genres: [],
        duration: 200,
        popularity: 100,
      }
      const result = scoreTracks([lowPop, highPop])
      expect(result[0].scoring.totalScore).toBeGreaterThanOrEqual(0)
      expect(result[1].scoring.totalScore).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('Recommendation Engine - Ranking', () => {
  describe('Deduplication', () => {
    it('should remove duplicate tracks by ID', () => {
      const track: InternalTrack = {
        id: 'dup',
        source: 'mock',
        title: 'Track',
        artist: 'Artist',
        genres: [],
        duration: 200,
      }
      const duplicated = [track, track, track]
      const result = rankTracks(duplicated, 10)
      const ids = result.map((r) => r.track.id)
      expect(ids.length).toBe(1)
      expect(ids[0]).toBe('dup')
    })
  })

  describe('Ranking Output', () => {
    it('should return ranked tracks with positions', () => {
      const tracks: InternalTrack[] = [
        { id: '1', source: 'mock', title: 'T1', artist: 'A', genres: [], duration: 200 },
        { id: '2', source: 'mock', title: 'T2', artist: 'B', genres: [], duration: 200 },
      ]
      const result = rankTracks(tracks, 10)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].position).toBe(1)
      if (result[1]) {
        expect(result[1].position).toBe(2)
      }
    })

    it('should return empty array for empty input', () => {
      const result = rankTracks([], 10)
      expect(result).toEqual([])
    })

    it('should respect limit parameter', () => {
      const tracks: InternalTrack[] = Array(20)
        .fill(0)
        .map((_, i) => ({
          id: `track_${i}`,
          source: 'mock' as const,
          title: `Track ${i}`,
          artist: `Artist ${i}`,
          genres: [],
          duration: 200,
        }))
      const result = rankTracks(tracks, 5)
      expect(result.length).toBeLessThanOrEqual(5)
    })

    it('should include reason in ranked results', () => {
      const track: InternalTrack = {
        id: 'test',
        source: 'mock',
        title: 'Test',
        artist: 'Artist',
        genres: ['rock'],
        duration: 200,
      }
      const result = rankTracks([track], 10)
      expect(result[0].reason).toBeDefined()
      expect(result[0].reason.length).toBeGreaterThan(0)
    })

    it('should sort by score descending', () => {
      const lowScore: InternalTrack = {
        id: 'low',
        source: 'mock',
        title: 'Low',
        artist: 'A',
        genres: [],
        duration: 200,
        popularity: 1,
      }
      const highScore: InternalTrack = {
        id: 'high',
        source: 'mock',
        title: 'High',
        artist: 'B',
        genres: [],
        duration: 200,
        popularity: 100,
      }
      const result = rankTracks([lowScore, highScore], 10)
      if (result.length > 1) {
        expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
      }
    })
  })

  describe('Artist Diversity Rules', () => {
    it('should handle multiple tracks from same artist', () => {
      const tracks: InternalTrack[] = [
        { id: '1', source: 'mock', title: 'T1', artist: 'ArtistA', genres: [], duration: 200, popularity: 90 },
        { id: '2', source: 'mock', title: 'T2', artist: 'ArtistA', genres: [], duration: 200, popularity: 85 },
        { id: '3', source: 'mock', title: 'T3', artist: 'ArtistA', genres: [], duration: 200, popularity: 80 },
        { id: '4', source: 'mock', title: 'T4', artist: 'ArtistB', genres: [], duration: 200, popularity: 75 },
      ]
      const result = rankTracks(tracks, 10)
      expect(result.length).toBeGreaterThan(0)
    })

    it('spaces tracks by the same artist and caps them at two', () => {
      const tracks: InternalTrack[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `a${i}`, source: 'mock' as const, title: `A${i}`, artist: 'ArtistA', genres: [], duration: 200,
          popularity: 100 - i,
        })),
        { id: 'b', source: 'mock', title: 'B', artist: 'ArtistB', genres: [], duration: 200 },
        { id: 'c', source: 'mock', title: 'C', artist: 'ArtistC', genres: [], duration: 200 },
        { id: 'd', source: 'mock', title: 'D', artist: 'ArtistD', genres: [], duration: 200 },
        { id: 'e', source: 'mock', title: 'E', artist: 'ArtistE', genres: [], duration: 200 },
      ]
      const result = rankTracks(tracks, 10)
      const positions = result.map((item) => item.track.artist).flatMap((artist, index) =>
        artist === 'ArtistA' ? [index] : [],
      )
      expect(positions).toHaveLength(2)
      expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(3)
    })
  })
})

describe('Recommendation Engine - Profile and public API', () => {
  it('returns defensive copies of profile arrays', () => {
    tasteProfile.recordTrackLiked('fav', ['jazz'], 'Artist')
    const profile = tasteProfile.getProfile()
    profile.favoriteGenres.push('mutated')
    expect(tasteProfile.getProfile().favoriteGenres).toEqual(['jazz'])
  })

  it('does not write seen history during calculation and keeps seen tracks eligible', () => {
    const tracks: InternalTrack[] = [
      { id: 'one', source: 'mock', title: 'One', artist: 'One Artist', genres: [], duration: 200 },
      { id: 'two', source: 'mock', title: 'Two', artist: 'Two Artist', genres: [], duration: 200 },
    ]
    const first = getRecommendations(tracks, { limit: 1 })
    expect(tasteProfile.hasSeenTrack(first[0].track.id)).toBe(false)
    RecommendationEngine.recordRecommendationsSeen([first[0].track.id])
    const second = getRecommendations(tracks, { limit: 5 })
    expect(second.map((item) => item.track.id)).toContain(first[0].track.id)
  })

  it('preserves a zero recommendation limit', () => {
    const result = RecommendationEngine.getRecommendations([
      { id: 'one', title: 'One', artist: 'A', genre: 'rock', duration: 180, plays: 1000 },
    ], { limit: 0 })
    expect(result).toEqual([])
  })

  it('maps provider data through the requested provider adapter', () => {
    const result = RecommendationEngine.getRecommendations([{
      id: 'provider-id', name: 'Provider Track', artists: [{ name: 'Provider Artist' }],
      duration_ms: 200000, album: { images: [{ url: 'https://example.test/art.jpg' }] },
    }], { source: 'spotify' })
    expect(result[0].track.id).toBe('spotify_provider-id')
    expect(result[0].track.source).toBe('spotify')
    expect(result[0].track.artist).toBe('Provider Artist')
    expect(result[0].track.duration).toBe(200)
  })

  it('applies seeded genre and artist filters before ranking', () => {
    const tracks: InternalTrack[] = [
      { id: 'rock', source: 'mock', title: 'Rock', artist: 'Elsewhere', genres: ['rock'], duration: 200 },
      { id: 'jazz', source: 'mock', title: 'Jazz', artist: 'Jazz Artist', genres: ['jazz'], duration: 200 },
    ]
    expect(getSeededRecommendations(tracks, ['rock'], []).map((item) => item.track.id)).toEqual(['rock'])
    expect(getSeededRecommendations(tracks, [], ['Jazz Artist']).map((item) => item.track.id)).toEqual(['jazz'])
  })

  it('keeps repeated recommendations stable until seen history is explicitly recorded', () => {
    const tracks: InternalTrack[] = [
      { id: 'one', source: 'mock', title: 'One', artist: 'One Artist', genres: [], duration: 200 },
      { id: 'two', source: 'mock', title: 'Two', artist: 'Two Artist', genres: [], duration: 200 },
    ]
    const first = getRecommendations(tracks)
    const second = getRecommendations(tracks)
    expect(second.map(({ track }) => track.id)).toEqual(first.map(({ track }) => track.id))
    expect(tasteProfile.getProfile().recentlySeenTrackIds).toEqual([])

    RecommendationEngine.recordRecommendationsSeen(first.map(({ track }) => track.id))
    expect(getRecommendations(tracks).map(({ track }) => track.id).sort()).toEqual(['one', 'two'])
  })

  it('routes seeded recommendations and filters through the requested adapter', () => {
    const spotify = [{
      id: 'seed', name: 'Seed', artists: [{ name: 'Seed Artist' }], genres: ['ambient'], duration_ms: 180000,
    }]
    const seeded = RecommendationEngine.getSeededRecommendations(spotify, ['ambient'], [], 'spotify')
    expect(seeded[0].track).toMatchObject({ id: 'spotify_seed', source: 'spotify', artist: 'Seed Artist' })

    const soundcloud = [{ id: 7, title: 'Cloud Track', user: { username: 'Cloud Artist' }, duration: 240000 }]
    const filtered = RecommendationEngine.filterCandidates(soundcloud, { sources: ['soundcloud'] }, 'soundcloud')
    expect(filtered[0]).toMatchObject({ id: 'soundcloud_7', source: 'soundcloud', artist: 'Cloud Artist' })
  })

  it('filters and merges normalized candidates across sources', () => {
    const mock = buildCandidatesFromMock([
      { id: 'mock-1', title: 'Shared Song', artist: 'Same Artist', genre: 'rock', duration: 180, plays: 90000 },
      { id: 'mock-2', title: 'Other Song', artist: 'Other Artist', genre: 'jazz', duration: 220, plays: 20000 },
    ])
    const spotify = buildCandidatesFromSpotify([{
      id: 'provider-1', name: 'Shared Song', artists: [{ name: 'Same Artist' }], duration_ms: 180000,
    }])
    expect(RecommendationEngine.filterCandidates(mock, { genres: ['rock'], minDuration: 120 })).toHaveLength(1)
    expect(mergeCandidates(mock, spotify).map(({ title }) => title)).toEqual(['Shared Song', 'Other Song'])
  })

  it('rebuilds derived genres and artists when a like is removed', () => {
    tasteProfile.recordTrackLiked('first', ['rock', 'indie'], 'Shared Artist')
    tasteProfile.recordTrackLiked('second', ['rock'], 'Shared Artist')
    RecommendationEngine.recordUnlike('first', [{ id: 'second', genres: ['rock'], artist: 'Shared Artist' }])
    expect(tasteProfile.getProfile()).toMatchObject({
      favoriteGenres: ['rock'],
      favoriteArtists: ['Shared Artist'],
      likedTrackIds: ['second'],
    })

    RecommendationEngine.recordUnlike('second')
    expect(tasteProfile.getProfile().favoriteGenres).toEqual([])
    expect(tasteProfile.getProfile().favoriteArtists).toEqual([])
  })

  it('persists seen history in most-recent-first order and caps it at 50', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    const manager = new TasteProfileManager()
    for (let i = 0; i < 60; i++) manager.recordTrackSeen(`track-${i}`)
    manager.recordTrackSeen('track-50')

    const persisted = new TasteProfileManager().getProfile().recentlySeenTrackIds
    expect(persisted).toHaveLength(50)
    expect(persisted[0]).toBe('track-50')
    expect(persisted).not.toContain('track-0')
    expect(persisted[1]).toBe('track-59')
  })

  it('explains an actual genre match rather than the first unrelated genre', () => {
    tasteProfile.recordTrackLiked('liked', ['rock'], 'Favorite Artist')
    const track: InternalTrack = {
      id: 'candidate', source: 'mock', title: 'Candidate', artist: 'Other Artist',
      genres: ['ambient', 'rock'], duration: 180,
    }
    expect(explainRecommendation(track, [track])).toBe('Similar genre: rock')
  })

  it('explains an exact favorite-artist match', () => {
    tasteProfile.recordTrackLiked('liked', [], 'Favorite Artist')
    const track: InternalTrack = {
      id: 'candidate', source: 'mock', title: 'Candidate', artist: 'Favorite Artist', genres: [], duration: 180,
    }
    expect(explainRecommendation(track, [track])).toBe('Artist you like: Favorite Artist')
  })

  it('explains a new release when novelty has the strongest weighted contribution', () => {
    const track: InternalTrack = {
      id: 'new', source: 'mock', title: 'New Track', artist: 'New Artist', genres: [], duration: 180, isNew: true,
    }
    expect(explainRecommendation(track, [track])).toBe('New release')
  })

  it('does not claim genre or artist matches without matching preferences', () => {
    const track: InternalTrack = {
      id: 'unmatched', source: 'mock', title: 'Unmatched', artist: 'Unknown', genres: ['ambient'], duration: 180,
    }
    expect(explainRecommendation(track, [track])).toBe('Recommended for you')

    tasteProfile.recordTrackLiked('liked', ['rock'], 'Favorite Artist')
    expect(explainRecommendation(track, [track])).toBe('Outside your favorite artists')
  })

  it('increases scores for exact liked genre and artist metadata', () => {
    const peer: InternalTrack = {
      id: 'peer', source: 'mock', title: 'Peer Track', artist: 'Comet Arcade',
      genres: ['synthwave'], duration: 200,
    }
    const baseline = scoreTrack(peer, [peer]).totalScore

    RecommendationEngine.setTrackFeedback('seed', 'like', {
      title: 'Seed Track', artist: 'Synthwave Master', genres: ['synthwave'],
    })
    const afterLike = scoreTrack(peer, [peer])

    expect(afterLike.totalScore).toBeGreaterThan(baseline)
    expect(afterLike.reason).toBe('Similar genre: synthwave')
  })

  it('lowers scores for disliked metadata and excludes the exact disliked track', () => {
    const disliked: InternalTrack = {
      id: 'disliked', source: 'mock', title: 'Disliked', artist: 'Synthwave Master',
      genres: ['synthwave'], duration: 200,
    }
    const peer: InternalTrack = {
      id: 'peer', source: 'mock', title: 'Peer', artist: 'Comet Arcade',
      genres: ['synthwave'], duration: 200,
    }
    const baseline = scoreTrack(peer, [disliked, peer]).totalScore
    RecommendationEngine.setTrackFeedback('disliked', 'dislike', {
      title: 'Disliked', artist: 'Synthwave Master', genres: ['synthwave'],
    })

    const afterDislike = scoreTrack(peer, [disliked, peer])
    expect(afterDislike.totalScore).toBeLessThan(baseline)
    expect(afterDislike.reason).toBe('Lower priority: disliked genre synthwave')
    expect(getRecommendations([disliked, peer]).map(({ track }) => track.id)).toEqual(['peer'])
  })

  it('balances contradictory genre feedback from different tracks without crashing', () => {
    const peer: InternalTrack = {
      id: 'peer', source: 'mock', title: 'Peer', artist: 'Unrated Artist', genres: ['synthwave'], duration: 200,
    }
    RecommendationEngine.setTrackFeedback('liked-seed', 'like', {
      title: 'Liked Seed', artist: 'Artist One', genres: ['synthwave'],
    })
    RecommendationEngine.setTrackFeedback('disliked-seed', 'dislike', {
      title: 'Disliked Seed', artist: 'Artist Two', genres: ['synthwave'],
    })

    expect(scoreTrack(peer, [peer]).genreScore).toBe(50)
    expect(getRecommendations([peer])).toHaveLength(1)
  })

  it('skips only the selected track without changing similar-track preference scores', () => {
    const skipped: InternalTrack = {
      id: 'skipped', source: 'mock', title: 'Skipped', artist: 'Synthwave Master',
      genres: ['synthwave'], duration: 200,
    }
    const peer: InternalTrack = {
      id: 'peer', source: 'mock', title: 'Peer', artist: 'Comet Arcade',
      genres: ['synthwave'], duration: 200,
    }
    const before = scoreTrack(peer, [skipped, peer]).totalScore
    RecommendationEngine.setTrackFeedback('skipped', 'skip', {
      title: 'Skipped', artist: 'Synthwave Master', genres: ['synthwave'],
    })

    expect(scoreTrack(peer, [skipped, peer]).totalScore).toBe(before)
    expect(getRecommendations([skipped, peer]).map(({ track }) => track.id)).toEqual(['peer'])
    expect(tasteProfile.getProfile().dislikedGenres).toEqual([])
  })

  it('persists feedback for reload, updates one state per track, and supports undo', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    const manager = new TasteProfileManager()
    manager.setTrackFeedback('track-1', 'skip', { title: 'Track One', artist: 'Artist', genres: ['indie'] })
    const afterSkipReload = new TasteProfileManager()
    expect(afterSkipReload.getFeedback('track-1')?.action).toBe('skip')
    expect(afterSkipReload.getProfile().skippedTrackIds).toEqual(['track-1'])

    afterSkipReload.setTrackFeedback('track-1', 'dislike', {
      title: 'Track One', artist: 'Artist', genres: ['indie'],
    })
    const reloaded = new TasteProfileManager()
    expect(reloaded.getFeedback('track-1')).toEqual({
      action: 'dislike', title: 'Track One', artist: 'Artist', genres: ['indie'],
    })
    expect(reloaded.getProfile().feedbackByTrack).toHaveProperty('track-1')
    expect(Object.keys(reloaded.getProfile().feedbackByTrack)).toHaveLength(1)
    expect(reloaded.getProfile().skippedTrackIds).toEqual([])
    reloaded.setTrackFeedback('track-1', null)
    expect(new TasteProfileManager().getProfile().feedbackByTrack).toEqual({})
  })

  it('validates malformed stored preferences and tolerates tracks with missing metadata', () => {
    const values = new Map<string, string>([[
      'soundcloud_taste_profile', JSON.stringify({
        feedbackByTrack: {
          invalid: { action: 'hate', artist: 42, genres: 'rock' },
          valid: { action: 'like', artist: 'Artist', genres: ['rock', 42] },
        },
      }),
    ]])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    const manager = new TasteProfileManager()
    const incomplete: InternalTrack = {
      id: 'incomplete', source: 'mock', title: '', artist: '', genres: [], duration: 0,
    }

    expect(manager.getProfile().feedbackByTrack).toEqual({
      valid: { action: 'like', title: '', artist: 'Artist', genres: ['rock'] },
    })
    expect(() => scoreTrack(incomplete, [], manager.getProfile())).not.toThrow()
    expect(() => rankTracks([], 10, manager.getProfile())).not.toThrow()
  })
})
