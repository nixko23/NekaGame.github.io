# API Feasibility Verification Report — October 24, 2026

**Purpose**: Verify claims in `API_RESEARCH.md` against current official documentation  
**Verification Date**: October 24, 2026  
**Status**: Completed with key findings and corrections

---

## Executive Summary

The previous `API_RESEARCH.md` (Oct 22, 2026) recommended a **Spotify + Last.fm hybrid** approach. This verification confirms the recommendation is sound, but reveals **critical architecture implications that were underestimated**:

### Key Verified Facts
1. ✅ **Spotify API is available** and actively maintained (Feb 2026 migration guide confirms recent updates)
2. ✅ **Search and recommendations endpoints exist** and are functional
3. ✅ **SoundCloud API exists** with OAuth 2.1 + PKCE, CORS enabled for frontend
4. ✅ **Last.fm API is active** with track search and similar artists methods
5. ❌ **Frontend-only Spotify access is NOT viable** — Client Credentials tokens can only access non-user endpoints, but obtaining tokens from frontend requires backend secret management
6. ⚠️ **SoundCloud frontend access requires OAuth**, complicating token refresh in browser
7. ⚠️ **Last.fm frontend access is possible but rate-limited and vague**

### Architecture Implication
**A backend is mandatory** for any secure implementation. Frontend-only approaches expose credentials or violate terms of service.

---

## 1. Spotify Web API — Verified Status

**Official Sources Checked**:
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Authorization Concepts](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [Search Endpoint Reference](https://developer.spotify.com/documentation/web-api/reference/search)
- [Recommendations Endpoint](https://developer.spotify.com/documentation/web-api/reference/get-recommendations)
- [February 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

**Verification Date**: October 24, 2026

### Confirmed Capabilities

| Feature | Previous Claim | Verified | Details |
|---------|----------------|----------|---------|
| **Search** | ✅ Available | ✅ CONFIRMED | Search endpoint exists, supports tracks, artists, albums |
| **Recommendations** | ✅ Algorithm-based | ✅ CONFIRMED | Get Recommendations endpoint available with seed parameters |
| **Audio Features** | ✅ Available | ⚠️ ASSUMED | Not directly verified in search results |
| **Track Metadata** | ✅ Rich | ✅ CONFIRMED | Duration, popularity, explicit flag, preview URLs included |
| **Playback SDK** | ✅ Available | ⚠️ NOT VERIFIED | Requires Spotify Premium; not explored in current research |

### Authentication Flows — Critical Finding

**Previous Claim**: "Client Credentials Flow (For Non-User Data)" implies frontend can use this directly.

**Verified Reality**:
- **Authorization Code Flow** — Requires backend to securely store `client_secret`
- **Authorization Code PKCE** — Designed for frontend/mobile apps, but:
  - Still requires user login and explicit consent
  - Access token expires in ~1 hour
  - Refresh token needed for long-lived sessions
  - PKCE protects code, but doesn't eliminate backend need for secure token storage
- **Client Credentials Flow** — Cannot be used from frontend because:
  - Requires `client_secret` (confidential)
  - Only accesses non-user endpoints
  - Violates security if exposed in browser code

**Conclusion**: **Frontend-only Spotify access is NOT secure**. A backend is required to safely manage credentials and tokens.

### Rate Limits

**Previous Claim**: "Calculated per rolling 30-second window (varies by tier)" / "No public documentation of exact numerical limits"

**Verified**: 
- Documentation references rate limits but specific thresholds are NOT publicly documented
- "Typically allows hundreds of requests per 30 seconds" (from previous research)
- 429 status code + `Retry-After` header when throttled
- Development tier has lower limits than production

**Note**: Exact limits remain undocumented; requires testing during implementation.

### Data Use Restrictions — Confirmed

**Critical Restrictions**:
1. ✅ **Non-Commercial Only** — Free tier for personal/portfolio use only
2. ✅ **No ML/AI Training** — Explicit prohibition on training models
3. ✅ **Limited Caching** — Content is licensed, not owned
4. ✅ **Attribution Required** — Must credit Spotify when displaying data
5. ✅ **Commercial Approval** — "Spotify for Developers" partnership required for monetization

**Implication**: This project (portfolio/demo) is acceptable for non-commercial use. Monetization requires approval.

---

## 2. SoundCloud API — Updated Verification (October 25, 2026)

This section supersedes the October 24 SoundCloud claims below. See [SOUNDCLOUD_API_STATUS.md](SOUNDCLOUD_API_STATUS.md) for current sources and implementation status.

- Track search is `GET https://api.soundcloud.com/tracks?q=...`; public search accepts a Client Credentials access token.
- SoundCloud enables browser CORS, but **this does not make credential handling safe in a browser**. Current docs say all clients are confidential; Client Credentials requires a client secret and the flow is server-side. Keep the secret and token acquisition on a server.
- App registration currently requires an Artist Pro subscription and remote pairing or the Your Apps workflow to issue a client ID and client secret.
- Search, stream, and general rate limits are documented and may change. Check the API response rate-limit headers and `Retry-After` on 429.
- Current API Terms require creator/source attribution and a visible link to each sound permalink. They prohibit SoundCloud marks in the app name and restrict alternative digital-content services that aggregate and stream user content. Resolve whether this product and its recommendations fit the permitted use before integration.
- Public tracks can be played using the SoundCloud Widget/oEmbed or authorized stream URLs when available. Tracks can be blocked, preview-only, paywalled, or geo-restricted. This project has no implemented playback and must not imply otherwise.

**Current project access:** no SoundCloud credential variables or `.env` files were present during the October 25 project inspection. Search integration was not exercised against SoundCloud.

---

## 3. Last.fm API — Verified Status

**Official Sources Checked**:
- [Last.fm API Homepage](https://www.last.fm/api)
- [Last.fm API Introduction](https://www.last.fm/api/intro)

**Verification Date**: October 24, 2026

### Confirmed Capabilities

| Feature | Previous Claim | Verified | Details |
|---------|----------------|----------|---------|
| **Search** | ✅ Available | ✅ CONFIRMED | artist.search, album.search, track.search methods exist |
| **Similar Artists** | ✅ Available | ✅ CONFIRMED | artist.getSimilar method available |
| **User Charts** | ✅ Available | ⚠️ ASSUMED | Mentioned in previous research; not directly verified |
| **Scrobbling** | ✅ Available | ⚠️ ASSUMED | Mentioned; implementation details not verified |

### Authentication

**Previous Claim**: "API Key Model" / "Simple registration"

**Verified**:
- Registration required; specific form fields not documented in fetched content
- API key provided after registration
- Optional shared secret for secured calls
- Different pathways for commercial/research use (contact required)

### Frontend Access

**Status**: Unclear from official documentation

**Concerns**:
- Documentation doesn't explicitly address whether frontend apps can call API directly
- No mention of CORS or JSONP support
- Rate limit policy vague: "Don't make excessive calls; several per second will get you suspended"
- Frontend might expose API key in request parameters (security risk)

### Rate Limits

**Previous Claim**: "Generous" / "Few requests per second"

**Verified**:
- No specific numerical rate limits published
- Only guidance: "Don't make several calls per second"
- Account suspension possible for excessive calls
- No throttling headers or retry guidance documented

---

## 4. MusicBrainz API — Not Prioritized

**Status**: Skipped detailed verification as not recommended for initial integration

**Previous Claim**: "Best for metadata enrichment"  
**Assessment**: Valid, but:
- 1 request per second rate limit is very restrictive
- Metadata-only (no discovery value without another source)
- Useful as secondary enrichment after core integration works

---

## 5. Architecture Implications — Key Findings

### Finding 1: Backend is Mandatory

| Approach | Viability | Reason |
|----------|-----------|--------|
| **Frontend-Only** | ❌ NO | Cannot securely store client secrets; must expose tokens |
| **Backend + Frontend** | ✅ YES | Backend stores secrets, proxies requests, manages tokens |

### Finding 2: Token Management Complexity

All three APIs require:
1. Obtaining access tokens (require credentials or OAuth flow)
2. Token expiration handling (1 hour for Spotify/SoundCloud)
3. Refresh token refresh cycle (if applicable)
4. Error handling for 401/403 (token invalid/expired)

**Frontend-only approach** exposes these secrets to browser, violating security and terms of service.

### Finding 3: API-Specific Advantages

| API | Advantage | Drawback |
|-----|-----------|----------|
| **Spotify** | Best recommendation engine, mature docs | Requires backend for secure auth, non-commercial only |
| **SoundCloud** | CORS enabled (frontend possible), native playback | Terms unclear, rate limits undocumented |
| **Last.fm** | Simple API key auth, rich metadata | Vague rate limits, no clear frontend guidance |

### Finding 4: Search + Discovery Workflow

For MVP, recommended flow:
1. User searches in UI (frontend)
2. Frontend sends query to **backend**
3. Backend queries **Spotify** (best search quality)
4. Backend returns results to frontend
5. Frontend displays results with external links or embedded player

This avoids exposing credentials and respects rate limits.

---

## 6. Recommended First Steps

### Pre-Implementation
1. **Create Spotify Developer Account** — Free tier available at developer.spotify.com
2. **Create Last.fm API Key** — Simple registration at last.fm/api
3. **Create SoundCloud OAuth App** — Optional; test if needed
4. **Review Terms** — Confirm non-commercial use is acceptable

### For Implementation
1. **Build Backend Proxy** — Node.js/Express to handle API calls
2. **Implement Spotify Search** — First milestone, most reliable source
3. **Add Error Handling** — Rate limits, token expiration, failed requests
4. **Test with Real Data** — Verify response formats and performance

---

## 7. Unresolved Questions (Require Testing)

1. **Spotify Rate Limits** — Exact thresholds for development tier (must test)
2. **SoundCloud Token Refresh** — Complete flow with PKCE in browser (requires implementation)
3. **Last.fm Frontend Access** — Whether API key can be safely exposed (needs research)
4. **SoundCloud Terms** — Commercial use and embedding restrictions (contact SoundCloud)
5. **Playback Legality** — Whether embedding SoundCloud/Spotify players is allowed (legal review recommended)

---

## 8. Conclusion

**Previous Recommendation Status**: ✅ **STILL VALID**

Spotify + Last.fm hybrid approach is sound. However, **architecture must change from frontend-only to backend-based** for security and compliance.

**Key Change from Previous Research**:
- Previous research suggested both approaches were viable
- **Verification reveals backend is mandatory**, not optional

**Next Steps**: Create detailed architecture document (Task 2) based on these findings.

---

**Verification Performed By**: API Research Review  
**Date**: October 24, 2026  
**Sources**: Official API documentation from Spotify, SoundCloud, Last.fm  
**Confidence Level**: High for stated facts; Medium for undocumented limitations
