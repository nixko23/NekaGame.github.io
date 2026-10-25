// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { AudiusTrack } from '../providers/audius'
import AudiusPlaybackPlayer, { type AudiusPlaybackPlayerHandle } from './AudiusPlaybackPlayer'

const track = (id: string, title: string): AudiusTrack => ({
  id: `audius_${id}`, source: 'audius', sourceId: id, playbackId: id, playbackAvailable: true,
  title, artist: 'Independent Artist', genres: ['Electronic'], duration: 180,
  externalUrl: `https://audius.co/artist/${id}`,
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => localStorage.clear())

describe('AudiusPlaybackPlayer', () => {
  it('starts the selected track from the documented Audius stream route', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    render(<AudiusPlaybackPlayer ref={ref} />)

    await act(async () => { ref.current?.playTrack(track('Ab12x', 'Open Morning')) })

    expect(play).toHaveBeenCalledTimes(1)
    expect(document.querySelector('audio')?.getAttribute('src')).toBe('https://api.audius.co/v1/tracks/Ab12x/stream')
    expect(screen.getByRole('region', { name: 'Audius player' })).toBeTruthy()
    expect(screen.getByText('Open Morning')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open original track' }).getAttribute('href')).toBe('https://audius.co/artist/Ab12x')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('pauses, resumes, seeks, switches tracks, and stops', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    render(<AudiusPlaybackPlayer ref={ref} />)

    await act(async () => { ref.current?.playTrack(track('Ab12x', 'Open Morning')) })
    await act(async () => { ref.current?.playTrack(track('Ab12x', 'Open Morning')) })
    expect(pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()

    await act(async () => { ref.current?.playTrack(track('Z9y7', 'Night Drive')) })
    expect(play).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Night Drive')).toBeTruthy()

    const audio = document.querySelector('audio')!
    Object.defineProperty(audio, 'duration', { configurable: true, value: 180 })
    fireEvent.loadedMetadata(audio)
    const progress = screen.getByRole('slider', { name: 'Playback position' }) as HTMLInputElement
    fireEvent.change(progress, { target: { value: '42' } })
    expect(audio.currentTime).toBe(42)

    await act(async () => { ref.current?.stop() })
    expect(screen.queryByRole('region', { name: 'Audius player' })).toBeNull()
  })

  it('shows a clear error when the browser cannot start an eligible stream', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('network'))
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    render(<AudiusPlaybackPlayer ref={ref} />)

    await act(async () => { ref.current?.playTrack(track('Ab12x', 'Open Morning')) })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not play this track/i))
  })

  it('adds, deduplicates, reorders, removes, and clears queued tracks', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    const user = userEvent.setup()
    render(<AudiusPlaybackPlayer ref={ref} />)
    const alpha = track('A1', 'Alpha')
    const beta = track('B2', 'Beta')
    const gamma = track('C3', 'Gamma')

    act(() => { expect(ref.current?.queueTrack(alpha)).toBe(true) })
    act(() => { expect(ref.current?.queueTrack(beta)).toBe(true) })
    act(() => { expect(ref.current?.queueTrack(gamma)).toBe(true) })
    act(() => { expect(ref.current?.queueTrack(beta)).toBe(false) })
    expect(screen.getByRole('status').textContent).toMatch(/already playing or queued/i)
    await user.click(screen.getByRole('button', { name: 'Queue (3)' }))
    const queue = screen.getByRole('list')
    expect(queue.textContent).toMatch(/Alpha.*Beta.*Gamma/s)
    await user.click(screen.getByRole('button', { name: 'Move Gamma up' }))
    expect(queue.textContent).toMatch(/Alpha.*Gamma.*Beta/s)
    await user.click(screen.getByRole('button', { name: 'Remove Alpha from queue' }))
    expect(queue.textContent).not.toContain('Alpha')
    expect(JSON.parse(localStorage.getItem('soundcloud_audius_queue') || '[]')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Clear queue' }))
    expect(screen.getByText('Queue is empty.')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('soundcloud_audius_queue') || '[]')).toEqual([])
  })

  it('prioritizes the queued track over recommendations and plays it next', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const current = track('Now1', 'Now Playing')
    const queued = track('Next2', 'Queued First')
    const recommendation = track('Rec3', 'Recommended Later')
    const user = userEvent.setup()
    render(<AudiusPlaybackPlayer ref={ref} recommendations={[recommendation]} />)

    await act(async () => {
      ref.current?.playTrack(current)
      ref.current?.queueTrack(queued)
    })
    const nextUp = screen.getByLabelText('Next Up')
    expect(nextUp.textContent).toContain('Queued First')
    expect(nextUp.textContent).not.toContain('Recommended Later')
    await user.click(within(nextUp).getByRole('button', { name: 'Play Next' }))
    expect(screen.getByText('Queued First')).toBeTruthy()
    expect(document.querySelector('audio')?.getAttribute('src')).toBe('https://api.audius.co/v1/tracks/Next2/stream')
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('autoplays the first eligible queued track before recommendations after track end', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const user = userEvent.setup()
    const queued = track('Queue2', 'Queued Next')
    const recommendation = track('Reco3', 'Recommendation')
    render(<AudiusPlaybackPlayer ref={ref} recommendations={[recommendation]} />)
    await act(async () => { ref.current?.playTrack(track('Now1', 'Now Playing')) })
    await act(async () => { ref.current?.queueTrack(queued) })
    await user.click(screen.getByRole('checkbox', { name: 'Autoplay Next' }))
    fireEvent.ended(document.querySelector('audio')!)

    await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
    expect(document.querySelector('audio')?.getAttribute('src')).toBe('https://api.audius.co/v1/tracks/Queue2/stream')
    expect(screen.getByText('Queued Next')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Queue (0)' })).toBeTruthy()
  })

  it('keeps autoplay off by default and starts the next recommendation only when enabled', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const current = track('Now1', 'Now Playing')
    const recommendation = track('Rec3', 'Recommended Later')
    const user = userEvent.setup()
    render(<AudiusPlaybackPlayer ref={ref} recommendations={[recommendation]} />)

    await act(async () => { ref.current?.playTrack(current) })
    const audio = document.querySelector('audio')!
    expect((screen.getByRole('checkbox', { name: 'Autoplay Next' }) as HTMLInputElement).checked).toBe(false)
    fireEvent.ended(audio)
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Next Up').textContent).toContain('Recommended Later')

    await user.click(screen.getByRole('checkbox', { name: 'Autoplay Next' }))
    await act(async () => { ref.current?.playTrack(current) })
    fireEvent.ended(audio)
    await waitFor(() => expect(play).toHaveBeenCalledTimes(3))
    expect(audio.getAttribute('src')).toBe('https://api.audius.co/v1/tracks/Rec3/stream')
  })

  it('synchronizes 0%, 50%, and 100% volume with the audio element and restores mute volume', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(<AudiusPlaybackPlayer ref={ref} />)
    await act(async () => { ref.current?.playTrack(track('A1', 'Alpha')) })
    const audio = document.querySelector('audio')!
    const slider = screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement

    fireEvent.change(slider, { target: { value: '0.5' } })
    expect(audio.volume).toBe(0.5)
    expect(screen.getByText('50%')).toBeTruthy()
    expect(localStorage.getItem('soundcloud_audius_volume')).toBe('0.5')
    fireEvent.change(slider, { target: { value: '1' } })
    expect(audio.volume).toBe(1)
    expect(screen.getByText('100%')).toBeTruthy()
    fireEvent.change(slider, { target: { value: '0' } })
    expect(audio.volume).toBe(0)
    expect(audio.muted).toBe(true)
    expect(screen.getByText('0%')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Unmute' }))
    expect(audio.volume).toBe(1)
    expect(audio.muted).toBe(false)
  })

  it('starts unmuted at the default volume when no preference is saved', async () => {
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    render(<AudiusPlaybackPlayer ref={ref} />)

    await act(async () => { ref.current?.playTrack(track('Default1', 'Default Volume')) })
    const audio = document.querySelector('audio')!
    expect((screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement).value).toBe('0.7')
    expect(audio.volume).toBe(0.7)
    expect(audio.muted).toBe(false)
    expect(screen.getByText('70%')).toBeTruthy()
  })

  it('restores saved volume and safely revalidates a persisted queue', async () => {
    const savedTrack = track('Persist1', 'Saved Track')
    localStorage.setItem('soundcloud_audius_volume', '0.5')
    localStorage.setItem('soundcloud_audius_queue', JSON.stringify([savedTrack, { ...savedTrack, playbackId: '../bad' }]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: 'Persist1', title: 'Saved Track', user: { name: 'Independent Artist' }, license: 'All rights reserved',
      is_streamable: true, is_available: true, is_delete: false, is_unlisted: false, is_stream_gated: false,
      stream_conditions: null, access: { stream: true },
    } }), { status: 200 })))
    const ref = createRef<AudiusPlaybackPlayerHandle>()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    render(<AudiusPlaybackPlayer ref={ref} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Queue (1)' })).toBeTruthy())
    await userEvent.setup().click(screen.getByRole('button', { name: 'Queue (1)' }))
    expect(within(screen.getByRole('list')).getByText('Saved Track')).toBeTruthy()
    await act(async () => { ref.current?.playTrack(track('Now2', 'Current Track')) })
    expect((screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement).value).toBe('0.5')
    expect(JSON.parse(localStorage.getItem('soundcloud_audius_queue') || '[]')).toHaveLength(1)
  })
})
