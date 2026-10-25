# MusicBrainz Metadata Search Status

**Verified:** October 25, 2026 against official MusicBrainz API, search, data-license, and Cover Art Archive documentation.

## Implemented

- The app has a `Demo catalog` / `MusicBrainz` source switch. Demo catalog search, genres, favorites, playlists, and prior feedback behavior remain available.
- MusicBrainz search is debounced by 500 ms and can be cancelled when its query or source changes. The UI reports loading, no query, no results, provider errors, and overload distinctly.
- The frontend calls `GET /api/musicbrainz/search?query=<text>`. The Vite development and preview middleware queries the official `GET https://musicbrainz.org/ws/2/recording/?query=<lucene>&fmt=json&limit=25` endpoint. The Lucene query matches recording titles or recording artist names (`recording` OR `artistname`), with literal input escaped.
- The proxy sends `Accept: application/json` and `User-Agent: SoundCloudDiscovery/0.0.0 (local development prototype)`. No maintainer contact or project URL was present to include; supply a real contact URL/email in a future hosted deployment if available. There is no API key or secret.
- A single in-process queue enforces at least one second between outbound requests and serializes bursts. The proxy maps upstream overload (429/503) to a retryable 503 with `Retry-After` when available, other upstream failures to 502, timeout to 504, and invalid JSON/schema to 502. Search terms must be 1–120 characters.
- The provider maps recording MBID, title, artist credit, recording length in seconds, optional first release title/date, and canonical `https://musicbrainz.org/recording/<MBID>` link. Invalid IDs/titles are dropped. Missing artists are displayed as unknown and excluded from ranking/feedback.
- No tags, genres, search scores, popularity, artwork, preview URLs, or playback URLs are mapped. Cards link back to MusicBrainz and state that results are metadata only, cannot be played, and cannot be added to the demo-only Favorites. Like/Skip/Dislike work for results with an artist credit and persist the selected preference plus core metadata/source link.
- Ranking receives mapped `InternalTrack` values through the provider-independent ranking function; no MusicBrainz code was added to scoring/ranking. MusicBrainz candidates have empty genres and unknown popularity, so the engine uses its neutral genre score and artist/novelty/diversity signals only. Missing artist records are not ranked, preventing unsupported explanations.

## Licensing and limits

The mapper uses fields documented as core metadata (recording/title, artist credit, duration, release/date, MBID); core database data is CC0. The user-facing source link is explicit. No artwork is used: MusicBrainz data does not include it, and the Cover Art Archive asks users to respect artist/label rights and states images are used at one's own risk.

The endpoint is the MusicBrainz search service. Its search indexes are described as supplementary CC BY-NC-SA data in the existing provider research. Mapping only core fields does not by itself establish whether querying or ordering results through that index creates attribution/share-alike obligations for this app or its personalized ranked output. This prototype is non-commercial; the license interpretation remains open and no legal clearance is claimed. No general result cache is added; selected user feedback and seen MBIDs are stored in the app's existing localStorage profile.

The public read API needs no API key; MusicBrainz documents non-commercial use as free. Every client application must stay at or below one request/second and send a meaningful User-Agent. The queue is shared within one Vite dev/preview server process, not across separately deployed server instances. A production deployment must provide equivalent server-side proxying and shared rate limiting. No environment variables are required in the current local setup.

The Vite middleware is local development/preview infrastructure, not a production backend. MusicBrainz is metadata only: there is no audio stream, embedded player, or guarantee that a recording is available on any playback service.

## Automated coverage and manual result

Provider tests cover field mapping, optional/malformed records, literal query construction, same-origin request construction, empty query handling, HTTP and malformed-response handling, proxy User-Agent/endpoint, one-second serialization, upstream overload, and invalid payload handling. App tests cover live-provider loading/results, canonical attribution link, disabled/unavailable favorite and playback controls, empty results, and proxy error state. All network responses in automated tests are mocked.

On October 25, 2026, a real browser search for `Dua Lipa` through the local app proxy returned MusicBrainz recordings. The returned UI showed recording titles, credited artists, some release names/dates and durations, canonical MusicBrainz links, no artwork, and no playback control. This confirms live search for that query at that time only; it does not establish API availability guarantees, licensing clearance, or playback permission.

## Official documentation

- [MusicBrainz API (access, JSON, endpoint, User-Agent, rate limit)](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz search API and recording fields](https://musicbrainz.org/doc/MusicBrainz_API/Search)
- [MusicBrainz data license (core CC0 and supplementary CC BY-NC-SA 3.0)](https://musicbrainz.org/doc/About/Data_License)
- [Cover Art Archive policy](https://musicbrainz.org/doc/Cover_Art_Archive)
