
interface ProxyRequest {
  method?: string
  url?: string
}

interface ProxyResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(value?: string): void
}

const API_ENDPOINT = 'https://musicbrainz.org/ws/2/recording'
const USER_AGENT = 'SoundCloudDiscovery/0.0.0 (MusicBrainz recording search)'
const REQUEST_TIMEOUT_MS = 10000
const MIN_INTERVAL_MS = 1000

let queue: Promise<void> = Promise.resolve()
let nextRequestAt = 0

function sendJson(
  res: ProxyResponse,
  status: number,
  body: unknown,
  retryAfter?: string,
) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (retryAfter) res.setHeader('Retry-After', retryAfter)
  res.end(JSON.stringify(body))
}

export default async function handler(
  req: ProxyRequest,
  res: ProxyResponse,
) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Use GET for MusicBrainz search.' })
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const query = url.searchParams.get('query')?.trim() ?? ''

  if (!query || query.length > 120) {
    return sendJson(res, 400, {
      error: 'Enter a search term up to 120 characters.',
    })
  }

  let resolveQueue!: () => void

  const task = queue.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now())

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    nextRequestAt = Date.now() + MIN_INTERVAL_MS
  })

  queue = task.then(() => undefined, () => undefined)

  try {
    await task

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const params = new URLSearchParams({
        query,
        fmt: 'json',
        limit: '25',
      })

      const upstream = await fetch(`${API_ENDPOINT}?${params}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        signal: controller.signal,
      })

      if (upstream.status === 429 || upstream.status === 503) {
        return sendJson(
          res,
          503,
          { error: 'MusicBrainz is busy. Please try again shortly.' },
          upstream.headers.get('retry-after') ?? '1',
        )
      }

      if (!upstream.ok) {
        return sendJson(res, 502, {
          error: 'MusicBrainz search is temporarily unavailable.',
        })
      }

      let body: unknown

      try {
        body = await upstream.json()

        if (
          !body ||
          typeof body !== 'object' ||
          !Array.isArray((body as { recordings?: unknown }).recordings)
        ) {
          throw new Error('Invalid response')
        }
      } catch {
        return sendJson(res, 502, {
          error: 'MusicBrainz returned an invalid response.',
        })
      }

      return sendJson(res, 200, body)
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return sendJson(res, 502, {
      error: 'MusicBrainz search could not be reached.',
    })
  }
}
