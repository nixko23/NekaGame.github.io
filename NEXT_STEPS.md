# SoundCloud Discovery — Next Steps

**Updated:** October 25, 2026

## Current implementation

- React + TypeScript + Vite app retains the demo catalog, MusicBrainz metadata search, Favorites, Playlists, feedback, localStorage, and the provider-independent recommendation engine.
- Audius live search and native HTML audio playback are implemented. Search results are mapped to `InternalTrack` and ranked through the existing engine. Playback uses Audius' documented stream redirect, has a persistent compact player with Play/Pause/Resume, seek/progress, Stop, loading and failure feedback, and only starts after an explicit click.
- The Audius player now supports a persistent queue with duplicate prevention, reorder/remove/clear, queue-first Next Up, eligible queued-track restore validation, recommendation suggestions, and Autoplay Next (off by default). Volume/mute controls save the preference and apply it to the HTML audio element.
- Playability fails closed unless Audius explicitly reports the default OML license, publicly available/streamable access, no gate/restriction, and no API-key allow-list. Unknown and alternate-license tracks remain visible but cannot be played. The player never attempts gated access.
- A real browser smoke test covered live search, queue controls, restored queue playback, and pause/resume/seek/stop. See [AUDIUS_FEASIBILITY.md](AUDIUS_FEASIBILITY.md) for the browser evidence and verification limits.

## Verification (October 25, 2026)

- `npm test -- --run`: passed, 6 test files / 96 tests.
- `npm run lint`: passed clean.
- `npx tsc -b --pretty false`: passed.
- `npm run build`: passed; Vite built 35 modules.
- Browser: live Audius search, queue add/reorder/remove/clear, persisted queue restoration with live metadata revalidation, and playing a restored queued track were verified. Playback reached `readyState: 4`, advanced with no media error, and console errors/warnings were empty. The volume UI showed 50%; mute/unmute state changed. The browser inspection interface returned `audio.volume` as undefined, so actual loudness changes could not be independently confirmed in this browser session. Automated tests verify the media element volume property in jsdom. One browser session only.

## Single recommended next task

**Before a broader release, obtain Audius confirmation that the current default-OML eligibility rule and this app's first-party personalized ranking/explanations are covered, and validate the rule against any API schema changes.** Do not expand playback to alternate-license or gated tracks without explicit rights/access handling. Then perform a short second-browser/mobile compatibility check; this first verification covered one local browser session only.

## References

- [Provider comparison and architecture](PROVIDER_DECISION.md)
- [Audius feasibility and actual browser verification](AUDIUS_FEASIBILITY.md)
- [MusicBrainz metadata-only integration status](MUSICBRAINZ_API_STATUS.md)


