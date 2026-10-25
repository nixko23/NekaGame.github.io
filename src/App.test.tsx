// @vitest-environment jsdom

import { StrictMode } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import RecommendationEngine from './recommendation'

function renderApp() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

function visibleCardNames() {
  return screen.getAllByRole('img').map((image) => image.getAttribute('alt'))
}

beforeEach(() => {
  localStorage.clear()
  RecommendationEngine.reset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SoundCloud Discovery user flows', () => {
  it('renders the available Discover recommendation cards', () => {
    renderApp()

    expect(new Set(visibleCardNames())).toEqual(new Set([
      'Neon Dreams',
      'Lo-Fi Beats',
      'Deep House Sessions',
      'Hip-Hop Cipher',
      'Ambient Meditation',
      'Indie Folk Tales',
      'Glass Horizon',
      'Night Run',
      'Soft Focus',
    ]))
    expect(screen.getAllByText(/✨/)).toHaveLength(9)
  })

  it('keeps recommendations visible after a favorite update and repeated render', async () => {
    const user = userEvent.setup()
    const app = renderApp()
    const initialCards = visibleCardNames()

    await user.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0])

    expect(new Set(visibleCardNames())).toEqual(new Set(initialCards))
    expect(screen.getByRole('button', { name: '❤️ Favorites (1)' })).toBeTruthy()

    app.rerender(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(new Set(visibleCardNames())).toEqual(new Set(initialCards))
  })

  it('navigates among Discover, Favorites, and Playlists', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Playlists' }))
    expect(screen.getByRole('heading', { name: 'Popular Playlists' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Late Night Vibes' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Favorites/ }))
    expect(screen.getByRole('heading', { name: 'Your Favorite Tracks' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Discover' }))
    expect(screen.getByRole('heading', { name: 'All Tracks' })).toBeTruthy()
    expect(visibleCardNames()).toHaveLength(9)
  })

  it('shows only selected tracks in Favorites and preserves them when navigating', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(within(screen.getByRole('article', { name: 'Neon Dreams by Synthwave Master' }))
      .getByRole('button', { name: 'Add to favorites' }))
    await user.click(within(screen.getByRole('article', { name: 'Lo-Fi Beats by Chill Vibes' }))
      .getByRole('button', { name: 'Add to favorites' }))
    await user.click(screen.getByRole('button', { name: /Favorites/ }))

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'Neon Dreams',
      'Lo-Fi Beats',
    ])
    expect(screen.getAllByRole('button', { name: 'Remove from favorites' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Add to favorites' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Playlists' }))
    await user.click(screen.getByRole('button', { name: /Favorites/ }))
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'Neon Dreams',
      'Lo-Fi Beats',
    ])
  })

  it('shows the empty Favorites state when no tracks are saved', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /Favorites/ }))
    expect(screen.getByText('No favorites yet. Click the ❤️ icon on tracks to add them.')).toBeTruthy()
  })

  it('handles missing persisted favorites safely', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(visibleCardNames()).toHaveLength(9)
    await user.click(screen.getByRole('button', { name: /Favorites/ }))
    expect(screen.getByText('No favorites yet. Click the ❤️ icon on tracks to add them.')).toBeTruthy()
  })

  it('handles malformed persisted favorites safely', async () => {
    const user = userEvent.setup()
    localStorage.setItem('soundcloud_favorites', '{not valid json')

    renderApp()
    expect(visibleCardNames()).toHaveLength(9)
    await user.click(screen.getByRole('button', { name: /Favorites/ }))
    expect(screen.getByText('No favorites yet. Click the ❤️ icon on tracks to add them.')).toBeTruthy()
  })

  it('keeps favorites usable when browser storage writes fail', async () => {
    const user = userEvent.setup()
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'soundcloud_favorites') throw new DOMException('Storage blocked')
      return originalSetItem.call(this, key, value)
    })
    renderApp()

    await user.click(within(screen.getByRole('article', { name: 'Neon Dreams by Synthwave Master' }))
      .getByRole('button', { name: 'Add to favorites' }))

    expect(screen.getByRole('button', { name: '❤️ Favorites (1)' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/browser storage is unavailable/i)
  })

  it('restores saved favorites as selected after a fresh app load', async () => {
    const user = userEvent.setup()
    localStorage.setItem('soundcloud_favorites', JSON.stringify(['1']))

    renderApp()
    await user.click(screen.getByRole('button', { name: /Favorites/ }))

    expect(visibleCardNames()).toEqual(['Neon Dreams'])
    expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeTruthy()
  })

  it('opens a playlist and returns to the playlist list', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Playlists' }))
    await user.click(screen.getAllByRole('button', { name: 'View Playlist' })[0])
    expect(screen.getByRole('heading', { name: 'Late Night Vibes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tracks in this playlist' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Back/ }))
    expect(screen.getByRole('heading', { name: 'Popular Playlists' })).toBeTruthy()
  })

  it('persists selected favorites without changing the Discover list', async () => {
    const user = userEvent.setup()
    renderApp()
    const cards = visibleCardNames()

    await user.click(within(screen.getByRole('article', { name: 'Neon Dreams by Synthwave Master' }))
      .getByRole('button', { name: 'Add to favorites' }))
    expect(JSON.parse(localStorage.getItem('soundcloud_favorites') || '[]')).toEqual(['1'])
    expect(new Set(visibleCardNames())).toEqual(new Set(cards))
  })

  it('searches by track title', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Search tracks, artists, playlists...'), 'Neon Dreams')
    expect(await screen.findByRole('heading', { name: 'Neon Dreams' })).toBeTruthy()
    expect(visibleCardNames()).toEqual(['Neon Dreams'])
  })

  it('searches by artist name', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Search tracks, artists, playlists...'), 'Chill Vibes')
    expect(await screen.findByRole('heading', { name: 'Lo-Fi Beats' })).toBeTruthy()
    expect(new Set(visibleCardNames())).toEqual(new Set(['Lo-Fi Beats', 'Soft Focus']))
  })

  it('searches without case sensitivity', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Search tracks, artists, playlists...'), 'sYnThWaVe MaStEr')
    expect(await screen.findByRole('heading', { name: 'Neon Dreams' })).toBeTruthy()
    expect(new Set(visibleCardNames())).toEqual(new Set(['Neon Dreams', 'Night Run']))
  })

  it('shows the empty state when a search has no matches', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.type(screen.getByPlaceholderText('Search tracks, artists, playlists...'), 'no such track')
    expect(await screen.findByText('No tracks found. Try a different search or genre.')).toBeTruthy()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('filters recommendations by genre and resets to all genres', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Synthwave' }))
    expect(new Set(visibleCardNames())).toEqual(new Set(['Neon Dreams', 'Glass Horizon', 'Night Run']))

    await user.click(screen.getByRole('button', { name: 'All Genres' }))
    expect(visibleCardNames()).toHaveLength(9)
  })

  it('combines search and genre filters and clears both filters', async () => {
    const user = userEvent.setup()
    renderApp()
    const search = screen.getByPlaceholderText('Search tracks, artists, playlists...')

    await user.type(search, 'Vibes')
    expect(await screen.findByRole('heading', { name: 'Lo-Fi Beats' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Lo-Fi' }))
    expect(new Set(visibleCardNames())).toEqual(new Set(['Lo-Fi Beats', 'Soft Focus']))

    await user.click(screen.getByRole('button', { name: 'Synthwave' }))
    expect(await screen.findByText('No tracks found. Try a different search or genre.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'All Genres' }))
    expect(new Set(visibleCardNames())).toEqual(new Set(['Lo-Fi Beats', 'Soft Focus']))
    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(visibleCardNames()).toHaveLength(9)
  })

  it('keeps filtered recommendations visible without adding unexpected seen IDs', async () => {
    const user = userEvent.setup()
    renderApp()
    const initialSeenIds = RecommendationEngine.getUserTaste().recentlySeenTrackIds
    expect(new Set(initialSeenIds)).toEqual(new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9']))

    await user.click(screen.getByRole('button', { name: 'Synthwave' }))
    expect(new Set(visibleCardNames())).toEqual(new Set(['Neon Dreams', 'Glass Horizon', 'Night Run']))
    expect(new Set(RecommendationEngine.getUserTaste().recentlySeenTrackIds)).toEqual(new Set(initialSeenIds))
    expect(RecommendationEngine.getUserTaste().recentlySeenTrackIds).toHaveLength(9)
  })

  it('offers a direct way to review feedback when it excludes every recommendation', async () => {
    const user = userEvent.setup()
    const tracks = [
      ['1', 'Neon Dreams', 'Synthwave Master', 'synthwave'],
      ['2', 'Lo-Fi Beats', 'Chill Vibes', 'lofi'],
      ['3', 'Deep House Sessions', 'House Collective', 'house'],
      ['4', 'Hip-Hop Cipher', 'Rap Kings', 'hip-hop'],
      ['5', 'Ambient Meditation', 'Zen Sounds', 'ambient'],
      ['6', 'Indie Folk Tales', 'Acoustic Dreams', 'indie'],
      ['7', 'Glass Horizon', 'Comet Arcade', 'synthwave'],
      ['8', 'Night Run', 'Synthwave Master', 'synthwave'],
      ['9', 'Soft Focus', 'Chill Vibes', 'lofi'],
    ]
    for (const [id, title, artist, genre] of tracks) {
      RecommendationEngine.setTrackFeedback(id, 'skip', { title, artist, genres: [genre] })
    }

    renderApp()

    expect(screen.getByText('No recommendations match your feedback. Review or undo feedback to see these tracks again.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Review feedback (9)' }))
    expect(screen.getByRole('heading', { name: 'Your Feedback' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo feedback for Neon Dreams' })).toBeTruthy()
  })

  it('moves tracks with liked genre metadata higher and exposes selected feedback accessibly', async () => {
    const user = userEvent.setup()
    renderApp()
    const initialPeerPosition = visibleCardNames().indexOf('Night Run')
    const likeButton = screen.getByRole('button', { name: 'Like Neon Dreams' })

    likeButton.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: 'Like Neon Dreams' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('Liked Neon Dreams.')
    expect(visibleCardNames().indexOf('Night Run')).toBeLessThan(initialPeerPosition)
  })

  it('skips without disliking, lets feedback be updated or undone, and restores skipped tracks', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Skip Neon Dreams' }))
    expect(screen.queryByRole('article', { name: 'Neon Dreams by Synthwave Master' })).toBeNull()
    expect(RecommendationEngine.getUserTaste().dislikedGenres).toEqual([])
    expect(RecommendationEngine.getUserTaste().skippedTrackIds).toEqual(['1'])
    expect(screen.getByRole('status').textContent).toBe('Skipped Neon Dreams.')

    await user.click(screen.getByRole('button', { name: 'Feedback (1)' }))
    expect(screen.getByText('Skipped')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Like Neon Dreams' }))
    expect(RecommendationEngine.getUserTaste().skippedTrackIds).toEqual([])
    expect(RecommendationEngine.getUserTaste().likedTrackIds).toEqual(['1'])

    await user.click(screen.getByRole('button', { name: 'Undo feedback for Neon Dreams' }))
    expect(screen.getByRole('button', { name: 'Feedback (0)' })).toBeTruthy()
    expect(RecommendationEngine.getUserTaste().feedbackByTrack).toEqual({})
    await user.click(screen.getByRole('button', { name: 'Discover' }))
    expect(screen.getByRole('article', { name: 'Neon Dreams by Synthwave Master' })).toBeTruthy()
  })

  it('keeps favorite state independent from a dislike preference', async () => {
    const user = userEvent.setup()
    renderApp()
    const neonCard = screen.getByRole('article', { name: 'Neon Dreams by Synthwave Master' })

    await user.click(within(neonCard).getByRole('button', { name: 'Add to favorites' }))
    await user.click(screen.getByRole('button', { name: 'Dislike Neon Dreams' }))
    expect(screen.queryByRole('article', { name: 'Neon Dreams by Synthwave Master' })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Favorites/ }))
    const favoriteCard = screen.getByRole('article', { name: 'Neon Dreams by Synthwave Master' })
    expect(within(favoriteCard).getByRole('button', { name: 'Remove from favorites' })).toBeTruthy()
    expect(within(favoriteCard).getByRole('button', { name: 'Dislike Neon Dreams' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(within(favoriteCard).getByRole('button', { name: 'Remove from favorites' }))

    expect(screen.getByRole('button', { name: '❤️ Favorites (0)' })).toBeTruthy()
    expect(RecommendationEngine.getUserTaste().feedbackByTrack['1'].action).toBe('dislike')
  })

  it('searches MusicBrainz, attributes metadata, avoids playback and keeps demo Favorites intact', async () => {
    const user = userEvent.setup()
    const mbid = '026fa041-3917-4c73-9079-ed16e36f20f8'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      recordings: [{
        id: mbid,
        title: 'Real Metadata Recording',
        length: 196000,
        'first-release-date': '2001',
        'artist-credit': [{ artist: { name: 'Verified Artist' } }],
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    renderApp()

    await user.click(screen.getByRole('button', { name: 'MusicBrainz' }))
    await user.type(screen.getByPlaceholderText('Search MusicBrainz recordings or artists...'), 'Verified Artist')

    const card = await screen.findByRole('article', { name: 'Real Metadata Recording by Verified Artist' }, { timeout: 3000 })
    expect(within(card).getByRole('link', { name: 'MusicBrainz' }).getAttribute('href')).toBe(`https://musicbrainz.org/recording/${mbid}`)
    expect(within(card).getByText(/Metadata only; playback is unavailable\. Favorites are limited to the demo catalog/)).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Add to favorites' })).toBeNull()
    expect(within(card).queryByRole('button', { name: /play/i })).toBeNull()
    expect(screen.getByRole('button', { name: '❤️ Favorites (0)' })).toBeTruthy()
  })


  it('searches Audius results and starts the selected eligible track in the in-app player', async () => {
    const user = userEvent.setup()
    const mediaPlay = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const result = {
      id: 'Ab12x', title: 'Open Morning', user: { name: 'Test Creator', handle: 'testcreator' },
      artwork: null, genre: 'Electronic', tags: ['ambient'], duration: 180, play_count: 2300,
      permalink: '/testcreator/open-morning-123', license: 'All rights reserved',
      is_streamable: true, is_available: true, is_delete: false, is_unlisted: false,
      is_stream_gated: false, stream_conditions: null, access: { stream: true },
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [result] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Audius' }))
    await user.type(screen.getByPlaceholderText('Search Audius tracks or artists...'), 'Open Morning')
    const card = await screen.findByRole('article', { name: 'Open Morning by Test Creator' }, { timeout: 3000 })
    expect(within(card).getByRole('link', { name: 'Audius track' }).getAttribute('href')).toBe('https://audius.co/testcreator/open-morning-123')
    expect((within(card).getByRole('button', { name: 'Play Open Morning' }) as HTMLButtonElement).disabled).toBe(false)

    await user.click(within(card).getByRole('button', { name: 'Add Open Morning to queue' }))
    expect(screen.getByRole('button', { name: 'Queue (1)' })).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Open Morning already queued' })).toBeTruthy()

    await user.click(within(card).getByRole('button', { name: 'Play Open Morning' }))
    expect(mediaPlay).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: 'Audius player' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open original track' }).getAttribute('href')).toBe('https://audius.co/testcreator/open-morning-123')
  })

  it('keeps alternate-license and gated Audius tracks unplayable', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: 'Cc345', title: 'Alternate License', user: { name: 'Artist' }, license: 'Attribution CC BY', is_streamable: true, is_available: true, is_delete: false, is_unlisted: false, is_stream_gated: false, stream_conditions: null, access: { stream: true } },
      { id: 'Gate7', title: 'Gated Track', user: { name: 'Artist' }, license: 'All rights reserved', is_streamable: true, is_available: true, is_delete: false, is_unlisted: false, is_stream_gated: true, stream_conditions: { followUserId: 1 }, access: { stream: true } },
    ] }), { status: 200 })))
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Audius' }))
    await user.type(screen.getByPlaceholderText('Search Audius tracks or artists...'), 'test tracks')
    const alternateCard = await screen.findByRole('article', { name: 'Alternate License by Artist' }, { timeout: 3000 })
    const gatedCard = screen.getByRole('article', { name: 'Gated Track by Artist' })
    expect((within(alternateCard).getByRole('button', { name: 'Play Alternate License' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(gatedCard).getByRole('button', { name: 'Play Gated Track' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a clear empty result state for a MusicBrainz search with no recordings', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ recordings: [] }), { status: 200 })))
    renderApp()

    await user.click(screen.getByRole('button', { name: 'MusicBrainz' }))
    await user.type(screen.getByPlaceholderText('Search MusicBrainz recordings or artists...'), 'No Such Recording')

    expect(await screen.findByText(/No MusicBrainz recordings matched “No Such Recording”/i, {}, { timeout: 3000 })).toBeTruthy()
  })

  it('shows a recoverable MusicBrainz error when the proxy cannot search', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'MusicBrainz is busy. Please try again shortly.' }), { status: 503 })))
    renderApp()

    await user.click(screen.getByRole('button', { name: 'MusicBrainz' }))
    await user.type(screen.getByPlaceholderText('Search MusicBrainz recordings or artists...'), 'Artist')

    expect((await screen.findByRole('alert', {}, { timeout: 3000 })).textContent).toMatch(/MusicBrainz is busy/i)
  })
})
