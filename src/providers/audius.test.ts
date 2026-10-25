import type { InternalTrack } from '../recommendation/types'
import { AudiusProvider, getAudiusStreamUrl, mapAudiusSearchResponse, mapAudiusTrack } from './audius'
import { describe, expect, it, vi } from 'vitest'

const permittedTrack = {
  id: 'Ab12x',
  title: 'Open Morning',
  user: { name: 'Test Artist', handle: 'testartist' },
  artwork: { '480x480': 'https://cdn.audius.co/cover.jpg' },
  genre: 'Electronic',
  tags: ['ambient', 'synth'],
  duration: 178.7,
  play_count: 2400,
  permalink: '/testartist/open-morning-123',
  license: 'All rights reserved',
  is_streamable: true,
  is_available: true,
  is_delete: false,
  is_unlisted: false,
  is_stream_gated: false,
  stream_conditions: null,
  access: { stream: true },
}

describe('Audius provider', () => {
  it('maps provider metadata into the provider-independent track model', () => {
    const track = mapAudiusTrack(permittedTrack)
    expect(track).toMatchObject<Partial<InternalTrack>>({
      id: 'audius_Ab12x', source: 'audius', sourceId: 'Ab12x', title: 'Open Morning',
      artist: 'Test Artist', genres: ['Electronic'], tags: ['ambient', 'synth'],
      duration: 178, externalUrl: 'https://audius.co/testartist/open-morning-123', artwork: 'https://cdn.audius.co/cover.jpg',
    })
    expect(track?.playbackAvailable).toBe(true)
  })

  it.each([
    ['alternate license', { license: 'Attribution CC BY' }],
    ['unknown license', { license: undefined }],
    ['not streamable', { is_streamable: false }],
    ['creator has disabled streams', { access: { stream: false } }],
    ['gated track', { is_stream_gated: true, stream_conditions: { followUserId: 123 } }],
    ['restricted API key', { allowed_api_keys: ['private-key'] }],
    ['removed track', { is_delete: true }],
  ])('does not enable playback for a %s', (_description, overrides) => {
    expect(mapAudiusTrack({ ...permittedTrack, ...overrides })?.playbackAvailable).toBe(false)
  })

  it('drops malformed tracks and rejects non-Audius page URLs', () => {
    expect(mapAudiusTrack({ ...permittedTrack, id: '../bad' })).toBeNull()
    expect(mapAudiusTrack({ ...permittedTrack, permalink: 'https://example.com/track' })?.externalUrl).toBeUndefined()
    expect(mapAudiusSearchResponse({ data: [{ ...permittedTrack, title: '' }] })).toEqual([])
    expect(() => mapAudiusSearchResponse({ results: [] })).toThrow(/invalid search response/i)
  })

  it('searches the documented endpoint and maps data', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [permittedTrack] }), { status: 200 }))
    const provider = new AudiusProvider(fetcher as typeof fetch)
    const results = await provider.search('  Open Morning  ')
    expect(results).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/api\.audius\.co\/v1\/tracks\/search\?query=Open\+Morning/), expect.objectContaining({ headers: { Accept: 'application/json' } }))
  })

  it('revalidates a saved queue item using Audius track metadata', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: permittedTrack }), { status: 200 }))
    const provider = new AudiusProvider(fetcher as typeof fetch)
    const restored = await provider.getTrack('Ab12x')
    expect(restored?.playbackAvailable).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('https://api.audius.co/v1/tracks/Ab12x', expect.objectContaining({ headers: { Accept: 'application/json' } }))

    const restricted = new AudiusProvider(vi.fn(async () => new Response(JSON.stringify({ data: { ...permittedTrack, is_streamable: false } }), { status: 200 })) as typeof fetch)
    expect((await restricted.getTrack('Ab12x'))?.playbackAvailable).toBe(false)
  })

  it('handles rate-limit and invalid response errors', async () => {
    const rateLimited = new AudiusProvider(vi.fn(async () => new Response('', { status: 429 })) as typeof fetch)
    await expect(rateLimited.search('test')).rejects.toThrow(/too many requests/i)
    const malformed = new AudiusProvider(vi.fn(async () => new Response('not-json')) as typeof fetch)
    await expect(malformed.search('test')).rejects.toThrow(/unreadable/i)
  })

  it('builds only the documented stream route and validates IDs', () => {
    expect(getAudiusStreamUrl('Ab12x')).toBe('https://api.audius.co/v1/tracks/Ab12x/stream')
    expect(() => getAudiusStreamUrl('https://example.com/audio.mp3')).toThrow(/invalid audius track id/i)
  })
})
