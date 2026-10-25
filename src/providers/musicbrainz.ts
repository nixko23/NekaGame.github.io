import type { InternalTrack } from '../recommendation/types'
import type { TrackSearchProvider } from './types'

const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface MusicBrainzRecording {
  id?: unknown
  title?: unknown
  length?: unknown
  'artist-credit'?: unknown
  'first-release-date'?: unknown
  releases?: unknown
}

export interface MusicBrainzSearchResponse {
  recordings?: unknown
}

export function escapeLucenePhrase(value: string): string {
  const specialCharacters = new Set(['+', '-', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':', '\\', '/'])
  return [...value]
    .map((character) => specialCharacters.has(character) ? `\\${character}` : character)
    .join('')
    .replaceAll('&&', '\\&&')
    .replaceAll('||', '\\||')
}

export function createMusicBrainzQuery(query: string): string {
  const phrase = `"${escapeLucenePhrase(query.trim())}"`
  return `recording:${phrase} OR artistname:${phrase}`
}

export function musicBrainzRecordingUrl(mbid: string): string | undefined {
  return MBID_PATTERN.test(mbid) ? `https://musicbrainz.org/recording/${mbid}` : undefined
}

function getArtistCredit(value: unknown): { artist: string; artists: string[] } {
  if (!Array.isArray(value)) return { artist: '', artists: [] }
  const credits = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const entry = item as { name?: unknown; joinphrase?: unknown; artist?: { name?: unknown } }
    const name = typeof entry.artist?.name === 'string'
      ? entry.artist.name.trim()
      : typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) return []
    return [{ name, joinphrase: typeof entry.joinphrase === 'string' ? entry.joinphrase : '' }]
  })
  return {
    artist: credits.map(({ name, joinphrase }) => `${name}${joinphrase}`).join('').trim(),
    artists: [...new Set(credits.map(({ name }) => name))],
  }
}

export function mapMusicBrainzRecording(value: unknown): InternalTrack | null {
  if (!value || typeof value !== 'object') return null
  const recording = value as MusicBrainzRecording
  if (typeof recording.id !== 'string' || !musicBrainzRecordingUrl(recording.id)) return null
  if (typeof recording.title !== 'string' || !recording.title.trim()) return null

  const credit = getArtistCredit(recording['artist-credit'])
  const length = typeof recording.length === 'number' && Number.isFinite(recording.length) && recording.length > 0
    ? Math.floor(recording.length / 1000)
    : 0
  const releaseDate = typeof recording['first-release-date'] === 'string' && recording['first-release-date'].trim()
    ? recording['first-release-date'].trim()
    : undefined
  const firstRelease = Array.isArray(recording.releases) ? recording.releases.find((release) =>
    !!release && typeof release === 'object' && typeof (release as { title?: unknown }).title === 'string' && !!(release as { title: string }).title.trim(),
  ) as { title: string } | undefined : undefined

  return {
    id: `musicbrainz_${recording.id}`,
    source: 'musicbrainz',
    sourceId: recording.id,
    title: recording.title.trim(),
    artist: credit.artist,
    artists: credit.artists,
    genres: [],
    duration: length,
    externalUrl: musicBrainzRecordingUrl(recording.id),
    ...(firstRelease ? { album: firstRelease.title.trim() } : {}),
    ...(releaseDate ? { releaseDate } : {}),
  }
}

export function mapMusicBrainzSearchResponse(value: unknown): InternalTrack[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as MusicBrainzSearchResponse).recordings)) {
    throw new Error('MusicBrainz returned an invalid search response.')
  }
  return (value as { recordings: unknown[] }).recordings
    .map(mapMusicBrainzRecording)
    .filter((track): track is InternalTrack => track !== null)
}

export class MusicBrainzProvider implements TrackSearchProvider {
  private readonly fetcher: typeof fetch
  private readonly endpoint: string

  constructor(fetcher: typeof fetch = (...args) => fetch(...args), endpoint = '/api/musicbrainz/search') {
    this.fetcher = fetcher
    this.endpoint = endpoint
  }

  async search(query: string, signal?: AbortSignal): Promise<InternalTrack[]> {
    const normalized = query.trim()
    if (!normalized) return []
    const params = new URLSearchParams({ query: normalized })
    const response = await this.fetcher(`${this.endpoint}?${params.toString()}`, { signal })
    if (!response.ok) {
      if (response.status === 503 || response.status === 429) {
        throw new Error('MusicBrainz is busy. Please wait a moment and try again.')
      }
      throw new Error('MusicBrainz search is temporarily unavailable. Please try again.')
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error('MusicBrainz returned an unreadable response.')
    }
    return mapMusicBrainzSearchResponse(payload)
  }
}

export const musicBrainzProvider = new MusicBrainzProvider()
