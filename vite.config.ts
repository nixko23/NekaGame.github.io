import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createMusicBrainzMiddleware } from './server/musicBrainzProxy.js'

// https://vite.dev/config/
export default defineConfig({
  // Keep root-domain hosting as the default; set VITE_BASE_PATH to e.g. /repo-name/
  // when building assets for a project subpath such as GitHub Pages.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    {
      name: 'musicbrainz-search-proxy',
      configureServer(server) {
        server.middlewares.use(createMusicBrainzMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(createMusicBrainzMiddleware())
      },
    },
  ],
})
