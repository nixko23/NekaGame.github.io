> **Historical document:** This research/plan contains provider recommendations that are no longer current. For the current playback/provider decision verified October 25, 2026, use [PROVIDER_DECISION.md](PROVIDER_DECISION.md) and [NEXT_STEPS.md](NEXT_STEPS.md). This file is retained as project history and is not an implementation instruction.

# API Integration Plan — SoundCloud Discovery

**Date**: October 24, 2026  
**Status**: Ready for Implementation  
**Confidence**: High (based on verified official documentation)  
**Next Phase**: Backend Development (Phase 2)

---

## 1. Executive Summary

### Previous Status (Oct 22, 2026)
- Recommended: Spotify + Last.fm hybrid
- Assumption: Frontend-only or mixed architecture possible
- Evidence: Limited research into OAuth flows and token management

### Current Status (Oct 24, 2026)
- **Recommendation Confirmed**: Spotify + Last.fm hybrid still optimal
- **Architecture Corrected**: Backend proxy mandatory (not optional)
- **Evidence**: Official documentation reviewed; OAuth flows analyzed
- **First Milestone**: Spotify search with backend proxy (4-6 hours)

### Key Insight
All three music APIs (Spotify, SoundCloud, Last.fm) require either:
1. Secure credential storage (backend)
2. User OAuth authentication (requires backend for token refresh)

**Frontend-only approach violates API terms of service.**

---

## 2. Verified API Capabilities

### Spotify Web API ✅ CONFIRMED
**Status**: Active, maintained (Feb 2026 migration guide exists)

| Capability | Verified | Details |
|------------|----------|---------|
| Search | ✅ Yes | `/v1/search?type=track&q=...` endpoint active |
| Track Metadata | ✅ Yes | Name, artist, duration, images, preview URL |
| Recommendations | ✅ Yes | `/v1/recommendations` with seed parameters |
| Authentication | ✅ Yes | OAuth 2.0 (Authorization Code, PKCE, Client Credentials) |
| Rate Limits | ⚠️ Undocumented | "Hundreds per 30s" typical; exact limits not published |
| CORS | ❌ No | API calls must be backend-only |
| Terms | ✅ Clear | Non-commercial use allowed; commercial requires approval |

**Best For**: Primary search and recommendations source

### SoundCloud API ✅ CONFIRMED
**Status**: Active with OAuth 2.1 + PKCE

| Capability | Verified | Details |
|------------|----------|---------|
| Search | ✅ Yes | Search tracks, users, playlists |
| Track Metadata | ✅ Yes | Basic metadata available |
| Playback URLs | ✅ Yes | Direct stream URLs provided |
| Authentication | ✅ Yes | OAuth 2.1 + PKCE required |
| CORS | ✅ Yes | **Unique advantage: CORS enabled for browser requests** |
| Rate Limits | ⚠️ Undocumented | Not published; must test |
| Terms | ⚠️ Unclear | Embedding restrictions not documented |

**Best For**: Alternative source if Spotify unavailable; testing OAuth flows

**Risk**: Terms of service not clearly published; contact SoundCloud before production use

### Last.fm API ✅ CONFIRMED
**Status**: Active; simple API key authentication

| Capability | Verified | Details |
|------------|----------|---------|
| Search | ✅ Yes | `artist.search`, `track.search` methods exist |
| Similar Artists | ✅ Yes | `artist.getSimilar` method available |
| User Charts | ✅ Assumed | Mentioned in docs; not directly tested |
| Metadata | ✅ Yes | Artist info, tags, user data available |
| Authentication | ✅ Yes | API key only; no OAuth required |
| Rate Limits | ⚠️ Vague | "Don't make several per second"; no specific threshold |
| CORS | ❌ Unknown | Not documented; likely blocked from browser |
| Terms | ⚠️ Conditional | Commercial use requires prior contact to partners@last.fm |

**Best For**: Similar artists, artist metadata, discovery via tags

---

## 3. Recommended Architecture

### Selected: Backend Proxy + Frontend Pattern

```
[React Frontend - Port 5173]
        ↓
    /api/search
        ↓
[Node.js Backend - Port 3001]
        ├─ Spotify Service (API token + search)
        ├─ Last.fm Service (API key + similar artists)
        └─ Rate Limiting (per user)
        ↓
[External APIs]
├─ Spotify API
├─ Last.fm API
└─ SoundCloud API (optional, later)
```

### Why This Architecture

| Requirement | Frontend-Only | Backend Proxy |
|-------------|--------------|---------------|
| **Security** | ❌ Exposes secrets | ✅ Secrets server-side |
| **Compliance** | ❌ Violates ToS | ✅ Terms-compliant |
| **Token Mgmt** | ❌ localStorage vulnerable | ✅ Secure + encrypted (if needed) |
| **Rate Limiting** | ❌ No control | ✅ Per-user enforcement |
| **Error Handling** | ❌ Limited | ✅ Comprehensive |
| **Debugging** | ❌ All in browser | ✅ Server logs |
| **Scalability** | ❌ Poor | ✅ Cacheable, monitorable |

### Technology Stack

**Frontend** (No changes to existing):
- React 19
- TypeScript
- Vite
- Existing components + API fetch calls

**Backend** (New):
- Node.js 18+
- Express.js 4.18+
- axios 1.20+ (already in package.json)
- dotenv 16.3+
- express-rate-limit 7.0+
- cors 2.8+

**Dependencies Added**: ~5 packages (minimal)

---

## 4. Implementation Phases

### Phase 1: Backend Infrastructure ✅ PLANNED
**Duration**: 4-6 hours

**Deliverable**: Backend proxy running, Spotify search working

**Tasks**:
1. Initialize Node.js backend in `server/` folder
2. Set up Express with CORS and rate limiting
3. Implement Spotify token refresh logic
4. Create `/api/search` endpoint
5. Test locally with mock frontend calls
6. Integrate with React frontend
7. Add toggle to switch between mock and real data

**Success Criteria**:
- Backend runs on :3001
- Frontend can POST to `/api/search`
- Spotify returns real tracks
- Results display correctly
- Favorites still work (localhost)
- All checks pass (lint, TS, build)

### Phase 2: Last.fm Integration (Future)
**Duration**: 2-3 hours

**Deliverable**: Similar artists, artist discovery

**Tasks**:
1. Add Last.fm API key to `.env`
2. Create `/api/similar-artists` endpoint
3. Create `/api/artist-info` endpoint
4. Integrate into artist detail view
5. Add Last.fm attribution

### Phase 3: Enhanced Features (Future)
**Duration**: 4-6 hours

**Deliverable**: Recommendations, user authentication

**Tasks**:
1. Implement Spotify recommendations with seeds
2. Add basic user authentication (optional)
3. Save user preferences
4. Add listening history tracking

---

## 5. Risk Assessment

### High Priority Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Spotify rate limits (undocumented)** | High | Search fails if exceeded | Implement backend cache; test limits early |
| **SoundCloud terms unclear** | High | Terms of service violation | Contact SoundCloud; use only if terms clarified |
| **Token expiration during session** | Medium | API calls fail silently | Implement refresh logic + error handling |
| **CORS issues with APIs** | Low | Frontend-only fallback fails | Proceed with backend architecture |

### Medium Priority Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Last.fm rate limits (vague)** | Medium | Requests throttled | Track response times; cache results |
| **Spotify OAuth approval needed** | Medium | Commercial features blocked | For MVP: stay non-commercial; doc for future |
| **Backend credentials exposed** | Low | Security breach | Use `.env`; never commit secrets; use HTTPS in prod |

### Low Priority Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Vite proxy misconfiguration** | Low | Frontend can't reach backend | Standard Express setup; well-documented |
| **Database needed later** | Low | Architectural change needed | Skip DB for now; add if user accounts needed |

---

## 6. Security & Compliance Checklist

### Before Implementation

- [ ] **API Credentials**
  - [ ] Register Spotify developer account (free)
  - [ ] Get Client ID and Client Secret
  - [ ] Register Last.fm API key
  - [ ] Store in `.env` (never in code)

- [ ] **Terms of Service Review**
  - [ ] Confirm Spotify non-commercial use OK for portfolio
  - [ ] Review Last.fm commercial contact requirement
  - [ ] Contact SoundCloud for terms clarification (if using later)

- [ ] **Code Security**
  - [ ] `.env` added to `.gitignore`
  - [ ] `.env.example` created (no secrets)
  - [ ] No hardcoded credentials in code
  - [ ] All API calls server-side only

### During Implementation

- [ ] **Token Management**
  - [ ] Tokens never logged in full
  - [ ] Token expiry handled (refresh before expiration)
  - [ ] Failed token requests don't crash app

- [ ] **Error Handling**
  - [ ] API errors don't expose stack traces to frontend
  - [ ] Rate limit errors have retry guidance
  - [ ] Failed requests don't retry indefinitely

- [ ] **CORS/HTTPS**
  - [ ] CORS configured to frontend origin only
  - [ ] Production HTTPS enforced (if deployed)
  - [ ] No wildcard CORS (`*` only for development)

### Before Production

- [ ] **Monitoring**
  - [ ] Error logging configured
  - [ ] Rate limit tracking enabled
  - [ ] API health checks automated

- [ ] **Secrets Management**
  - [ ] Credentials stored in environment (not `.env` file)
  - [ ] AWS Secrets Manager / GitHub Secrets (if deployed)
  - [ ] Credential rotation plan

---

## 7. Testing Strategy

### Unit Tests (Backend)

**Spotify Service**:
```javascript
test('getAccessToken returns valid token', async () => {
  const token = await getAccessToken();
  expect(token).toMatch(/^BQ/); // Spotify tokens start with BQ
  expect(token.length).toBeGreaterThan(50);
});

test('searchTracks returns array of tracks', async () => {
  const results = await searchTracks('indie');
  expect(Array.isArray(results)).toBe(true);
  expect(results[0]).toHaveProperty('title', 'artist', 'duration');
});
```

### Integration Tests

**API Endpoint**:
```javascript
test('POST /api/search returns tracks', async () => {
  const res = await request(app)
    .post('/api/search')
    .send({ query: 'indie', source: 'spotify' });
  
  expect(res.status).toBe(200);
  expect(res.body.tracks).toBeDefined();
  expect(res.body.tracks.length).toBeGreaterThan(0);
});
```

### Manual Tests (QA Checklist)

1. **Search Flow**
   - [ ] Type 1-char query → no results (validation)
   - [ ] Type "indie" → real Spotify results
   - [ ] Results match query
   - [ ] All fields present (title, artist, image, link)

2. **Error Cases**
   - [ ] Disable internet → shows error
   - [ ] Hit rate limit (31 requests in 60s) → 429 response
   - [ ] Spotify API down → graceful error

3. **Performance**
   - [ ] Search completes in <2 seconds
   - [ ] No UI blocking
   - [ ] Results cached properly

---

## 8. Approval Checklist — Before Phase 1

- [ ] **Architecture approved** (Backend Proxy selected)
- [ ] **Technology stack approved** (Node.js + Express)
- [ ] **First milestone scope approved** (Spotify search only)
- [ ] **Spotify developer account created** (credentials ready)
- [ ] **Security practices confirmed** (credentials management plan)
- [ ] **Timeline confirmed** (4-6 hours for Phase 1)

---

## 9. Success Metrics

### After Phase 1 (Backend + Spotify Search)

| Metric | Target | Actual |
|--------|--------|--------|
| **Search latency** | <2s | TBD |
| **Rate limit requests** | 30 per minute | TBD |
| **Mock data toggle** | Instant | TBD |
| **Spotify results quality** | First 10 relevant | TBD |
| **Favorites still work** | 100% functional | TBD |
| **Error rate** | <1% | TBD |
| **Code coverage** | >80% services | TBD |

### After Phase 2 (Last.fm)

| Metric | Target |
|--------|--------|
| **Similar artists latency** | <1s |
| **Artist metadata accuracy** | 95%+ |
| **Last.fm attribution** | Visible on results |

---

## 10. Documentation References

### Official API Docs
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Authorization Guide](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [Last.fm API Methods](https://www.last.fm/api)
- [SoundCloud API Documentation](https://developers.soundcloud.com/docs)

### Implementation Guides
- `ARCHITECTURE_RECOMMENDED.md` — Detailed architecture decision
- `API_FEASIBILITY_VERIFIED.md` — Verification of API claims
- `INTEGRATION_MILESTONE_FIRST.md` — First integration milestone (Spotify search)

### Project Documentation
- `NEXT_STEPS.md` — Updated with Phase 2 plan
- `README.md` — Project overview
- `API_RESEARCH.md` — Original research (Oct 22)

---

## 11. Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| **0** | Feasibility Research | 2h | ✅ Complete |
| **0** | Architecture Planning | 2h | ✅ Complete |
| **1** | Backend Setup | 2h | 🔲 Pending |
| **1** | Spotify Integration | 2-3h | 🔲 Pending |
| **1** | Frontend Integration | 1-2h | 🔲 Pending |
| **1** | Testing & QA | 2h | 🔲 Pending |
| **2** | Last.fm Integration | 2-3h | 🔲 Pending |
| **3** | Recommendations | 4-6h | 🔲 Pending |
| **3** | User Auth (Optional) | 3-4h | 🔲 Pending |

**Total to MVP (Phases 1-2)**: ~14-18 hours

---

## 12. Constraints & Assumptions

### Constraints
1. **Non-commercial only** — Spotify free tier requires non-commercial use
2. **No playback** — Spotify playback requires Premium account; embed player or link only
3. **No download** — Cannot cache/download tracks; only metadata
4. **Attribution required** — Must credit Spotify/Last.fm when showing data

### Assumptions
1. **Internet available** — All APIs require connectivity
2. **API availability** — Assumes Spotify/Last.fm stay online
3. **Rate limits reasonable** — Assumes Spotify won't throttle frequently
4. **Terms stable** — Assumes ToS won't change drastically mid-project

---

## 13. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Oct 22 | Spotify + Last.fm hybrid | Best balance of features and docs |
| Oct 24 | Backend proxy architecture | Security + compliance mandatory |
| Oct 24 | Spotify first, Last.fm second | Best search quality; Last.fm for discovery |
| Oct 24 | First milestone: Spotify search | Smallest valuable MVP |

---

## Final Status

**Phase 2 Preparation**: ✅ **COMPLETE**

**Ready for**: Backend implementation (Phase 1)

**Next Step**: Create backend project structure and implement Spotify service

**Approval**: Awaiting go-ahead to begin Phase 1 (Backend + Spotify Search)

---

**Document Version**: 1.0  
**Last Updated**: October 24, 2026  
**Prepared By**: API Integration Planning  
**Status**: Ready for Development

