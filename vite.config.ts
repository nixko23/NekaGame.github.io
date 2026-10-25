import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createMusicBrainzMiddleware } from './server/musicBrainzProxy.js'

// https://vite.dev/config/
export default defineConfig({
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
