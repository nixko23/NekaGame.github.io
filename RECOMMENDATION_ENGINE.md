# Recommendation Engine Architecture

**Version**: 1.0  
**Date**: October 24, 2026  
**Status**: ✅ Complete and Integrated  

---

## Overview

The Recommendation Engine is the central abstraction of SoundCloud Discovery. It is **provider-independent** and designed to work with any music data source (mock data, Spotify, SoundCloud, Last.fm, etc.) without coupling to external APIs.

The engine works entirely with mock data in the current MVP but is architected so real providers can plug in seamlessly in future phases.

---

## Architecture

### Core Modules

```
src/recommendation/
├── index.ts              # Main API and RecommendationEngine class
├── types.ts              # InternalTrack model (decoupled from external APIs)
├── tasteProfile.ts       # User preferences and rendered-impression history
├── scoring.ts            # Explainable scoring formula (0-100)
├── ranking.ts            # Ranking rules and deduplication
└── candidateBuilder.ts   # Convert external formats to internal tracks
```

### Data Flow

```
External Data
(Mock, Spotify, Last.fm, SoundCloud)
        ↓
candidateBuilder.ts
(Normalize to InternalTrack)
        ↓
tasteProfile.ts
(Load user preferences)
        ↓
scoring.ts
(Calculate score: 0.35 genre + 0.30 artist + 0.20 novelty + 0.15 diversity)
        ↓
ranking.ts
(Apply rules: dedup, seen-track novelty penalty, artist spacing/count)
        ↓
RankedTrack[] with reasons
("Similar genre", "Lower priority: disliked genre ...", etc.)
        ↓
React UI
(Display with recommendation badge)
```

---

## Key Components

### 1. InternalTrack Model

**Purpose**: Provider-independent representation of a track

**Fields**:
- `id`: Unique internal ID (e.g., "spotify_123", "soundcloud_456")
- `source`: Data source ('mock' | 'spotify' | 'soundcloud' | 'lastfm')
- `title`, `artist`, `genres[]`, `duration`, `popularity`
- `artwork`: Album image URL
- `externalUrl`: Link to provider (Spotify, SoundCloud, etc.)
- `mood`, `energy`, `danceability`: Optional audio features (for future providers)

**Conversion Functions**:
- `toInternalTrack()`: External → Internal
- `toDisplayTrack()`: Internal → Display format

**Why It Matters**: The engine never depends on provider-specific data structures. All providers map to InternalTrack, so the recommendation logic is truly provider-agnostic.

---

### 2. Taste Profile

**Purpose**: Track user preferences for personalized recommendations

**Stored Data** (persisted to localStorage):
- `feedbackByTrack`: One current like, skip, or dislike per track, with title/artist/genre metadata for ranking and undo
- `favoriteGenres[]` and `favoriteArtists[]`: Derived from explicit likes
- `dislikedGenres[]`: Derived from current dislikes (plus any legacy values when loading old profile data)
- `likedTrackPreferences`: Compatibility view of explicit likes, rebuilt when feedback changes
- `recentlySeenTrackIds[]`: Up to 50 track IDs most recently rendered in Discover, newest first
- `likedTrackIds[]` and `skippedTrackIds[]`: Derived ID lists for compatibility and exact-track suppression

**Key Methods**:
- `setTrackFeedback(trackId, action, metadata)`: Set or clear one mutually exclusive feedback state
- `recordTrackLiked(trackId, genres, artist)`: Compatibility method for explicit positive feedback
- `recordTrackUnliked(trackId)`: Compatibility method for clearing a like; App favorites no longer call it
- `recordTrackSeen(trackId)`: Track shown to user
- `getTopGenres(limit)`: User's favorite genres
- `getTopArtists(limit)`: User's favorite artists

**Lifecycle**: Created on app start and persisted to localStorage. Feedback controls save one action per track, so changing Like to Skip or Dislike replaces the old state instead of appending duplicate history. The Feedback tab lets the user update or undo saved feedback. Favorites use their own localStorage key and do not change recommendation preferences.

`recentlySeenTrackIds` is view/impression history, not listening history. Playback is disabled, so the app does not know which tracks were listened to. Seen history is written from an effect after Discover recommendations render, never as part of ranking/render calculation.

---

### 3. Scoring Formula

**Explainable, Tunable, Provider-Independent**

```
Score = (0.35 × GenreScore) + (0.30 × ArtistScore) + (0.20 × NoveltyScore) + (0.15 × DiversityScore)

Each component: 0-100
Total score: 0-100
```

#### GenreScore (35% weight)
- Starts at neutral 50 for unknown/empty history
- Uses exact, case-insensitive genre matches in explicit likes and dislikes
- One net like raises a match to 100; one net dislike lowers it to 15; conflicting same-genre feedback offsets to neutral
- Multi-genre tracks average their known genre signals so one liked tag does not dominate

#### ArtistScore (30% weight)
- Starts at neutral 50 when artist/history is missing
- Exact artist likes raise relevance; exact artist dislikes lower it; contradictory signals offset
- Artist and genre signals remain bounded by the existing 35% and 30% scoring weights

#### NoveltyScore (20% weight)
- 90 for new releases (`track.isNew`)
- 70 for popular/trending tracks
- 20 if track was recently shown to user
- 50 for unknown tracks

#### DiversityScore (15% weight)
- 30 if artist already has 3+ tracks in recent (avoid repetition)
- 50 if artist has 2 tracks recently
- 70 if artist has 1 track recently
- 100 if artist not recently seen (good diversity)

#### Why This Formula?
- **Explainable**: Each component has clear meaning ("Similar genre", "New artist", etc.)
- **Tunable**: Weights can be adjusted per user or A/B tested
- **Balanced**: Mixes preference matching with discovery
- **Provider-agnostic**: Works with any track metadata

---

### 4. Ranking Rules

**Applied After Scoring**

1. **Deduplication**: Remove exact duplicates by ID
2. **Feedback suppression**: Exclude exact skipped and disliked track IDs; likes remain eligible
3. **Seen-track policy**: Keep previously seen candidates eligible but lower their NoveltyScore to 20
4. **Artist count/spacing**: Prefer at most 2 tracks per artist and 3-position spacing; when a filtered catalog has no eligible alternative, relax spacing so candidates are not silently lost, while retaining the count limit
5. **Sort by score**: Highest-scoring eligible candidate first

`getRecommendations()` is pure with respect to profile history. Call `recordRecommendationsSeen(trackIds)` only after recommendations have rendered to the user. Discover uses a memoized calculation and a React effect for this update, so re-rendering does not erase the current list.

Explanations name exact metadata signals from feedback: a matching liked or disliked genre or artist. No artist/genre relationship is inferred. Generic novelty/diversity explanations use only track flags, popularity, and seen-artist metadata. Disliked and skipped exact tracks are suppressed from Discover; dislikes affect similar catalog items only through exact artist/genre matches. Explanations do not claim that playback occurred.

**Why These Rules?**
- Prevents boring repetition
- Ensures discovery variety
- Maintains artist balance
- Generates consistent, high-quality recommendations

---

### 5. Candidate Builder

**Purpose**: Convert external data to recommendation candidates

**Provider-Specific Functions**:
- `buildCandidatesFromMock(mockTracks)`: Mock → InternalTrack[]
- `buildCandidatesFromSpotify(spotifyTracks)`: Spotify response → InternalTrack[]
- `buildCandidatesFromLastfm(lastfmTracks)`: Last.fm response → InternalTrack[]
- `buildCandidatesFromSoundcloud(soundcloudTracks)`: SoundCloud response → InternalTrack[]

**Filter Support**:
```typescript
filterCandidates(tracks, {
  genres: ['synthwave', 'lofi'],
  minDuration: 60,
  maxDuration: 600,
  minPopularity: 40,
  sources: ['mock', 'spotify'],
  excludeTrackIds: ['track_1', 'track_2']
})
```

**Merge Support**: Combine recommendations from multiple providers

---

## Scoring Breakdown Example

**User's Profile**:
- Favorite genres: ["synthwave", "lofi"]
- Favorite artists: ["Synthwave Master", "Chill Vibes"]
- Recently seen: ["track_1", "track_2"]

**Track to Score**: "Neon Dreams" by "Synthwave Master" (synthwave genre)

**Scoring**:
- **GenreScore**: 95 (genre "synthwave" is favorite)
- **ArtistScore**: 100 (artist "Synthwave Master" is favorite)
- **NoveltyScore**: 60 (not new, not recently seen, moderate popularity)
- **DiversityScore**: 70 (artist has 1 recent track)

**Calculation**:
```
Score = (0.35 × 95) + (0.30 × 100) + (0.20 × 60) + (0.15 × 70)
      = 33.25 + 30 + 12 + 10.5
      = 85.75 → 86/100
```

**Reason**: "Artist you like: Synthwave Master" (ArtistScore was highest)

---

## RecommendationEngine API

### Main Entry Point

```typescript
import RecommendationEngine from './recommendation'

// Get personalized recommendations
const ranked = RecommendationEngine.getRecommendations(tracks, {
  limit: 50,
})

// Each result includes:
// {
//   track: InternalTrack,
//   score: 86,
//   reason: "Artist you like: Synthwave Master",
//   position: 1
// }
```

### User Interaction Tracking

```typescript
// Record favorite
RecommendationEngine.recordLike('track_id', ['synthwave'], 'Synthwave Master')

// Record unfavorite
RecommendationEngine.recordUnlike('track_id')

// After rendering a recommendation list, record view impressions explicitly
RecommendationEngine.recordRecommendationsSeen(ranked.map(({ track }) => track.id))

// Provider conversion is selected explicitly; the default source is mock.
RecommendationEngine.getRecommendations(spotifyTracks, { source: 'spotify' })

// Get user's taste profile
const taste = RecommendationEngine.getUserTaste()
// { favoriteGenres: [...], favoriteArtists: [...], ... }

// Reset for testing
RecommendationEngine.reset()
```

### Seed-Based Recommendations (Future)

```typescript
// Useful for "Similar to X" features
const similar = RecommendationEngine.getSeededRecommendations(
  allTracks,
  ['synthwave', 'lofi'],  // seed genres
  ['Synthwave Master']     // seed artists
)
```

---

## Future Provider Integration Points

### Phase 1: Spotify Integration

**Files to Add/Modify**:
```
src/services/spotifyApi.ts          # Spotify API client
src/recommendation/providers/spotify.ts # Spotify-specific logic
```

**Integration**:
```typescript
import { buildCandidatesFromSpotify } from './recommendation'

// Fetch from Spotify
const spotifyResults = await spotifyApi.search('indie')

// Convert to candidates
const candidates = buildCandidatesFromSpotify(spotifyResults)

// Get recommendations
const ranked = RecommendationEngine.getRecommendations(candidates)
```

**What Changes?**
- Nothing in the core engine
- Only how data enters the system
- The scoring and ranking remain unchanged
- Taste profile persists across providers

### Phase 2: Last.fm Integration

Similar to Spotify:
```typescript
const lastfmResults = await lastfmApi.searchSimilarArtists('Synthwave Master')
const candidates = buildCandidatesFromLastfm(lastfmResults)
```

### Phase 3+: Hybrid Recommendations

```typescript
const spotifyTracks = buildCandidatesFromSpotify(spotifyResults)
const lastfmTracks = buildCandidatesFromLastfm(lastfmResults)

const merged = mergeCandidates(spotifyTracks, lastfmTracks)
const ranked = RecommendationEngine.getRecommendations(merged)
```

---

## Testing the Engine

### Current State (Mock Data)

1. **Favorite some tracks** → Recommendation engine learns preferences
2. **View Discover tab** → Tracks ranked by recommendation score
3. **Hover track** → See recommendation reason badge
4. **Refresh page** → Favorites persist, recommendations adapt

### Testing Manually

```typescript
// In browser console
import RecommendationEngine from './recommendation'

// Get current taste
console.log(RecommendationEngine.getUserTaste())

// Reset for clean test
RecommendationEngine.reset()

// Get recommendations with scores
const result = RecommendationEngine.getRecommendations(
  mockTracks,
  { limit: 50 }
)
console.table(result)
```

---

## Performance

### Current (6 tracks)
- Scoring: <1ms
- Ranking: <1ms
- Total: <2ms

### Projected (1000 tracks)
- Scoring: ~50-100ms
- Ranking: ~10-20ms
- Total: ~100ms (acceptable)

### Optimization Opportunities
- Cache scores for unchanged tracks
- Lazy evaluation of low-scoring tracks
- Batch processing with Web Workers (future)

---

## Limitations & Future Work

### Current MVP Limitations
- Mock data only (no real provider yet)
- No audio features from API (energy, danceability calculated from popularity)
- No collaborative filtering
- No machine learning
- No playlist generation

### Future Enhancements
1. **Audio Features** (Phase 2+)
   - Use Spotify audio features for better GenreScore
   - Add mood detection

2. **Collaborative Filtering** (Phase 3+)
   - "Users who liked X also liked Y"
   - Community-based recommendations

3. **Personalization Learning** (Phase 4+)
   - Track skip reasons
   - Adjust weights per user
   - A/B test different formulas

4. **Playlist Generation** (Phase 5+)
   - Create themed playlists
   - Flow matching (energy, mood transitions)

---

## Design Principles

1. **Provider Independence**: No single API is required
2. **Explainability**: Every recommendation has a reason
3. **User Control**: Taste profile visible and resetable
4. **Performance**: <100ms for 1000 tracks
5. **Simplicity**: No ML required; rule-based scoring
6. **Transparency**: Scoring formula public and tunable

---

## Code Organization

### Key Files

- **types.ts**: `InternalTrack`, `ScoreBreakdown`, conversion functions
- **tasteProfile.ts**: User preference storage and updates
- **scoring.ts**: `scoreTrack()`, `scoreTracks()`, scoring formula
- **ranking.ts**: `rankTracks()`, `getRecommendations()`, ranking rules
- **candidateBuilder.ts**: Provider conversion functions
- **index.ts**: `RecommendationEngine` class and public API

### Exports

Public API accessible from:
```typescript
import RecommendationEngine from './recommendation'
import type { InternalTrack, ScoreBreakdown, RankedTrack } from './recommendation'
```

---

## Summary

The Recommendation Engine is a lightweight, explainable, provider-independent system for personalized music discovery. It works entirely with mock data today but is designed to accept Spotify, Last.fm, SoundCloud, or any future provider without code changes to the core engine.

**Key Strengths**:
- ✅ No external dependencies in MVP
- ✅ Provider-agnostic design
- ✅ Explainable scoring (users see why each track is recommended)
- ✅ Lightweight and fast
- ✅ User preferences persist
- ✅ Easy to test and tune

**Ready for**: Additional UI and adapter tests; provider integration remains deferred

---

**Status**: Core mock-data engine audited; no provider API integrated  
**Automated tests**: 40 passing across `src/recommendation.test.ts` and `src/App.test.tsx`  
**Coverage includes**: scoring and explanations, ranking/deduplication/diversity, pure repeated calculations, explicit seen-history policy and persistence cap/order, like/unlike preference provenance, provider routing, filtering/merging, Discover cards after state changes, navigation, favorite selection/empty states/reload state, and missing/malformed favorite storage.  
**Not covered**: Last.fm adapter conversion, remaining search/genre-filter UI paths, skip/dislike behavior (not implemented), audio/listening history (playback unavailable), or live provider APIs.  
**Test environment**: Vitest + jsdom + React Testing Library + user-event. The app tests run under React StrictMode.  
