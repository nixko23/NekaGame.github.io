import type { InternalTrack } from '../recommendation/types'
import type { TrackSearchProvider } from './types'

const SOUNDCLOUD_API_BASE = 'https://api.soundcloud.com'

interface SoundCloudTrackPayload {
  id?: string | number
  title?: string
  metadata_artist?: string | null
  user?: { username?: string; avatar_url?: string | null } | null
  artwork_url?: string | null
  duration?: number
  playback_count?: number | null
  genre?: string | null
  tag_list?: string | null
  permalink_url?: string | null
}

export class SoundCloudSearchError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SoundCloudSearchError'
    this.status = status
  }
}

/** Convert one untrusted API result into the provider-independent recommendation model. */
export function mapSoundCloudTrack(value: unknown): InternalTrack | null {
  if (!value || typeof value !== 'object') return null
  const track = value as SoundCloudTrackPayload
  if ((typeof track.id !== 'string' && typeof track.id !== 'number') || !track.title?.trim()) return null

  const plays = typeof track.playback_count === 'number' && Number.isFinite(track.playback_count)
    ? Math.max(0, track.playback_count)
    : 0
  const durationMs = typeof track.duration === 'number' && Number.isFinite(track.duration)
    ? Math.max(0, track.duration)
    : 0
  const permalink = safeHttpUrl(track.permalink_url)
  const artwork = safeHttpUrl(track.artwork_url) ?? safeHttpUrl(track.user?.avatar_url)
  const genre = track.genre?.trim()

  return {
    id: `soundcloud_${track.id}`,
    source: 'soundcloud',
    sourceId: String(track.id),
    title: track.title.trim(),
    artist: track.metadata_artist?.trim() || track.user?.username?.trim() || 'Unknown artist',
    genres: genre ? [genre] : [],
    tags: track.tag_list?.split(/\s+/).filter(Boolean),
    artwork,
    duration: Math.floor(durationMs / 1000),
    popularity: Math.min(100, plays / 1000),
    externalUrl: permalink,
  }
}

/**
 * Create a server-side search provider. Pass an access-token supplier so the
 * application can cache/refresh credentials without placing a client secret in
 * browser code. This provider is intentionally not configured by the mock UI.
 */
export function createSoundCloudSearchProvider(options: {
  getAccessToken: () => Promise<string>
  fetchImpl?: typeof fetch
  apiBaseUrl?: string
}): TrackSearchProvider {
  const fetchImpl = options.fetchImpl ?? fetch
  const apiBaseUrl = options.apiBaseUrl ?? SOUNDCLOUD_API_BASE

  return {
    async search(query, signal) {
      const normalizedQuery = query.trim()
      if (!normalizedQuery) return []

      const accessToken = await options.getAccessToken()
      if (!accessToken.trim()) throw new SoundCloudSearchError('SoundCloud access token is not configured')

      const url = new URL('/tracks', apiBaseUrl)
      url.search = new URLSearchParams({ q: normalizedQuery, limit: '25', linked_partitioning: 'true' }).toString()
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json; charset=utf-8',
          Authorization: `OAuth ${accessToken}`,
        },
        signal,
      })

      if (!response.ok) {
        throw new SoundCloudSearchError(`SoundCloud search failed (${response.status})`, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new SoundCloudSearchError('SoundCloud returned invalid JSON')
      }

      const collection = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && Array.isArray((payload as { collection?: unknown }).collection)
          ? (payload as { collection: unknown[] }).collection
          : null

      if (!collection) throw new SoundCloudSearchError('SoundCloud returned an unexpected search response')
      return collection.flatMap((item) => {
        const mapped = mapSoundCloudTrack(item)
        return mapped ? [mapped] : []
      })
    },
  }
}

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
