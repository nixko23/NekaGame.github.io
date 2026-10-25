import { describe, expect, it, vi } from 'vitest'
import { createSoundCloudSearchProvider, mapSoundCloudTrack, SoundCloudSearchError } from './soundcloud'

describe('SoundCloud provider boundary', () => {
  it('maps available metadata to the provider-independent track model', () => {
    expect(mapSoundCloudTrack({
      id: 123,
      title: '  Night Drive  ',
      metadata_artist: 'Artist Credit',
      user: { username: 'Uploader' },
      artwork_url: 'https://cdn.example/art.jpg',
      duration: 185500,
      playback_count: 2500,
      genre: 'Electronic',
      tag_list: 'synthwave night-drive',
      permalink_url: 'https://soundcloud.com/artist/night-drive',
      stream_url: 'https://api.soundcloud.com/streams/123',
    })).toEqual({
      id: 'soundcloud_123',
      source: 'soundcloud',
      sourceId: '123',
      title: 'Night Drive',
      artist: 'Artist Credit',
      genres: ['Electronic'],
      tags: ['synthwave', 'night-drive'],
      artwork: 'https://cdn.example/art.jpg',
      duration: 185,
      popularity: 2.5,
      externalUrl: 'https://soundcloud.com/artist/night-drive',
    })
  })

  it('safely handles missing metadata and rejects malformed tracks', () => {
    expect(mapSoundCloudTrack({ id: 'abc', title: 'Track' })).toMatchObject({
      artist: 'Unknown artist',
      genres: [],
      duration: 0,
      externalUrl: undefined,
    })
    expect(mapSoundCloudTrack({ id: 'bad', title: ' ' })).toBeNull()
    expect(mapSoundCloudTrack(null)).toBeNull()
  })

  it('searches with the official track endpoint and accepts paginated collections', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      collection: [{ id: 7, title: 'Real Result', permalink_url: 'https://soundcloud.com/a/b' }],
    }), { status: 200 }))
    const provider = createSoundCloudSearchProvider({
      getAccessToken: async () => 'server-managed-token',
      fetchImpl,
      apiBaseUrl: 'https://api.soundcloud.com',
    })

    const tracks = await provider.search(' artist name ')
    const [request, init] = fetchImpl.mock.calls[0]
    const requestUrl = new URL(String(request))

    expect(requestUrl.pathname).toBe('/tracks')
    expect(requestUrl.searchParams.get('q')).toBe('artist name')
    expect(requestUrl.searchParams.get('linked_partitioning')).toBe('true')
    expect(new Headers(init?.headers).get('Authorization')).toBe('OAuth server-managed-token')
    expect(tracks.map((track) => track.title)).toEqual(['Real Result'])
  })

  it('does not make requests for an empty query', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const provider = createSoundCloudSearchProvider({ getAccessToken: async () => 'token', fetchImpl })

    await expect(provider.search('  ')).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports API and malformed response errors as provider errors', async () => {
    const unauthorizedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }))
    const unauthorizedProvider = createSoundCloudSearchProvider({
      getAccessToken: async () => 'token',
      fetchImpl: unauthorizedFetch,
    })
    await expect(unauthorizedProvider.search('track')).rejects.toMatchObject({
      name: 'SoundCloudSearchError',
      status: 401,
    })

    const malformedProvider = createSoundCloudSearchProvider({
      getAccessToken: async () => 'token',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    })
    await expect(malformedProvider.search('track')).rejects.toBeInstanceOf(SoundCloudSearchError)
  })
})
