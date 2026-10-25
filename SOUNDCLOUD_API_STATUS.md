# SoundCloud API Status — October 25, 2026

## Current decision

Real search is not enabled in the app. No SoundCloud credential environment variables or local `.env` files were present during project inspection. The SoundCloud provider module added for this task is a tested, unconfigured boundary; the visible UI continues to use the local mock catalog. No live provider request was made, so no API integration is claimed.

Two prerequisites must be resolved before connecting the app:

1. **Register and provision credentials.** SoundCloud currently requires an Artist Pro subscription to register an API application. The registration workflow requires account pairing/approval and issues a client ID and client secret. Keep the secret on a server.
2. **Confirm the intended product is permitted.** The current app name contains the SoundCloud mark; API terms say SoundCloud marks cannot be used in an app name. The terms also restrict alternative digital content services that aggregate and stream user content. Obtain SoundCloud guidance/approval for this product’s discovery, playlist, and recommendation use before integrating returned user content. Rename the product before any approved API use.

## Official API facts

- **Search:** `GET https://api.soundcloud.com/tracks` with `q`, `limit`, and optionally `linked_partitioning=true`. The query searches fields including track title and username. Public track search accepts either an Authorization Code or Client Credentials token.
- **Public search auth:** OAuth 2.1 Client Credentials grant at `https://secure.soundcloud.com/oauth/token`, using HTTP Basic client credentials. SoundCloud currently treats all clients as confidential, so requests containing the client secret belong on a server. The API request header is `Authorization: OAuth <access-token>`. Access tokens live roughly one hour; refresh tokens are single-use and token issuance is rate limited.
- **Track fields used by the mapper:** `id`, `title`, `metadata_artist`, `user.username`, `artwork_url` (with uploader avatar fallback), `duration` in milliseconds, `playback_count`, `genre`, `tag_list`, and `permalink_url`. Missing fields receive safe defaults; malformed records are skipped. Stream URLs are intentionally not mapped to a preview/player field.
- **Playback:** the official guide describes the SoundCloud Widget/oEmbed and custom streaming URLs. Custom streaming requires the track’s stream URL, which may be unavailable for blocked/restricted content. Displaying or streaming content requires crediting the uploader and SoundCloud and visibly linking each sound to its permalink. This app has no playback implementation.
- **Rate limits:** SoundCloud documents the general per-application request budget, stricter search/playback limits, `X-Ratelimit-*` headers, and `Retry-After` for 429 responses. These values can change.
- **Terms risks:** current terms prohibit using SoundCloud marks in app names and restrict alternative digital content services aggregating and streaming User Content. They also require attribution and contain restrictions on AI/ML use of User Content. Product naming and permitted use of the recommendation flow need confirmation before live data is connected.

## Implementation in this task

- Added `TrackSearchProvider` and a SoundCloud provider module outside the recommendation ranking/scoring code.
- Added input validation/mapping, search request construction, paginated and array response handling, empty-query behavior, and explicit HTTP/JSON/shape errors.
- The provider takes an access-token supplier; it does not accept or store a client secret. A server token manager and the actual UI integration remain unimplemented because credentials and product/terms clearance are unavailable.
- The mock UI, favorites, playlists, and provider-independent recommendation logic remain the active app experience.

## Official sources

- [Get an API key](https://developers.soundcloud.com/docs/api/register-app)
- [API Guide: authentication, playback, search, CORS, and errors](https://developers.soundcloud.com/docs/api/guide)
- [Public API Explorer](https://developers.soundcloud.com/docs/api/explorer/open-api)
- [API Terms of Use](https://developers.soundcloud.com/docs/api/terms-of-use)
- [Rate limits](https://developers.soundcloud.com/docs/api/rate-limits.html)
