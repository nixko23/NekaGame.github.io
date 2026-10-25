# Audius Playback Feasibility and Implementation Status

**Verified:** October 25, 2026 against current official Audius documentation and the live API.

## What the official contract documents

- Audius API reference describes track search and stream endpoints for music players and discovery apps. Most read-only endpoints work without credentials; an API key increases rate limits. The endpoints used are `GET /v1/tracks/search?query=...` and `GET /v1/tracks/{track_id}/stream`.
- The JavaScript SDK `searchTracks` reference documents query, offset, limit, genre and sorting parameters. The REST API reference documents `/tracks/{track_id}/stream`.
- The Open Music License (last updated July 2, 2025) grants Music Players a worldwide, non-exclusive, royalty-free license to stream, transmit and publicly perform material. Its default grant applies unless a creator supplies an Alternative License. The OML states creators warrant their rights, while the material is otherwise offered as-is/as-available.
- Audius permits creators to turn off API access and to set alternate licenses or stream gates. The stream-gate guide says gated tracks require a server-side signature; this app does not implement or bypass gates.

Official sources: [Audius API](https://docs.audius.co/api/), [Track SDK](https://docs.audius.co/sdk/tracks/), [Open Music License](https://audius.org/open-music-license.pdf), [Audius Terms of Use](https://audius.co/documents/TermsOfUse.pdf), [Gate release access](https://docs.audius.co/developers/guides/gate-release-access/).

## Current app behavior

- An Audius source option searches live tracks through the official REST API. Search uses a 500 ms debounce, aborts superseded requests, and displays loading, empty, rate-limit, malformed-response and connection errors.
- Results map to the existing `InternalTrack` model and provider-neutral `rankTracks`; no Audius API code is in `src/recommendation/**`.
- Cards show creator, available artwork/genre/duration/play count, a canonical Audius link, recommendation explanation and an explicit play control. Audius results are not added to demo Favorites; first-party feedback remains independent.
- Play is enabled only when returned data explicitly reports license `All rights reserved` (the Audius default for purposes of the OML rather than a separate alternative license), `is_streamable === true`, `is_available === true`, `is_delete === false`, `is_unlisted === false`, `is_stream_gated === false`, `stream_conditions === null`, `access.stream === true`, and no non-empty API-key allow-list. Missing or different license state fails closed. The UI displays but disables other search results.
- A persistent native `<audio>` element uses the documented stream route only after the user clicks Play; no autoplay, audio download, stream scraping, direct media URL reconstruction, or cached redirect URL is used. The bottom player supports Play/Pause/Resume, progress/duration, seeking, Stop, track switching, buffering and playback errors. The canonical Audius page remains available.
- Creator API opt-out is honored by relying only on public search results; gated/unavailable/deleted/removed tracks are not force-played. Stream failures are reported and users can choose another result.

## Verification actually performed

**Live API request (PowerShell, October 25, 2026):** `GET https://api.audius.co/v1/tracks/search?query=electronic&limit=...` returned track data with creator, metadata, `license`, `is_streamable`, `access.stream`, `is_stream_gated`, `stream_conditions`, and `is_available` fields. A public default-license track returned HTTP 302 from its documented `/tracks/{id}/stream` endpoint to a signed Audius content-node URL.

**Browser smoke test (local app, October 25, 2026):** Searched `electronic`; played `Day Dreamin' (Electronic Type Beat)[Remake]` by `uezurii.flac`; browser-native media reported `paused: false`, `readyState: 4`, no error and playback time advancing (0.95 s then 3.4 s). Pause set `paused: true`; Resume restarted it; ArrowRight on the progress slider sought; switching to `Electronic Giveaway` by `Brentin Davis` loaded a different stream and its time advanced to about 6.6 s with `readyState: 4` and no error; Stop paused and cleared the source. Browser console error/warning log was empty when checked. This verifies one browser/session and two tracks, not long-term availability or legal clearance for all catalog entries.

### Queue and volume follow-up

- The player queue stores Audius track IDs with display metadata in localStorage. On reload it calls the documented track detail endpoint and rechecks stream eligibility before enabling playback; failed lookups stay visible as unavailable entries. Duplicate IDs are rejected. The first eligible queued item outranks ranked recommendations in Next Up and on track end.
- Users can queue eligible Audius cards, reorder/remove/clear the queue, explicitly Play Next, cycle recommendation suggestions, and enable Autoplay Next. Autoplay defaults off. Queue controls and the compact player remain in the existing player UI.
- Volume preference and Autoplay Next preference persist locally. The range is wired to `HTMLAudioElement.volume` and mute to its `muted` property; unmute restores the last nonzero volume. Volume controls are labeled and keyboard-operable.
- **Automated verification (October 25, 2026):** 6 test files / 96 tests passed; lint, TypeScript, and production build passed. Coverage includes queue deduplication/order/removal/clear, queue restoration and provider revalidation, queue-first Play Next and ended behavior, autoplay default/off and enabled behavior, volume 0/50/100, mute restore, persistence, and audio element synchronization.
- **Browser verification:** In the in-app browser, added two live Audius results, reordered them, played the newly first queued result, removed the other item, added it again and cleared the queue. Reload restored a queued `Electronic Giveaway` by Brentin Davis; it was revalidated and played from the queue at `https://api.audius.co/v1/tracks/lzkYw/stream`, reaching `readyState: 4` and advancing with no media error. The browser UI displayed 50% and mute/unmute changed the native `muted` state. The browser inspection API returned `audio.volume` as `undefined`, so an actual loudness change could not be independently measured there; the automated DOM test verified volume property values and synchronization. Console errors/warnings were empty. One browser session only.

## Remaining limitations and questions

- Provider Terms / OML applicability to this app's personalized ranking, ranking explanations, first-party feedback storage, branding and display has not been individually approved by Audius. The current implementation follows public docs but is not legal advice or a claim that Audius reviewed this app.
- `All rights reserved` is treated as the default case under the OML only when explicitly present. If Audius changes license representations or API behavior, mapping must fail closed until re-reviewed.
- Search returns a fixed first page of 25; no pagination or API key is configured. Rate limits and API uptime are not guaranteed. Browser network/CORS availability may vary.
- A stream can become unavailable after search; native browser codecs/network conditions vary. Search metadata may be incomplete or incorrectly uploaded by creators.
- Tracks with Creative Commons or other alternative license values are disabled, rather than interpreting individual licenses. Gated tracks, authentication, payments, and region restrictions are not implemented.
- The Audius Open Music License includes creator warranties and liability language; those do not independently verify a specific uploader's chain of rights. Ask Audius for confirmation of the ranking/player use and verify item eligibility before any broader release.
- This local integration has not been tested across browsers, mobile, deployments, or commercial use. No backend is needed for the current anonymous public search/stream flow; gated streams would require a server and remain out of scope.
- Queue restoration relies on live per-track lookups; when offline or when a track is removed, its saved entry remains unavailable until it is removed and re-added from fresh search results. Native volume control depends on browser support for `HTMLMediaElement.volume`; actual loudness was not measurable through this browser inspection environment.
