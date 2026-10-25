# Deployment guide

## Why Render

The frontend can be statically built, but MusicBrainz search is intentionally routed through a server endpoint. The proxy adds an identifying User-Agent and serializes requests to meet MusicBrainz's one-request-per-second IP guidance. GitHub Pages only hosts static files, so it cannot run this endpoint. Audius search and public playback are browser-side, but that does not remove the MusicBrainz server requirement.

The included `render.yaml` deploys the built app and API route together as a single Node web service. Render builds on pushes from a connected Git repository and can wait for GitHub checks. Keep `numInstances: 1`: the current rate limiter is in-memory and only coordinates requests within one process. Scaling out needs shared rate-limiting state first.

## Before publishing

1. Create a new GitHub repository for this app. This project directory currently has an `origin` URL for a different repository (`nixko23/NekaGame.github.io`); do not push this app there. Set the remote to the new repository only after confirming its URL.
2. Push the project and confirm the `Verify` GitHub Actions workflow passes.
3. In Render, choose **New → Blueprint**, connect the new repository, and review the `soundcloud-discovery` web service described by `render.yaml`.
4. Approve service creation in Render. The blueprint uses the free plan by default; free web services spin down after inactivity, so choose an appropriate always-on plan if that behavior is unsuitable.
5. In GitHub repository settings, allow GitHub Actions to run. No Pages configuration or deploy secret is needed for this Render deployment. Render requires connecting/authorizing the GitHub repository in its own dashboard.
6. After Render reports the service healthy, test `/`, `/api/musicbrainz/search?query=radiohead`, Audius search and eligible playback, queue restoration, and browser reload on the Render URL.

No Render account setup, GitHub repository creation, push, service creation, or external deployment was performed for this preparation task.

## Local production smoke test

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000/` (or the port configured in `PORT`). To smoke-test the proxy, request `/api/musicbrainz/search?query=radiohead`. The API query is passed to MusicBrainz; the server applies its User-Agent, timeout, error mapping, and one-second request spacing.

## GitHub Pages limitation

A Vite subpath build is supported with `VITE_BASE_PATH=/repository-name/ npm run build`, and the CI workflow can validate the build. GitHub Pages is **not** the recommended full-app host because it cannot provide `/api/musicbrainz/search`. Hosting only `dist/` there would silently break MusicBrainz search. To use Pages, a separately hosted same-origin-compatible proxy would be required, or MusicBrainz search would have to be removed; neither is part of this setup.

`VITE_BASE_PATH=/` is the default for domain-root deployment. Do not put API credentials or secrets in any `VITE_` variable.

## Official references

- [Render Blueprints](https://render.com/docs/blueprint-spec), [Node web services](https://render.com/docs/web-services), and [Node version selection](https://render.com/docs/node-version).
- [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) and [API FAQ](https://musicbrainz.org/doc/MusicBrainz_API/FAQ).
- [Vite static deployment](https://vite.dev/guide/static-deploy).
- [Node.js TypeScript type stripping](https://nodejs.org/api/typescript.html), used to run the existing erasable-TypeScript proxy module from the production server on Node 22.18+.
