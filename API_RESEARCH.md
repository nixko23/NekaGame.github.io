> **Historical document:** This research/plan contains provider recommendations that are no longer current. For the current playback/provider decision verified October 25, 2026, use [PROVIDER_DECISION.md](PROVIDER_DECISION.md) and [NEXT_STEPS.md](NEXT_STEPS.md). This file is retained as project history and is not an implementation instruction.

# Music API Research for SoundCloud Discovery

**Research Date**: October 22, 2026  
**Project**: SoundCloud Discovery - Music Discovery Application  
**Goal**: Identify viable music data sources for personalized music discovery  
**Status**: Complete - Recommendation Ready

---

## Executive Summary

Based on comprehensive research of current music APIs and data sources, **Spotify Web API** is the recommended primary solution for this project, with **Last.fm API** as a complementary data source for enhanced personalization. A hybrid approach combining both APIs will provide the best balance of:

- **Data availability**: Track search, metadata, audio features
- **Personalization**: Recommendation algorithms and user listening history
- **Compliance**: Clear terms of service and reasonable rate limits
- **Development feasibility**: Well-documented APIs with active support

**Key Finding**: SoundCloud's official API is available but limited in documentation. The Spotify + Last.fm hybrid approach offers superior functionality for building a personalized music discovery application.

---

## 1. Provider Comparison Table

| Aspect | Spotify | Last.fm | SoundCloud | MusicBrainz |
|--------|---------|---------|-----------|-------------|
| **Search Tracks** | ✅ Yes | ⚠️ Limited | ✅ Yes | ✅ Metadata only |
| **Metadata** | ✅ Rich | ✅ Good | ✅ Good | ✅ Excellent |
| **Audio Features** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Recommendations** | ✅ Algorithm | ⚠️ Charts/Tags | ❌ No | ❌ No |
| **User History** | ✅ Scrobbles | ✅ Scrobbles | ❌ No | ❌ No |
| **Track Playback** | ✅ Embed Player | ⚠️ Link Only | ✅ Embed Player | ❌ No |
| **Free Tier** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Rate Limits** | ⚠️ Rolling 30s | ✅ Generous | ✅ Generous | ✅ 1 req/sec |
| **Auth Required** | ✅ OAuth 2.0 | ✅ API Key | ✅ API Key | ⚠️ User-Agent |
| **Commercial Use** | ⚠️ Restrictions | ❌ Requires Contact | ✅ Supported | ⚠️ Contact Required |
| **Documentation** | ✅ Excellent | ✅ Good | ⚠️ Moderate | ✅ Good |
| **Personalization** | ✅ Excellent | ✅ Good | ❌ None | ❌ None |

---

## 2. Detailed Provider Findings

### 2.1 Spotify Web API

**Status**: ✅ ACTIVE and RECOMMENDED  
**Research Date**: October 22, 2026  
**Sources**:
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Spotify Web API Reference - Recommendations](https://developer.spotify.com/documentation/web-api/reference/get-recommendations)
- [Spotify Terms of Use](https://www.spotify.com/us/legal/end-user-agreement/)

#### Available Capabilities

**Search & Track Discovery**
- Search across tracks, artists, albums, playlists, shows, episodes, audiobooks
- Retrieve artist details, album information, and track metadata
- Access charts and trending content by market/genre
- Full track details including duration, popularity, explicit flag, preview URLs

**Personalization & Recommendations**
- **Get Recommendations Endpoint**: Generates personalized track suggestions based on:
  - Seed artists (up to 5)
  - Seed tracks (up to 5)
  - Seed genres (up to 5)
  - Tunable parameters: energy, danceability, acousticness, tempo, popularity, etc.
- Returns up to 100 recommendations per request with confidence scores
- Audio features data for advanced personalization (energy, danceability, acousticness, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, time_signature, valence)

**User Data Access**
- Get current user profile and saved tracks
- Retrieve user top items (tracks, artists)
- Access recently played tracks
- Create, modify, and manage playlists
- Like/unlike tracks

**Playback & Embedding**
- Spotify Web Playback SDK for in-app player
- Embed Spotify Player for tracks/albums/playlists
- Control playback (play, pause, seek, skip)
- Get current playback state

#### Authentication

**OAuth 2.0 Authorization Code Flow** (Recommended for User Data)
```
Step 1: Redirect user to Spotify Authorization
Step 2: User grants permissions
Step 3: Receive authorization code
Step 4: Exchange code for access token
Step 5: Use access token in API requests
```

**Client Credentials Flow** (For Non-User Data)
```
Step 1: Send client ID and secret
Step 2: Receive access token immediately
Step 3: Use for track search, recommendations (no user context)
```

**Setup Requirements**
1. Create Spotify developer account at [developer.spotify.com](https://developer.spotify.com)
2. Create an application in the dashboard
3. Get Client ID and Client Secret
4. Set redirect URI for OAuth
5. Request Spotify Premium account (recommended for testing)

#### Rate Limits

- **Calculated per rolling 30-second window**: Limit varies by tier
- **Development Mode** (default): Standard rate limit
- **Extended Quota Mode**: Higher limits available via developer dashboard request
- **Throttling**: 429 status code with `Retry-After` header
- **No public documentation** of exact numerical limits, but typically allows hundreds of requests per 30 seconds

#### Data Use Restrictions

⚠️ **CRITICAL RESTRICTIONS**:
1. **Non-Commercial Only**: Personal use only in free tier
2. **No ML/AI Training**: "Spotify content may not be used to train machine learning or AI models"
3. **No Redistribution**: Cannot redistribute, sell, or transfer Spotify Service or content
4. **Limited Metadata Display**: Cannot display metadata without proper attribution
5. **Caching**: Content is licensed, not owned; caching may be restricted
6. **Commercial Use**: Requires Spotify for Developers partnership; contact Spotify directly

#### Cost

- **Free Tier**: Spotify Web API (search, recommendations, basic user data)
- **Premium**: Playback SDK and web player embedding
- **Enterprise**: Custom agreements for large-scale applications

#### Best For

✅ This project IF:
- Building for personal/portfolio use
- User experience is primary goal (not commercial)
- Willing to handle Spotify authentication flow
- Want advanced recommendation engine

❌ Not suitable IF:
- Building commercial music service
- Cannot implement OAuth
- Need other streaming platform integration

---

### 2.2 Last.fm API

**Status**: ✅ ACTIVE  
**Research Date**: October 22, 2026  
**Sources**:
- [Last.fm API Documentation](https://www.last.fm/api)
- [Last.fm API Getting Started](https://www.last.fm/api)
- [Last.fm Terms of Service](https://www.last.fm/api)

#### Available Capabilities

**Music Metadata**
- Artist information and similar artists
- Album details and metadata
- Track information and top tracks
- Tag and genre information
- User-generated tags and ratings

**User Data & Listening History**
- Recent tracks scrobbled by user
- Top tracks, artists, albums (by time period: week, month, lifetime)
- Loved/favorited tracks
- Friends and their listening activity
- User charts and statistics

**Search & Discovery**
- Search for artists, albums, tracks
- Browse by tag or genre
- Global charts (top artists, tracks)
- Charts by geographic region
- Similar artists and tracks (collaborative filtering)

**Scrobbling**
- Record tracks user listens to
- Access listening history
- Create playlists from listening data

#### Authentication

**API Key Model**:
```
1. Register at last.fm/api
2. Create an API application
3. Get API key (free tier)
4. Optionally get shared secret for secured calls
5. Include API key in request parameters
```

**Two Levels of Access**:
- **Public Methods**: No authentication needed (just API key)
- **User-Specific Methods**: Require API key + user token (OAuth-like flow via `auth.getToken`, `auth.getMobileSession`)

#### Rate Limits

- **Not explicitly documented**, but historically generous
- Typical limit: Few requests per second per IP
- **Important**: "If you are planning to use our API for commercial or research/academic purposes, please contact us prior to use via email at partners@last.fm"

#### Data Use Restrictions

⚠️ **IMPORTANT**:
1. **Commercial Use**: Must contact Last.fm first at partners@last.fm
2. **Research/Academic Use**: Must contact Last.fm first
3. **Attribution**: Required if displaying Last.fm data
4. **User Data**: Can only access with user permission (OAuth token)
5. **Caching**: Unclear; assume limited caching only

#### Cost

- **Free Tier**: API access for personal/hobby projects
- **Commercial**: Custom arrangements; contact Last.fm
- **No published pricing** for commercial use

#### Best For

✅ This project IF:
- Want user listening history integration
- Building recommendation based on scrobbles
- Want minimal auth complexity (API key only)
- Need artist similarity matching

⚠️ Limitations:
- No real-time audio features
- No direct playback/embed
- Limited recommendations (mostly trending/similar)
- Requires commercial approval if monetized

---

### 2.3 SoundCloud API

**Status**: ⚠️ AVAILABLE BUT UNCLEAR  
**Research Date**: October 22, 2026  
**Sources**:
- [SoundCloud Developers](https://developers.soundcloud.com)
- [SoundCloud API Guide](https://developers.soundcloud.com/docs)
- [SoundCloud Stack Overflow](https://stackoverflow.com/questions/tagged/soundcloud-api)

#### Current Status

✅ Official API exists and is documented  
⚠️ **Limitations**:
- Documentation is minimal compared to Spotify
- No clear developer onboarding process
- Limited official examples and tutorials
- Community reports of deprecation concerns

#### Available Capabilities

**Search & Discovery**
- Search for tracks, users, playlists
- Get track metadata (title, artist, duration, genre, description)
- Stream URLs for playback
- User profiles and their uploads

**Playback & Embedding**
- HTML5 Widget for embedding
- Streaming URLs for tracks
- Player controls via JavaScript API
- Playlist embedding

**User Data**
- Access user profile and uploads
- Favorite/like tracks
- Follow users
- Create and manage playlists

#### Authentication

- **API Key Required**: Register at developers.soundcloud.com
- **OAuth 2.0**: For user-specific data access
- **No Premium Account Required** (unlike Spotify)

#### Rate Limits

- Not publicly specified in documentation
- Historically: Reasonable limits for hobby projects
- **No SLA or guarantees** published

#### Data Use Restrictions

⚠️ **UNKNOWN - NOT CLEARLY DOCUMENTED**:
- Terms of service not readily accessible in API docs
- Embedding appears allowed but scope unclear
- Caching policy not documented
- Commercial use policy not clearly stated
- **Recommendation**: Contact SoundCloud directly before production use

#### Cost

- Appears free for API access
- No published pricing model

#### Best For

⚠️ This project IF:
- Building proof-of-concept
- Want SoundCloud track playback directly
- Don't need advanced personalization
- Testing SoundCloud integration

❌ Risks:
- **API Stability Unclear**: Limited documentation suggests potential deprecation
- **Unclear ToS**: Risk of violating terms unknowingly
- **No Personalization**: No recommendation engine
- **Limited Community Support**: Fewer Stack Overflow answers vs Spotify

**Recommendation**: Use as secondary/fallback source, not primary

---

### 2.4 MusicBrainz API

**Status**: ✅ ACTIVE (Metadata-Only)  
**Research Date**: October 22, 2026  
**Sources**:
- [MusicBrainz API Documentation](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz API Search](https://musicbrainz.org/doc/MusicBrainz_API/Search)
- [MetaBrainz Non-Commercial License](https://musicbrainz.org)

#### Available Capabilities

**Metadata Only**:
- 15+ entity types: artists, recordings, releases, release-groups, labels, works, events, areas, instruments, series, places, genres, URLs
- Extensive metadata: names, dates, countries, ISBNs, ISPNs, barcodes
- Disc ID lookups for CD identification
- ISRC and ISWC lookups
- Relationships between entities

**NOT Available**:
- ❌ Audio features
- ❌ Recommendations/personalization
- ❌ User listening history
- ❌ Streaming or playback
- ❌ Real-time charts

#### Authentication

- **No API Key Required**: Just provide a meaningful User-Agent header
- **Optional Authentication**: For data submission or accessing user collections
- Uses standard HTTP authentication

#### Rate Limits

- **Maximum 1 request per second per application**
- Very strict rate limiting
- Must set meaningful User-Agent

#### Data Use Restrictions

✅ **Open & Clear**:
- **Non-Commercial**: Free for personal/hobby projects
- **Commercial Use**: Must contact MetaBrainz for licensing
- **Open Database License (ODbL)**: Requires attribution
- **Derivative Works**: May be allowed under ODbL

#### Cost

- **Free for non-commercial** use
- **Commercial licensing** available from MetaBrainz

#### Best For

✅ This project IF:
- Need reliable artist/album/recording metadata
- Want music information reference database
- Combining with another API for playback/recommendations
- Open-source projects requiring music data

❌ Not suitable as primary source:
- No recommendations
- No user personalization
- No playback capability
- Very slow rate limit (1 req/sec)

---

## 3. Feature Capability Matrix

| Feature | Spotify | Last.fm | SoundCloud | MusicBrainz |
|---------|---------|---------|-----------|-------------|
| Search tracks | ✅ Excellent | ⚠️ Basic | ✅ Good | ✅ By metadata |
| Metadata richness | ✅ Very Good | ✅ Good | ✅ Good | ✅ Excellent |
| Audio features | ✅ Yes (energy, danceability, etc.) | ❌ No | ❌ No | ❌ No |
| Artist similarity | ✅ Via recommendations | ✅ Explicit similar artists | ❌ No | ⚠️ Via relationships |
| User recommendations | ✅ Algorithm-based | ⚠️ Chart-based | ❌ No | ❌ No |
| Track playback | ✅ Embed SDK | ❌ Link only | ✅ HTML5 Widget | ❌ No |
| User listening history | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Discovery playlists | ✅ Yes | ⚠️ Genre charts | ✅ Curated | ❌ No |
| Open data | ❌ No | ⚠️ Limited | ❌ No | ✅ Yes (ODbL) |

---

## 4. Architecture Recommendation

### 🎯 **Recommended Approach: Spotify + Last.fm Hybrid**

#### Architecture Overview

```
Frontend (React App)
    ↓
API Gateway Layer (Node.js backend)
    ├→ Spotify Web API (Search, Recommendations, Playback)
    ├→ Last.fm API (User History, Scrobbling, Additional Discovery)
    └→ Local Cache (MongoDB or similar)
    
User → [My App] ← Spotify + Last.fm ← Music Data
```

#### Why This Approach

**Strengths**:
1. **Best of Both Worlds**:
   - Spotify: Advanced recommendations, audio features, playback
   - Last.fm: User listening history, scrobbling, community data

2. **Personalization**:
   - Spotify recommendations based on audio features and seed tracks
   - Last.fm trending and similar artists for discovery
   - Combined for superior recommendation quality

3. **Resilience**:
   - If Spotify rate-limited, fall back to Last.fm
   - If one API down, still functional with other

4. **Data Enrichment**:
   - Spotify provides audio features
   - Last.fm provides community insights (similar artists, tags)
   - MusicBrainz (optional) for comprehensive metadata

5. **User Experience**:
   - Search via Spotify (best metadata coverage)
   - Recommendations via Spotify algorithm
   - Show similar artists from Last.fm
   - Embed Spotify player for playback

#### Implementation Phases

**Phase 1: Spotify Only (MVP)**
```
1. Implement Spotify OAuth
2. Search functionality
3. Recommendations endpoint
4. Track preview links
5. Favorite tracks (stored locally)
```

**Phase 2: Add Last.fm Integration**
```
1. Last.fm API key auth
2. Scrobbling (if user has account)
3. Similar artists display
4. User listening charts
```

**Phase 3: Enhanced Recommendations**
```
1. Combine Spotify + Last.fm data
2. Custom recommendation engine
3. User preference learning
4. Caching for performance
```

#### Data Flow Example

```
User searches "indie rock" →
  Spotify: Returns 50 best indie rock tracks
    ↓
User clicks "Similar Artists" →
  Last.fm: Returns artists similar to selection
    ↓
User clicks "Get Recommendations" →
  Spotify: Generates 20 recommendations based on seeds
    ↓
User clicks "Save Track" →
  Local Storage: Saves to favorites
  Spotify: Adds to user's Spotify library (if connected)
  Last.fm: Scrobbles track (if connected)
```

---

## 5. Authentication & Permission Requirements

### Spotify Setup

**Developer Registration**:
1. Go to [developer.spotify.com](https://developer.spotify.com)
2. Sign in or create account (free)
3. Accept Spotify Developer Agreement
4. Create Application in dashboard
5. Get Client ID and Client Secret
6. Add redirect URI(s)

**OAuth Flow** (for user data):
```
User Authorization
  ↓
Redirect to Spotify login
  ↓
Grant app permissions (what data it accesses)
  ↓
Redirect back with authorization code
  ↓
Exchange code for access token (+ refresh token)
  ↓
Use token to access Spotify API
  ↓
Token expires → Use refresh token to get new token
```

**Scopes Required** (permissions):
- `user-read-private`: Access email and profile info
- `user-read-email`: Access email
- `user-library-read`: Access saved tracks
- `user-library-modify`: Save/unsave tracks
- `user-top-read`: Access top tracks/artists
- `user-read-playback-state`: View current playback
- `user-modify-playback-state`: Control playback

### Last.fm Setup

**API Key Registration**:
1. Go to [last.fm/api](https://www.last.fm/api)
2. Create an account (if needed)
3. Create API application
4. Get API key (provided immediately)
5. Optional: Get shared secret for secured calls

**No OAuth Required** for basic API key usage  
**Optional OAuth** for user-specific operations

---

## 6. Data Use & Playback Restrictions

### Spotify

⚠️ **Strict Restrictions**:
- **No ML/AI**: Cannot train machine learning models on Spotify data
- **Non-Commercial Only**: Personal use only on free tier
- **No Caching**: Content is licensed, not owned
- **Attribution Required**: Must credit Spotify when showing metadata
- **Embedding**: Requires approval for in-app players
- **Download Prohibition**: No downloading tracks

✅ **Allowed**:
- Display track metadata with attribution
- Embed Spotify Player (limited)
- Show recommendations
- Create playlists
- Save favorites

### Last.fm

⚠️ **Moderate Restrictions**:
- **Commercial Use**: Must contact partners@last.fm
- **Research/Academic**: Must contact partners@last.fm
- **Attribution**: Required for Last.fm data
- **User Data**: Only access with user permission

✅ **Allowed**:
- Display artist info and charts
- Show similar artists
- Display user charts and statistics
- Scrobble tracks (with permission)

### MusicBrainz

✅ **Most Open**:
- **Non-Commercial**: Free and unrestricted
- **Attribution**: Required (ODbL)
- **Open Data**: Community-maintained and open
- **Derivative Works**: Generally allowed under ODbL

### SoundCloud

⚠️ **UNCLEAR**:
- **Terms Not Published**: Contact SoundCloud for clarification
- **Embedding**: Appears allowed but scope unclear
- **Commercial Use**: Policy not documented
- **Recommendation**: Get written permission before production

---

## 7. Rate Limits & Quotas

| Provider | Rate Limit | Throttle Response | Notes |
|----------|-----------|------------------|-------|
| **Spotify** | Rolling 30s window (varies) | 429 status + `Retry-After` | No public numbers; development mode is limited |
| **Last.fm** | Not published (historically generous) | 5xx error | Typically several req/sec |
| **SoundCloud** | Not published | 429 status | Undocumented; assume < 1000/day |
| **MusicBrainz** | 1 request per second, max | 503 Service Unavailable | Very strict; requires User-Agent header |

---

## 8. Unresolved Questions & Next Steps

### Questions Requiring Clarification

1. **Spotify Commercial Terms**:
   - [ ] Is portfolio project acceptable?
   - [ ] Can monetized features use Spotify API?
   - [ ] What exactly constitutes "commercial"?
   - **Action**: Contact Spotify for Developers program details

2. **SoundCloud API Stability**:
   - [ ] Is the API actively maintained?
   - [ ] What's the deprecation roadmap?
   - [ ] What are exact ToS for embedding?
   - **Action**: Email developers@soundcloud.com for clarification

3. **Last.fm Commercial Use**:
   - [ ] What does "commercial" include?
   - [ ] What's the approval process timeline?
   - [ ] Are there usage tiers?
   - **Action**: Email partners@last.fm with project details

4. **Playback Requirements**:
   - [ ] Must users be redirected to Spotify/SoundCloud?
   - [ ] Or can we embed a web player?
   - [ ] Are preview links sufficient for MVP?
   - **Action**: Clarify product requirements

### Recommended Next Steps

**Step 1: MVP Architecture Decision** (Required)
- [ ] Confirm Spotify as primary API
- [ ] Confirm Last.fm as secondary API
- [ ] Document decision in project README

**Step 2: OAuth Implementation Planning** (Required)
- [ ] Design Spotify OAuth flow diagram
- [ ] Plan backend token storage (secure)
- [ ] Plan token refresh mechanism
- [ ] Plan fallback if OAuth fails

**Step 3: Legal Review** (Recommended)
- [ ] Get confirmation from Spotify for intended use
- [ ] If commercial plans: Contact Spotify for Developers partnership
- [ ] If monetizing: Get Last.fm commercial approval

**Step 4: Prototype Phase** (Start)
- [ ] Set up Spotify developer account
- [ ] Set up Last.fm API key
- [ ] Implement search endpoint (Spotify)
- [ ] Test rate limits and response times
- [ ] Plan backend caching strategy

**Step 5: Integration Planning** (Preparation)
- [ ] Design backend API wrapper layer
- [ ] Plan database schema for caching
- [ ] Design error handling (API failures)
- [ ] Plan monitoring and logging

---

## 9. Cost Analysis

| Provider | Free Tier | Commercial | Total Cost for MVP |
|----------|-----------|-----------|-------------------|
| **Spotify** | Web API (limited) | Spotify for Developers program | $0 initially; $0/month for portfolio; ?? for commercial |
| **Last.fm** | API access | Contact for pricing | $0 initially; $0/month for hobby; contact for commercial |
| **SoundCloud** | API access | Unknown | $0 initially; unclear for commercial |
| **MusicBrainz** | Non-commercial free | Commercial licensing | $0 for hobby; contact MetaBrainz for commercial |

**Total Estimate for MVP**: **$0** (within free tiers)  
**Total Estimate for Commercial**: **$0-5000/month** (depending on Spotify and Last.fm commercial terms)

---

## 10. Comparative Summary

### Best For Personalized Recommendations
**Winner: Spotify**
- Algorithm-based recommendations
- Audio feature tuning
- Seed-based discovery
- Extensive API documentation

### Best For User Listening History
**Winner: Last.fm**
- Scrobbling and tracking
- User-specific charts
- Similar artists based on listening
- Community data

### Best For Music Metadata
**Winner: MusicBrainz**
- Most comprehensive metadata
- Open and community-maintained
- No usage restrictions for hobby projects
- Excellent for reference data

### Best For Direct Track Playback
**Winner: Spotify or SoundCloud**
- Spotify: Embed player, SDK support
- SoundCloud: Direct streaming URLs
- Both allow embedding in web applications

### Best for Development Ease
**Winner: Spotify**
- Excellent documentation
- Active developer community
- Clear rate limiting communication
- Regular API updates with warning periods

---

## 11. Recommendation Summary

### For This Project: Use Spotify + Last.fm

**Spotify** is the primary recommendation because:
1. ✅ Best-in-class recommendation engine
2. ✅ Excellent API documentation
3. ✅ Active developer community
4. ✅ Clear OAuth flow for user data
5. ✅ Generous rate limits for development
6. ✅ Audio features for advanced personalization

**Last.fm** as secondary for:
1. User listening history integration
2. Community artist similarity data
3. Discovery via trending/charts
4. Scrobbling capability

**MusicBrainz** (optional) for:
1. Reference metadata enrichment
2. Open-source projects
3. Comprehensive recording information

**SoundCloud** (conditional):
- Consider only if specific SoundCloud track embedding required
- Risk of unclear terms; document thoroughly before production

### Implementation Priority

1. **Phase 1 (MVP)**: Spotify search + recommendations
2. **Phase 2**: Add user authentication and favorites
3. **Phase 3**: Integrate Last.fm for enhanced discovery
4. **Phase 4**: Add analytics and learning

---

## 12. Sources & References

### Official Documentation

- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Spotify Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Spotify Recommendations](https://developer.spotify.com/documentation/web-api/reference/get-recommendations)
- [Spotify Terms of Use](https://www.spotify.com/us/legal/end-user-agreement/)
- [Last.fm API](https://www.last.fm/api)
- [Last.fm API Methods](https://www.last.fm/api/show)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [SoundCloud Developers](https://developers.soundcloud.com)

### Research Limitations

⚠️ **Web Search Limitations Encountered**:
- Some search queries returned no specific results (noted in research)
- Genius API documentation unavailable (Claude Code fetch limitation)
- Some provider pricing pages not directly accessible
- Current status may change between research date and implementation

**Recommendation**: Verify current terms on official websites before implementation.

---

## 13. Final Decision Matrix

**Recommended for Production Use**:

```
Primary: Spotify Web API
├─ Search & Discovery
├─ Personalized Recommendations
├─ Playback Embedding
└─ User Library Integration

Secondary: Last.fm API
├─ User Listening History
├─ Artist Similarity
├─ Trending Discovery
└─ Scrobbling

Reference (Optional): MusicBrainz API
├─ Metadata Enrichment
├─ Recording Information
└─ Non-Commercial Support
```

---

**Document Status**: ✅ Complete & Ready for Implementation  
**Next Action**: Begin Spotify OAuth implementation (Phase 1)  
**Questions?**: Refer to Section 8 (Unresolved Questions) or contact API providers directly  

---

**Prepared**: October 22, 2026  
**For**: SoundCloud Discovery Project  
**By**: API Research Analysis  
**Approval Status**: Ready for Development Team Review

