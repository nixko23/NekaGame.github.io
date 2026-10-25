const API_ENDPOINT = 'https://musicbrainz.org/ws/2/recording'
const USER_AGENT = 'SoundCloudDiscovery/0.0.0 (MusicBrainz recording search)'
const MIN_INTERVAL_MS = 1000
const REQUEST_TIMEOUT_MS = 10000
const MAX_PENDING_REQUESTS = 40

interface UpstreamResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  json(): Promise<unknown>
}

export class MusicBrainzProxy {
  private queue: Promise<void> = Promise.resolve()
  private pendingRequests = 0
  private nextRequestAt = 0
  private readonly fetcher: (url: string, init: RequestInit) => Promise<UpstreamResponse>
  private readonly now: () => number
  private readonly wait: (milliseconds: number) => Promise<void>

  constructor(
    fetcher: (url: string, init: RequestInit) => Promise<UpstreamResponse> = fetch as unknown as (url: string, init: RequestInit) => Promise<UpstreamResponse>,
    now: () => number = Date.now,
    wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.fetcher = fetcher
    this.now = now
    this.wait = wait
  }

  search(query: string): Promise<{ status: number; body: unknown; retryAfter?: string }> {
    if (this.pendingRequests >= MAX_PENDING_REQUESTS) {
      return Promise.resolve({ status: 429, body: { error: 'MusicBrainz search is busy. Please try again shortly.' }, retryAfter: '1' })
    }
    this.pendingRequests += 1
    let resolveResult!: (result: { status: number; body: unknown; retryAfter?: string }) => void
    const result = new Promise<{ status: number; body: unknown; retryAfter?: string }>((resolve) => { resolveResult = resolve })
    const request = this.queue.then(async () => {
      const delay = Math.max(0, this.nextRequestAt - this.now())
      if (delay) await this.wait(delay)
      this.nextRequestAt = this.now() + MIN_INTERVAL_MS

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const params = new URLSearchParams({ query, fmt: 'json', limit: '25' })
        const response = await this.fetcher(`${API_ENDPOINT}?${params}`, {
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          signal: controller.signal,
        })
        if (response.status === 503 || response.status === 429) {
          resolveResult({ status: 503, body: { error: 'MusicBrainz is busy. Please try again shortly.' }, retryAfter: response.headers.get('retry-after') ?? undefined })
          return
        }
        if (!response.ok) {
          resolveResult({ status: 502, body: { error: 'MusicBrainz search is temporarily unavailable.' } })
          return
        }
        let body: unknown
        try {
          body = await response.json()
          if (!body || typeof body !== 'object' || !Array.isArray((body as { recordings?: unknown }).recordings)) throw new Error('Invalid response')
        } catch {
          resolveResult({ status: 502, body: { error: 'MusicBrainz returned an invalid response.' } })
          return
        }
        resolveResult({ status: 200, body })
      } catch {
        resolveResult({ status: controller.signal.aborted ? 504 : 502, body: { error: controller.signal.aborted ? 'MusicBrainz search timed out.' : 'MusicBrainz search could not be reached.' } })
      } finally {
        clearTimeout(timer)
        this.pendingRequests -= 1
      }
    })
    this.queue = request.then(() => undefined, () => undefined)
    return result
  }
}

interface ProxyRequest {
  url?: string
  method?: string
}

interface ProxyResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(value?: string): void
}

function sendJson(response: ProxyResponse, status: number, body: unknown, retryAfter?: string): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (retryAfter) response.setHeader('Retry-After', retryAfter)
  response.end(JSON.stringify(body))
}

export function createMusicBrainzMiddleware(proxy = new MusicBrainzProxy()) {
  return (request: ProxyRequest, response: ProxyResponse, next: (error?: Error) => void) => {
    const [pathname, queryString = ''] = (request.url ?? '/').split('?', 2)
    if (pathname !== '/api/musicbrainz/search') return next()
    if (request.method !== 'GET') return sendJson(response, 405, { error: 'Use GET for MusicBrainz search.' })
    const query = new URLSearchParams(queryString).get('query')?.trim() ?? ''
    if (!query || query.length > 120) return sendJson(response, 400, { error: 'Enter a search term up to 120 characters.' })
    void proxy.search(query).then(({ status, body, retryAfter }) => sendJson(response, status, body, retryAfter))
  }
}
