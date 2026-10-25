import type { InternalTrack } from '../recommendation/types'
import type { TrackSearchProvider } from './types'

const AUDIUS_API_BASE = 'https://api.audius.co/v1'
const AUDIUS_TRACK_ID = /^[a-zA-Z0-9_-]+$/
const AUDIUS_PAGE_HOSTS = new Set(['audius.co', 'www.audius.co'])

interface AudiusTrackPayload {
  id?: unknown
  title?: unknown
  user?: { name?: unknown; handle?: unknown } | null
  artwork?: Record<string, unknown> | null
  genre?: unknown
  tags?: unknown
  duration?: unknown
  play_count?: unknown
  permalink?: unknown
  license?: unknown
  is_streamable?: unknown
  is_available?: unknown
  is_delete?: unknown
  is_unlisted?: unknown
  is_stream_gated?: unknown
  stream_conditions?: unknown
  access?: { stream?: unknown } | null
  allowed_api_keys?: unknown
}

export interface AudiusTrack extends InternalTrack {
  source: 'audius'
  playbackId: string
  playbackAvailable: boolean
  isStreamable?: boolean
  playbackUnavailableReason?: string
}

export class AudiusSearchError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AudiusSearchError'
    this.status = status
  }
}

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function getCanonicalTrackUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value, 'https://audius.co')
    return url.protocol === 'https:' && AUDIUS_PAGE_HOSTS.has(url.hostname) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function getArtwork(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const artwork = value as Record<string, unknown>
  return safeHttpUrl(artwork['480x480']) ?? safeHttpUrl(artwork._480x480) ??
    safeHttpUrl(artwork['150x150']) ?? safeHttpUrl(artwork._150x150)
}

function isExplicitlyStreamable(track: AudiusTrackPayload): boolean {
  const apiKeyRestricted = Array.isArray(track.allowed_api_keys) && track.allowed_api_keys.length > 0
  return track.is_streamable === true &&
    track.is_available === true &&
    track.is_delete === false &&
    track.is_unlisted === false &&
    track.is_stream_gated === false &&
    track.stream_conditions === null &&
    track.access?.stream === true &&
    !apiKeyRestricted
}

/** Map only provider metadata and positive, explicit public-stream eligibility. */
export function mapAudiusTrack(value: unknown): AudiusTrack | null {
  if (!value || typeof value !== 'object') return null
  const track = value as AudiusTrackPayload
  if (typeof track.id !== 'string' || !AUDIUS_TRACK_ID.test(track.id)) return null
  if (typeof track.title !== 'string' || !track.title.trim()) return null

  const artist = typeof track.user?.name === 'string' && track.user.name.trim()
    ? track.user.name.trim()
    : typeof track.user?.handle === 'string' && track.user.handle.trim()
      ? track.user.handle.trim()
      : ''
  const genre = typeof track.genre === 'string' && track.genre.trim() ? track.genre.trim() : undefined
  const tags = Array.isArray(track.tags)
    ? track.tags.filter((tag): tag is string => typeof tag === 'string' && !!tag.trim()).map((tag) => tag.trim())
    : typeof track.tags === 'string' ? track.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : []
  const duration = typeof track.duration === 'number' && Number.isFinite(track.duration) && track.duration > 0
    ? Math.floor(track.duration)
    : 0
  const playCount = typeof track.play_count === 'number' && Number.isFinite(track.play_count) ? Math.max(0, track.play_count) : 0
  const externalUrl = getCanonicalTrackUrl(track.permalink)

  // Audius OML applies when the creator has not supplied an alternative license.
  // The documented API represents its default as "All rights reserved"; fail closed
  // for absent or alternate license values instead of assuming playback permission.
  const hasDefaultOmlLicense = typeof track.license === 'string' && track.license.trim().toLowerCase() === 'all rights reserved'
  const playbackAvailable = hasDefaultOmlLicense && isExplicitlyStreamable(track)
  const playbackUnavailableReason = !hasDefaultOmlLicense
    ? 'Playback is unavailable because this track does not report Audius default-license status.'
    : !playbackAvailable
      ? 'This track is unavailable, restricted, gated, or not streamable through Audius.'
      : undefined

  return {
    id: `audius_${track.id}`,
    source: 'audius',
    sourceId: track.id,
    playbackId: track.id,
    playbackAvailable,
    ...(playbackUnavailableReason ? { playbackUnavailableReason } : {}),
    title: track.title.trim(),
    artist,
    artists: artist ? [artist] : [],
    artwork: getArtwork(track.artwork),
    genres: genre ? [genre] : [],
    tags,
    duration,
    popularity: Math.min(100, playCount / 1000),
    externalUrl,
    ...(typeof track.is_streamable === 'boolean' ? { isStreamable: track.is_streamable } : {}),
  }
}

export function mapAudiusSearchResponse(value: unknown): AudiusTrack[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { data?: unknown }).data)) {
    throw new AudiusSearchError('Audius returned an invalid search response.')
  }
  return (value as { data: unknown[] }).data.flatMap((item) => {
    const track = mapAudiusTrack(item)
    return track ? [track] : []
  })
}

export function getAudiusStreamUrl(trackId: string, apiBaseUrl = AUDIUS_API_BASE): string {
  if (!AUDIUS_TRACK_ID.test(trackId)) throw new Error('Invalid Audius track ID.')
  return `${apiBaseUrl}/tracks/${encodeURIComponent(trackId)}/stream`
}

export class AudiusProvider implements TrackSearchProvider {
  private readonly fetcher: typeof fetch
  private readonly apiBaseUrl: string

  constructor(fetcher: typeof fetch = (...args) => fetch(...args), apiBaseUrl = AUDIUS_API_BASE) {
    this.fetcher = fetcher
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '')
  }

  async search(query: string, signal?: AbortSignal): Promise<AudiusTrack[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []
    const params = new URLSearchParams({ query: normalizedQuery, limit: '25', sort_method: 'relevant' })
    let response: Response
    try {
      response = await this.fetcher(`${this.apiBaseUrl}/tracks/search?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new AudiusSearchError('Audius search is unavailable. Check your connection and try again.')
    }
    if (!response.ok) {
      if (response.status === 429) throw new AudiusSearchError('Audius is receiving too many requests. Wait a moment and try again.', 429)
      throw new AudiusSearchError(`Audius search failed (${response.status}). Please try again.`, response.status)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new AudiusSearchError('Audius returned unreadable search results.')
    }
    return mapAudiusSearchResponse(payload)
  }

  async getTrack(trackId: string, signal?: AbortSignal): Promise<AudiusTrack | null> {
    if (!AUDIUS_TRACK_ID.test(trackId)) return null
    let response: Response
    try {
      response = await this.fetcher(`${this.apiBaseUrl}/tracks/${encodeURIComponent(trackId)}`, {
        headers: { Accept: 'application/json' },
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new AudiusSearchError('Audius track details are unavailable. Check your connection and try again.')
    }
    if (!response.ok) {
      if (response.status === 404) return null
      throw new AudiusSearchError(`Audius track lookup failed (${response.status}). Please try again.`, response.status)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new AudiusSearchError('Audius returned unreadable track details.')
    }
    const data = payload && typeof payload === 'object' ? (payload as { data?: unknown }).data : null
    return mapAudiusTrack(data)
  }
}

export const audiusProvider = new AudiusProvider()
