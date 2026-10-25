# Minimal First Integration Milestone — SoundCloud Discovery

**Date**: October 24, 2026  
**Milestone**: Real Spotify Track Search  
**Scope**: Search works, displays real results from Spotify with external links  
**Estimated Duration**: 4-6 hours (backend + frontend integration)  
**Success Criteria**: Users can search for music and see real Spotify results

---

## Executive Summary

**What the user will do**:
1. Type "indie rock" in search box
2. See real Spotify tracks (title, artist, image, duration)
3. Click track to view on Spotify
4. Favorites still work locally

**What we're NOT doing yet**:
- User authentication or "save to Spotify library"
- Recommendations (seeding)
- Last.fm or SoundCloud integration
- Playback (stays disabled)
- Genre filtering against real data

**Why Spotify First**:
- Best search quality
- Recommendations easy to add later
- No user login required for search
- Clear terms for non-commercial use
- Well-documented API

---

## 1. User Flow — Search

```
User opens app
        ↓
[Discover tab, Search bar]
        ↓
User types "indie rock"
        ↓
SearchBar component sends query to backend:
  POST /api/search
  { query: "indie rock", source: "spotify" }
        ↓
Backend:
  1. Get Spotify access token (or refresh if expired)
  2. Call Spotify API: /v1/search?q=indie%20rock&type=track
  3. Extract track data
  4. Return to frontend (10 results)
        ↓
Frontend receives response:
  [
    { id: "spotify_123", title: "...", artist: "...", image: "...", duration: 240, url: "..." },
    { id: "spotify_124", title: "...", ... },
    ...
  ]
        ↓
React updates state, displays tracks
        ↓
User sees real Spotify tracks instead of mocks
        ↓
User clicks heart icon → Added to Favorites (localStorage, as before)
        ↓
User clicks track card → Shows tooltip "Open on Spotify" + link
```

---

## 2. API Operations Required

### From Spotify

**Endpoint 1: Get Access Token** (backend only)
```
POST https://accounts.spotify.com/api/token
Body: grant_type=client_credentials
Headers: Authorization: Basic {base64(client_id:client_secret)}

Response:
{
  "access_token": "BQD...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Endpoint 2: Search Tracks** (backend calls, frontend receives)
```
GET https://api.spotify.com/v1/search?q={query}&type=track&limit=10
Headers: Authorization: Bearer {access_token}

Response:
{
  "tracks": {
    "items": [
      {
        "id": "123abc",
        "name": "Song Title",
        "artists": [{ "name": "Artist Name" }],
        "duration_ms": 240000,
        "album": {
          "images": [{ "url": "https://..." }]
        },
        "external_urls": {
          "spotify": "https://open.spotify.com/track/123abc"
        }
      },
      ...
    ]
  }
}
```

### Data Extraction (Backend Responsibility)

Backend converts Spotify response to frontend format:

```javascript
// Input: Spotify track object
{
  id: "spotify_123",
  name: "Indie Song",
  artists: [{ name: "Indie Band" }],
  duration_ms: 240000,
  album: { images: [...] },
  external_urls: { spotify: "https://open.spotify.com/track/..." }
}

// Output: Sanitized for frontend
{
  id: "spotify_123",
  title: "Indie Song",
  artist: "Indie Band",
  duration: 240,
  plays: null,              // Not available from Spotify search
  image: "https://...",
  genre: null,              // Will need to derive from search term or skip
  isFavorite: false,        // From localStorage
  sourceUrl: "https://open.spotify.com/track/..."
}
```

---

## 3. Required Data Fields

### Track Card Display
| Field | Source | Purpose |
|-------|--------|---------|
| **id** | Spotify track ID | Identify track uniquely |
| **title** | Spotify track.name | Display title |
| **artist** | Spotify artists[0].name | Display artist |
| **duration** | Spotify duration_ms / 1000 | Show "4:00" format |
| **image** | Spotify album.images[0].url | Show album art |
| **sourceUrl** | Spotify external_urls.spotify | "Open on Spotify" link |
| **isFavorite** | localStorage | Heart icon state |

### Missing vs. Mock Data
| Field | Mock | Spotify | Solution |
|-------|------|---------|----------|
| **genre** | Available | Not in search | Use search term as tag |
| **plays** | Available (125K, etc.) | Not available | Show "No play data" or skip |
| **preview_url** | None | Available | Save for future audio preview |

---

## 4. Backend Implementation Outline

### File: `server/server.js` (Entry Point)
```javascript
const express = require('express');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(require('cors')());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30                // 30 requests per minute per user
});

// Routes
app.post('/api/search', limiter, require('./routes/search'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3001, () => console.log('Backend running on :3001'));
```

### File: `server/services/spotifyService.js` (Token + API)
```javascript
const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post('https://accounts.spotify.com/api/token', 
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000);
  return cachedToken;
}

async function searchTracks(query) {
  const token = await getAccessToken();

  const response = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      q: query,
      type: 'track',
      limit: 10
    }
  });

  return response.data.tracks.items.map(track => ({
    id: `spotify_${track.id}`,
    title: track.name,
    artist: track.artists[0].name,
    duration: Math.floor(track.duration_ms / 1000),
    image: track.album.images[0]?.url,
    sourceUrl: track.external_urls.spotify,
    genre: null,  // Not available from search
    plays: null   // Not available from search
  }));
}

module.exports = { searchTracks };
```

### File: `server/routes/search.js` (API Endpoint)
```javascript
const { searchTracks } = require('../services/spotifyService');

async function searchHandler(req, res) {
  try {
    const { query, source } = req.body;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    if (source === 'spotify') {
      const tracks = await searchTracks(query);
      return res.json({ tracks });
    }

    res.status(400).json({ error: 'Invalid source' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
}

module.exports = searchHandler;
```

---

## 5. Frontend Integration

### File: `src/App.tsx` (Modified SearchBar handling)

```typescript
const [useRealData, setUseRealData] = useState(false);

const handleSearch = async (query: string) => {
  setIsLoading(true);
  
  try {
    if (useRealData) {
      // Call backend for real Spotify data
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, source: 'spotify' })
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setTracks(data.tracks);
    } else {
      // Use mock data (current behavior)
      if (query.trim()) {
        const filtered = mockTracks.filter(track =>
          track.title.toLowerCase().includes(query.toLowerCase()) ||
          track.artist.toLowerCase().includes(query.toLowerCase())
        );
        setTracks(filtered);
      } else {
        setTracks(mockTracks);
      }
    }
  } catch (error) {
    console.error('Search error:', error);
    setTracks([]);
  } finally {
    setIsLoading(false);
  }
};
```

### File: `src/components/TrackCard.tsx` (Show Spotify link)

```typescript
return (
  <div className="track-card">
    <div className="track-image-container">
      <img src={track.image} alt={track.title} className="track-image" />
      
      {/* Favorite button */}
      <button
        className={`favorite-button ${track.isFavorite ? 'active' : ''}`}
        onClick={() => onToggleFavorite(track.id)}
      >
        {track.isFavorite ? '❤️' : '🤍'}
      </button>

      {/* Open on Spotify link (if sourceUrl available) */}
      {track.sourceUrl && (
        <a
          href={track.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="play-button"
          title="Open on Spotify"
        >
          🔗
        </a>
      )}
    </div>

    <div className="track-info">
      <h3 className="track-title">{track.title}</h3>
      <p className="track-artist">{track.artist}</p>
      <div className="track-meta">
        {track.genre && <span className="genre-badge">{track.genre}</span>}
        <span className="duration">{formatDuration(track.duration)}</span>
      </div>
      {track.plays && (
        <div className="track-stats">
          <span className="plays">🎧 {formatPlays(track.plays)} plays</span>
        </div>
      )}
    </div>
  </div>
);
```

### File: `vite.config.ts` (Proxy backend)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
});
```

---

## 6. Setup Prerequisites

### Before Implementation

**1. Get Spotify Developer Credentials**

1. Go to [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create an account or sign in
3. Create an application (name: "SoundCloud Discovery")
4. Accept terms
5. Copy **Client ID** and **Client Secret**

**2. Create Backend `.env` File**

```bash
# server/.env (do NOT commit to git)
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
PORT=3001
NODE_ENV=development
```

**3. Create `.env.example` (Safe to commit)**

```bash
# server/.env.example (template, safe to commit)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
PORT=3001
NODE_ENV=development
```

**4. Update `.gitignore`**

```
.env
.env.local
server/.env
```

---

## 7. Testing Checklist

### Pre-Launch Tests

| Test | Command | Expected |
|------|---------|----------|
| **Backend starts** | `cd server && npm run dev` | Listening on :3001 |
| **Frontend proxy works** | `npm run dev` in root | Frontend loads |
| **Health check** | `curl http://localhost:3001/health` | `{"status":"ok"}` |
| **Spotify token obtained** | Check server logs | "Token cached" or similar |
| **Search works (real data)** | Enable toggle, search "indie" | 10 real tracks appear |
| **Favorites still work** | Click heart on track | Heart changes color, updates counter |
| **Spotify link works** | Click track card link | Opens on Spotify.com |
| **Rate limit works** | Send 31 requests in 60s | 31st returns 429 |
| **Error handling** | Disable internet, search | Shows error message |

### Manual User Testing

1. **Happy Path**:
   - [ ] Type "indie rock"
   - [ ] See real Spotify results
   - [ ] Click heart → add to favorites
   - [ ] Refresh page → favorites persist
   - [ ] Click Spotify link → opens in new tab

2. **Edge Cases**:
   - [ ] Search with 1 character → no results (backend validation)
   - [ ] Search with special chars `@#$` → handled or escapes
   - [ ] Very long query (100+ chars) → handled gracefully
   - [ ] Empty search → shows mock data or clears

3. **Backend Resilience**:
   - [ ] Spotify API down → shows error to user
   - [ ] Token expires mid-session → transparently refreshes
   - [ ] Rate limited → shows retry message

---

## 8. Acceptance Criteria

### Functional
- ✅ User can toggle "Use Real Data" and see switch between mock and Spotify
- ✅ Spotify search returns 10 results for common queries
- ✅ Results display title, artist, album art, duration
- ✅ Each result has a clickable link to Spotify
- ✅ Favorites still work (heart icon, localStorage persistence)
- ✅ Favorites counter updates correctly

### Technical
- ✅ Backend handles Spotify OAuth2 token refresh
- ✅ Rate limiting prevents abuse (30 req/min per user)
- ✅ Errors logged server-side, shown gracefully to user
- ✅ Frontend code passes lint and TypeScript checks
- ✅ No API credentials exposed in frontend code

### Performance
- ✅ Search returns within 1 second
- ✅ No network requests block UI
- ✅ Mock data toggle is instant

### Security
- ✅ `CLIENT_SECRET` never sent to browser
- ✅ `.env` file never committed to git
- ✅ API key in `server/.env.example` only (empty value)

---

## 9. Fallback if Spotify API Unavailable

If Spotify API cannot be accessed or terms change:

1. **Switch to Last.fm** (simpler auth, API key only)
   - Get API key at [https://www.last.fm/api](https://www.last.fm/api)
   - Use `track.search` method instead
   - Loss: No rich album art URLs, less metadata
   - Gain: Simpler integration, fewer auth complications

2. **Hybrid Approach** (Spotify + Last.fm fallback)
   - Try Spotify first
   - If Spotify fails or rate-limited, fall back to Last.fm
   - Requires both services registered

3. **Stay on Mock Data**
   - Continue with expanded mock data (20-50 tracks instead of 6)
   - Add sorting/filtering features
   - Ship as "Demo Mode" product

---

## 10. After This Milestone

### What's Next (Phase 3)
1. Add Spotify recommendations (seed-based)
2. Integrate Last.fm for similar artists
3. Add user authentication (optional; Spotify login for saved likes)
4. Implement real audio preview (Spotify preview URLs)
5. Add genre from metadata, not search terms

### Timeline
- **Now**: This milestone (4-6 hours)
- **+2 days**: Review, QA, fix bugs
- **+3 days**: Add Last.fm similar artists
- **+4 days**: User auth + saved preferences
- **+1 week**: Full MVP with real data

---

## 11. Files to Create/Modify

### New Files
```
server/
├── package.json           (npm init -y)
├── .env                   (credentials, not committed)
├── .env.example           (template, committed)
├── server.js              (Express app)
├── routes/
│   └── search.js          (Search endpoint)
└── services/
    └── spotifyService.js  (Token + search logic)
```

### Modified Files
```
src/
├── App.tsx                (handleSearch calls backend)
├── components/
│   └── TrackCard.tsx      (Show Spotify link if available)
├── vite.config.ts         (Add proxy for /api)
├── .gitignore             (.env entries)
└── types.ts               (Add sourceUrl to Track interface)
```

---

## Summary

**Milestone**: Real Spotify track search  
**Duration**: 4-6 hours  
**Difficulty**: Medium (new backend, but straightforward)  
**Value**: Users see real music data; mock data still works  
**Risk**: Low (mock data preserved; feature behind toggle)  

**Success** = User types "indie rock" and sees real Spotify results with working links.

---

**Ready for**: Phase 2 Backend Implementation  
**Approval**: Implementation can begin once backend dependencies are installed
