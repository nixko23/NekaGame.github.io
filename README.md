# SoundCloud Discovery

SoundCloud Discovery is a React and TypeScript music-discovery prototype. It combines a provider-independent recommendation engine with a fictional demo catalog, live Audius search and playback for eligible tracks, and MusicBrainz recording metadata search.

## Features

- Personalized ranking and explanations based on Like, Skip, and Dislike feedback.
- Live Audius search, creator attribution, canonical track links, and explicit user-initiated playback. Tracks play only when Audius reports the existing eligibility conditions; gated or alternate-license tracks are not enabled.
- Persistent playback queue with reorder, remove, clear, queue-first Next Up, recommendation suggestions, and optional Autoplay Next (off by default).
- Player seek, volume, mute, and restored volume preference where the browser exposes native media-volume support.
- MusicBrainz recording search for metadata only; MusicBrainz does not supply audio playback.
- Fictional demo catalog with genre filters, Favorites, sample Playlists, persistent local feedback, and responsive UI.

Favorites and Playlists currently apply to the demo catalog. Browser preferences and feedback live in localStorage on that browser and are not synced between users or devices.

## Technology

- React 19, TypeScript 6, Vite 8
- npm and the committed `package-lock.json`
- Vitest, jsdom, React Testing Library, and user-event
- A small Node.js production server for static assets and the MusicBrainz proxy

Use Node.js **22.18+ and below 25**. `.node-version` pins the current deployment/CI runtime to 24.21.0.

## Local setup

```sh
npm ci
npm run dev
```

Vite prints the development URL (normally `http://localhost:5173/`). The development server includes the MusicBrainz proxy middleware.

## Checks and production build

```sh
npm test -- --run
npm run lint
npx tsc -b --pretty false
npm run build
```

Run the production build and same-origin API proxy locally with:

```sh
npm run build
npm start
```

The production server listens on `PORT` when provided by the host, or port 3000 locally. It serves `dist/`, handles extensionless paths with the app entry point, and exposes `/api/musicbrainz/search` on the same origin. `npm run preview` is Vite's preview helper; `npm start` exercises the production server used by hosting.

## Configuration and secrets

No API key, OAuth secret, or deployment secret is required. Audius public search, public stream routes, and MusicBrainz search use public endpoints. The hosting platform supplies `PORT`.

`VITE_BASE_PATH` is an optional **build-time public asset path**, not a secret. The default `/` is for a domain root. For a static project-subpath build, set a value such as `/repository-name/`. Never put secrets in a `VITE_` variable because Vite embeds client variables into the browser bundle.

## GitHub and deployment

The repository includes a GitHub Actions workflow at `.github/workflows/verify.yml` that installs from the lockfile and runs tests, lint, TypeScript, and build for pushes and pull requests.

The recommended host is a **Render Node Web Service**. The app needs a same-origin server for MusicBrainz's identifying User-Agent and rate-limited proxy; a static-only host would break that feature. `render.yaml` defines a single-instance web service, production build/start commands, health check, and deploys after GitHub checks pass. See [DEPLOYMENT.md](DEPLOYMENT.md) for repository and hosting setup.

Do not push this working directory to a repository unless you have confirmed its remote points to the new SoundCloud Discovery repository. Do not commit `node_modules`, `dist`, `.env` files, credentials, or tokens. No LICENSE file has been selected; choose and add a license before granting reuse permissions.

## Provider and product limitations

- Audius requests run directly from the browser and were tested against the real API. Availability, CORS, track metadata, and stream rights remain controlled by Audius and each creator. The current app fails closed for unknown, alternate-license, gated, or restricted tracks. Technical playback does not establish provider approval or legal clearance for this app's recommendation use.
- MusicBrainz search uses a Node-side proxy that sends an identifying User-Agent and serializes requests to at most one per second. Keep the service at one instance unless the limiter is replaced with a shared/global limiter. MusicBrainz can return 503/429 and the UI reports those errors.
- See [Audius feasibility and playback status](AUDIUS_FEASIBILITY.md) and [MusicBrainz API status](MUSICBRAINZ_API_STATUS.md) for provider-specific notes and remaining questions.
- MusicBrainz results are metadata only. The demo catalog is fictional. No Spotify, SoundCloud API, login, server database, cross-device persistence, or commercial release approval is included.
- Browser volume adjustment depends on native `HTMLMediaElement.volume` support. The app reflects saved preference and mute state; a recent in-app browser inspection did not expose the media element's numeric volume for independent loudness verification.
- The product name does not imply affiliation with SoundCloud.

## License

No project license has been chosen. All rights remain with their respective owners unless a license is added.
