import { describe, expect, it, vi } from 'vitest'
import { createMusicBrainzQuery, mapMusicBrainzRecording, mapMusicBrainzSearchResponse, MusicBrainzProvider } from './musicbrainz'
import { MusicBrainzProxy } from '../../server/musicBrainzProxy'

const recordingId = '026fa041-3917-4c73-9079-ed16e36f20f8'

describe('MusicBrainz recording provider', () => {
  it('maps only available core metadata and preserves the canonical recording link', () => {
    const track = mapMusicBrainzRecording({
      id: recordingId,
      title: '  Blow Your Mind  ',
      length: 178000,
      'first-release-date': '2016-08-26',
      releases: [{ title: 'Deluxe Release' }],
      'artist-credit': [{ artist: { name: 'Dua Lipa' } }],
    })

    expect(track).toMatchObject({
      id: `musicbrainz_${recordingId}`,
      source: 'musicbrainz',
      sourceId: recordingId,
      title: 'Blow Your Mind',
      artist: 'Dua Lipa',
      artists: ['Dua Lipa'],
      genres: [],
      duration: 178,
      releaseDate: '2016-08-26',
      album: 'Deluxe Release',
      externalUrl: `https://musicbrainz.org/recording/${recordingId}`,
    })
    expect(track?.artwork).toBeUndefined()
    expect(track?.previewUrl).toBeUndefined()
    expect(track?.popularity).toBeUndefined()
  })

  it('handles absent optional fields without fabricating metadata and drops malformed recordings', () => {
    expect(mapMusicBrainzRecording({ id: recordingId, title: 'Unknown Credits' })).toMatchObject({
      artist: '', artists: [], genres: [], duration: 0,
    })
    expect(mapMusicBrainzRecording({ id: 'invalid', title: 'Fake' })).toBeNull()
    expect(mapMusicBrainzRecording({ id: recordingId, title: ' ' })).toBeNull()
    expect(mapMusicBrainzSearchResponse({ recordings: [null, { id: recordingId, title: 'Okay' }] })).toHaveLength(1)
    expect(() => mapMusicBrainzSearchResponse({ recordings: null })).toThrow(/invalid search response/i)
  })

  it('builds documented recording and artist searches while escaping Lucene syntax', () => {
    expect(createMusicBrainzQuery('Massive Attack')).toBe('recording:"Massive Attack" OR artistname:"Massive Attack"')
    expect(createMusicBrainzQuery('A/B')).toContain('A\\/B')
  })

  it('sends one search request through the same-origin proxy and maps its JSON response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      recordings: [{ id: recordingId, title: 'Track', 'artist-credit': [{ artist: { name: 'Artist' } }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const provider = new MusicBrainzProvider(fetcher, '/api/musicbrainz/search')

    const results = await provider.search(' artist / track ')

    expect(results).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledOnce()
    const [url] = fetcher.mock.calls[0]
    expect(url).toBe('/api/musicbrainz/search?query=artist+%2F+track')
  })

  it('handles empty queries, HTTP errors and malformed JSON responses', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const provider = new MusicBrainzProvider(fetcher)
    await expect(provider.search('  ')).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()

    fetcher.mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(provider.search('artist')).rejects.toThrow(/busy/i)
    fetcher.mockResolvedValueOnce(new Response('{bad json', { status: 200 }))
    await expect(provider.search('artist')).rejects.toThrow(/unreadable/i)
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ nope: [] }), { status: 200 }))
    await expect(provider.search('artist')).rejects.toThrow(/invalid search response/i)
  })
})

describe('MusicBrainz proxy', () => {
  function response(status = 200, body: unknown = { recordings: [] }, retryAfter: string | null = null) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => name.toLowerCase() === 'retry-after' ? retryAfter : null },
      json: async () => body,
    }
  }

  it('sends the official recording search with JSON, a descriptive User-Agent, and a shared one-second interval', async () => {
    let now = 1000
    const wait = vi.fn(async (milliseconds: number) => { now += milliseconds })
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetcher = async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return response()
    }
    const proxy = new MusicBrainzProxy(fetcher, () => now, wait)

    await Promise.all([proxy.search('artist'), proxy.search('track')])

    expect(calls).toHaveLength(2)
    expect(calls[0].url).toContain('https://musicbrainz.org/ws/2/recording?')
    expect(calls[0].url).toContain('fmt=json')
    expect(calls[0].init.headers).toMatchObject({
      Accept: 'application/json',
      'User-Agent': expect.stringContaining('SoundCloudDiscovery'),
    })
    expect(wait).toHaveBeenCalledWith(1000)
  })

  it('converts provider overload, upstream failures, and malformed responses into useful errors', async () => {
    const proxy = new MusicBrainzProxy(vi.fn()
      .mockResolvedValueOnce(response(503, {}, '2'))
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200, { invalid: true })), () => 1000, async () => undefined)

    await expect(proxy.search('artist')).resolves.toMatchObject({ status: 503, retryAfter: '2' })
    await expect(proxy.search('artist')).resolves.toMatchObject({ status: 502 })
    await expect(proxy.search('artist')).resolves.toMatchObject({ status: 502, body: { error: expect.stringMatching(/invalid response/i) } })
  })
})
