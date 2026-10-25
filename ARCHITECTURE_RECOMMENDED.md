# Recommended Architecture — SoundCloud Discovery API Integration

**Date**: October 24, 2026  
**Decision**: Backend Proxy + Frontend Pattern (Minimal Viable)  
**Rationale**: Simplest approach that is secure, scalable, and respects API terms

---

## Executive Summary

Three architectures were evaluated:

| Approach | Complexity | Security | Feasibility | Recommendation |
|----------|-----------|----------|------------|-----------------|
| **Frontend-Only** | Low | ❌ Poor | ❌ Not viable | ❌ REJECTED |
| **Backend Proxy** | Medium | ✅ Good | ✅ High | ✅ **SELECTED** |
| **Backend + Engine** | High | ✅ Excellent | ⚠️ Complex | ❌ Future phase |

**Recommendation**: **Backend Proxy + Frontend** for MVP. Simplest pattern that satisfies security, compliance, and product requirements.

---

## 1. Architecture Option 1: Frontend-Only (REJECTED)

### Approach
React app calls Spotify/SoundCloud/Last.fm directly from browser.

### Why It Fails

| Aspect | Problem |
|--------|---------|
| **Credentials** | Must embed `client_secret` in browser code (visible to users) |
| **Terms Violation** | Exposing secrets violates API terms of service |
| **Rate Limits** | Per-user rate limits cause blocking; no pooling |
| **Token Storage** | localStorage tokens are vulnerable to XSS attacks |
| **Refresh Flow** | Token refresh requires redirect or complex popup handling |
| **Debugging** | Every user request visible in network tab; credentials logged |

### Example Problem: Spotify Search
```javascript
// DANGEROUS: Secret exposed in browser
const response = await fetch('https://api.spotify.com/v1/search', {
  headers: {
    'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET) // ❌ VISIBLE
  }
});
```

**Verdict**: ❌ **Not viable.** Rejected.

---

## 2. Architecture Option 2: Backend Proxy (RECOMMENDED)

### Approach

```
[Frontend (React)]
        ↓
   Search "indie rock"
        ↓
[Backend (Node.js/Express)]
        ├─ Stores API credentials
        ├─ Manages tokens securely
        ├─ Handles rate limiting
        └─ Proxies requests to APIs
        ↓
   [Spotify API]
   [Last.fm API]
   [SoundCloud API]
```

### Design

#### Frontend Responsibilities
- Display search UI and results
- Cache results in React state (not credentials)
- Display loading/error states
- Handle pagination
- No exposure to API credentials

#### Backend Responsibilities
- Accept requests from frontend (`POST /api/search?q=indie`)
- Maintain API credentials in environment variables
- Obtain and refresh access tokens
- Call external APIs
- Return sanitized responses to frontend
- Rate limit per-frontend-user (via session/IP)
- Log errors server-side (not exposed to frontend)

#### API Credentials Management
```
Environment Variables (never in code):
├─ SPOTIFY_CLIENT_ID
├─ SPOTIFY_CLIENT_SECRET
├─ LASTFM_API_KEY
└─ SOUNDCLOUD_CLIENT_ID
```

#### Request Flow — Example: Search

**Frontend**:
```typescript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'indie rock', source: 'spotify' })
});
```

**Backend**:
```javascript
app.post('/api/search', async (req, res) => {
  const { query, source } = req.body;
  
  // Token from stored credentials (not browser-visible)
  const token = await getSpotifyToken(); // Uses CLIENT_SECRET safely
  
  const results = await fetch(`https://api.spotify.com/v1/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, type: 'track' }
  });
  
  // Return only safe data to frontend
  const safe_results = results.items.map(track => ({
    id: track.id,
    title: track.name,
    artist: track.artists[0].name,
    // DO NOT include: href, uri, external_urls (except user-facing link)
  }));
  
  res.json(safe_results);
});
```

### Token Refresh Strategy

**For Spotify Client Credentials** (simplest, non-user):
1. Backend obtains token once (15-minute expiry)
2. Backend caches token in memory
3. On 401, refresh and retry
4. Frontend never sees credentials

**For SoundCloud OAuth** (if needed later):
1. User logs in once (Authorization Code PKCE flow)
2. Backend stores refresh token securely (encrypted at-rest)
3. Backend uses refresh token to get new access tokens
4. Frontend never touches tokens

### Rate Limiting

**Frontend-Side** (UX feedback):
- Debounce search input (500ms)
- Show "searching..." state
- Disable search while request in-flight

**Backend-Side** (enforcement):
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per user per minute (generous)
  // Per-user tracking via session or IP
});

app.post('/api/search', limiter, async (req, res) => {
  // ...
});
```

### Error Handling

| Error | Frontend Sees | Backend Logs |
|-------|----------------|-------------|
| **API Down** | "Service unavailable" | Full error + timestamp |
| **Rate Limited** | "Too many requests, try again in X seconds" | Request rejected + headers |
| **Token Invalid** | "Authentication failed" (silent retry) | 401 logged + retry attempted |
| **Invalid Query** | "Search term too short" | Validation error + query |

### Security Practices

1. **Credentials**: Environment variables, never in code
2. **Token Storage**: Memory cache (lost on restart) or encrypted DB
3. **HTTPS Only**: All frontend ↔ backend communication encrypted
4. **CORS**: Restrict to frontend origin (prevent other sites using API)
5. **Rate Limiting**: Per-session/IP to prevent abuse
6. **Logging**: Server-side only; never log credentials or full responses
7. **Error Messages**: Generic to frontend; detailed in server logs

---

## 3. Architecture Option 3: Backend + Recommendation Engine (FUTURE)

### Approach
Backend + ML/recommendation system that learns from user behavior.

### Why It's Premature

| Factor | Status |
|--------|--------|
| **Required for MVP?** | ❌ No |
| **Can Add Later?** | ✅ Yes |
| **Complexity Multiplier** | 5x+ |
| **Database Requirements** | Yes (new dependency) |

### What It Would Include
- User behavior tracking (clicks, skips, plays, favorites)
- Custom recommendation algorithm
- Offline batch processing
- Analytics dashboard
- A/B testing framework

### When to Build
- After MVP with real search/discovery working
- After collecting user behavior data
- When simple Spotify recommendations aren't sufficient

**Verdict**: ❌ **Skip for now.** Can be added in Phase 3.

---

## 4. Technology Stack — Backend Proxy

### Technology Choices

| Layer | Option | Why |
|-------|--------|-----|
| **Runtime** | Node.js 18+ | JavaScript ecosystem, fast, lightweight |
| **Framework** | Express.js | Minimal, proven, good for APIs |
| **Auth** | jsonwebtoken (JWT) for sessions | Stateless, easy to test |
| **HTTP Client** | axios | Already in package.json for frontend |
| **Rate Limiting** | express-rate-limit | Standard, production-ready |
| **Env Vars** | dotenv | Simple, secure for development |
| **Logging** | winston or pino | Structured logging, easy to parse |

### New Dependencies (Minimal)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.20.0",        // Already present
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",       // For development
    "jest": "^29.7.0"          // For testing
  }
}
```

**Total new packages**: ~5 (very minimal)

---

## 5. File Structure

### Current Frontend
```
src/
├── App.tsx                 // Main component (no change needed)
├── components/
│   ├── SearchBar.tsx       // Add call to backend instead of local search
│   ├── TrackCard.tsx       // Display results (no change)
│   └── PlaylistView.tsx
└── types.ts               // Already has Track, Playlist
```

### New Backend
```
server/
├── package.json           // Backend dependencies
├── .env                   // API credentials (not in repo)
├── .env.example           // Template (safe to commit)
├── server.js              // Express app entry point
├── routes/
│   ├── search.js          // GET /api/search?q=indie
│   ├── recommendations.js // GET /api/recommendations
│   └── health.js          // GET /health (liveness check)
├── services/
│   ├── spotifyService.js  // Spotify API calls + token management
│   ├── lastfmService.js   // Last.fm API calls
│   └── soundcloudService.js // SoundCloud API calls (if using)
├── middleware/
│   ├── rateLimit.js       // Express rate limiting
│   ├── errorHandler.js    // Global error handler
│   └── cors.js            // CORS configuration
└── tests/
    └── search.test.js     // Integration tests
```

### Deployment Structure
```
/.env                  # Secrets (only on server, not in repo)
/server/               # Backend code
/src/                  # Frontend code
/dist/                 # Built frontend (deployed to CDN)
```

---

## 6. Development Workflow

### Local Development

**1. Start Backend** (port 3001):
```bash
cd server
npm install
npm run dev
```

**2. Start Frontend** (port 5173):
```bash
cd .
npm run dev
```

**3. Frontend calls Backend**:
- Proxy configured in `vite.config.ts`:
  ```javascript
  proxy: {
    '/api': 'http://localhost:3001'
  }
  ```
- React code calls `/api/search` (automatically proxied to backend)

### Environment Setup

**Before starting**:
1. Get API credentials:
   ```bash
   # Spotify Developer: https://developer.spotify.com/dashboard
   SPOTIFY_CLIENT_ID=xxxxx
   SPOTIFY_CLIENT_SECRET=yyyyy
   
   # Last.fm: https://www.last.fm/api
   LASTFM_API_KEY=zzzzz
   ```

2. Create `.env` in `server/` folder:
   ```
   SPOTIFY_CLIENT_ID=xxxxx
   SPOTIFY_CLIENT_SECRET=yyyyy
   LASTFM_API_KEY=zzzzz
   PORT=3001
   NODE_ENV=development
   ```

3. Add `.env` to `.gitignore` (critical):
   ```
   .env
   .env.local
   *.key
   *.pem
   ```

4. Commit `.env.example` (template, no secrets):
   ```
   SPOTIFY_CLIENT_ID=
   SPOTIFY_CLIENT_SECRET=
   LASTFM_API_KEY=
   PORT=3001
   NODE_ENV=development
   ```

---

## 7. Migration Plan — Keeping Mock Data Working

### Phase 1: Backend Running, Mock Data Still Active
- Backend proxy deployed but not called yet
- Frontend still uses mock data
- Both systems work independently
- No risk of breaking current UI

### Phase 2: Gradual Switch to Real Data
1. Add toggle: "Use Real Data" checkbox in UI
2. When enabled, frontend calls `/api/search` instead of local search
3. On toggle off, returns to mock data
4. Users can test both

### Phase 3: Full Migration
- Default to real data
- Mock data still available (for demo/offline mode)
- Remove toggle once stable

### Code Example: Gradual Switch

**App.tsx**:
```typescript
const [useRealData, setUseRealData] = useState(false);

const handleSearch = async (query: string) => {
  if (useRealData) {
    // Call backend
    const response = await fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, source: 'spotify' })
    });
    const results = await response.json();
    setTracks(results);
  } else {
    // Use mock data (current behavior)
    const filtered = mockTracks.filter(t => 
      t.title.includes(query)
    );
    setTracks(filtered);
  }
};

return (
  <>
    <label>
      <input
        type="checkbox"
        checked={useRealData}
        onChange={(e) => setUseRealData(e.target.checked)}
      />
      Use Real Data (Beta)
    </label>
    <SearchBar onSearch={handleSearch} />
  </>
);
```

---

## 8. Testing Strategy

### Backend Tests
```javascript
describe('GET /api/search', () => {
  test('returns tracks for valid query', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'indie', source: 'spotify' });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tracks');
    expect(Array.isArray(res.body.tracks)).toBe(true);
  });

  test('rate limits after 30 requests', async () => {
    for (let i = 0; i < 31; i++) {
      await request(app).post('/api/search')
        .send({ query: 'test' });
    }
    const res = await request(app).post('/api/search')
      .send({ query: 'test' });
    expect(res.status).toBe(429);
  });
});
```

### Frontend Tests
- No change needed; UI components work the same
- Mock `/api/search` endpoint in tests
- Test real data display vs. mock data display

---

## 9. Comparison Summary

| Aspect | Frontend-Only | Backend Proxy | Backend + Engine |
|--------|--------------|---------------|-----------------|
| **Setup Time** | 2 hours | 4-6 hours | 20+ hours |
| **Security** | ❌ Poor | ✅ Excellent | ✅ Excellent |
| **Compliance** | ❌ Violates ToS | ✅ Compliant | ✅ Compliant |
| **Scalability** | ❌ None | ✅ Good | ✅ Excellent |
| **Rate Limit Control** | ❌ None | ✅ Per-user | ✅ Per-user + learning |
| **Error Handling** | ❌ Limited | ✅ Comprehensive | ✅ Comprehensive |
| **Debug Difficulty** | High | Low | Low |
| **Production Ready** | ❌ No | ✅ Yes | Overkill for MVP |

---

## 10. Decision

**SELECTED ARCHITECTURE**: Backend Proxy + Frontend

**Rationale**:
1. **Security**: Credentials stored server-side, never exposed to browser
2. **Simplicity**: Minimal new dependencies (5 packages)
3. **Compliance**: Respects API terms of service
4. **Feasibility**: 4-6 hours to implement vs. 20+ for engine
5. **Scalability**: Easy to add features later without redesign
6. **Testing**: Standard Express patterns; easy to test
7. **Migration**: Mock data remains functional; gradual switch possible

---

**Approved For**: Phase 2 Implementation Planning

**Next Step**: Define first integration milestone (Task 3)
