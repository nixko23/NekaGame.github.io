import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMusicBrainzMiddleware } from './musicBrainzProxy.ts'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distRoot = resolve(projectRoot, 'dist')
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])
const musicBrainzMiddleware = createMusicBrainzMiddleware()

function sendError(response, status, message) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify({ error: message }))
}

const server = createServer((request, response) => {
  const requestPath = (request.url ?? '/').split('?', 1)[0]
  if (requestPath === '/api/musicbrainz/search') {
    musicBrainzMiddleware(request, response, () => sendError(response, 404, 'API route not found.'))
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendError(response, 405, 'Use GET for application assets.')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(requestPath)
  } catch {
    sendError(response, 400, 'Invalid request path.')
    return
  }

  const relativePath = pathname.replace(/^[/\\]+/, '')
  let filePath = resolve(distRoot, relativePath || 'index.html')
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
    sendError(response, 403, 'Invalid request path.')
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // The app currently has no client-side router; serve the entry point for extensionless paths.
    if (extname(pathname)) {
      sendError(response, 404, 'Asset not found.')
      return
    }
    filePath = resolve(distRoot, 'index.html')
  }

  const extension = extname(filePath).toLowerCase()
  const cacheControl = pathname.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : extension === '.html' ? 'no-cache' : 'public, max-age=3600'
  response.writeHead(200, {
    'Content-Type': mimeTypes.get(extension) ?? 'application/octet-stream',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).pipe(response)
})

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
server.listen(port, '0.0.0.0', () => {
  console.info(`SoundCloud Discovery production server listening on port ${port}`)
})

