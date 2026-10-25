import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { AudiusTrack } from '../providers/audius'
import { audiusProvider, getAudiusStreamUrl } from '../providers/audius'
import './AudiusPlaybackPlayer.css'

export interface AudiusPlaybackPlayerHandle {
  playTrack: (track: AudiusTrack) => void
  stop: () => void
  queueTrack: (track: AudiusTrack) => boolean
  isQueued: (trackId: string) => boolean
}

interface AudiusPlaybackPlayerProps {
  recommendations?: AudiusTrack[]
  feedbackByTrack?: Record<string, { action?: string }>
  onTrackChange?: (trackId: string | null) => void
  onPlayingChange?: (isPlaying: boolean) => void
  onQueueChange?: (trackIds: string[]) => void
}

const QUEUE_STORAGE_KEY = 'soundcloud_audius_queue'
const VOLUME_STORAGE_KEY = 'soundcloud_audius_volume'
const AUTOPLAY_STORAGE_KEY = 'soundcloud_audius_autoplay'
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const safeSeconds = Math.floor(seconds)
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function loadVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (stored === null) return 0.7
    const value = Number(stored)
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.7
  } catch { return 0.7 }
}

function loadAutoplay(): boolean {
  try { return localStorage.getItem(AUTOPLAY_STORAGE_KEY) === 'true' } catch { return false }
}

function isTrackSnapshot(value: unknown): value is AudiusTrack {
  if (!value || typeof value !== 'object') return false
  const track = value as Partial<AudiusTrack>
  const safeArtwork = typeof track.artwork !== 'string' || (() => {
    try { return ['https:', 'http:'].includes(new URL(track.artwork as string).protocol) } catch { return false }
  })()
  const safeExternalUrl = typeof track.externalUrl !== 'string' || (() => {
    try { const url = new URL(track.externalUrl as string); return url.protocol === 'https:' && ['audius.co', 'www.audius.co'].includes(url.hostname) } catch { return false }
  })()
  return track.source === 'audius' && typeof track.playbackId === 'string' && ID_PATTERN.test(track.playbackId) &&
    typeof track.title === 'string' && typeof track.artist === 'string' && typeof track.id === 'string' &&
    track.sourceId === track.playbackId && track.id === `audius_${track.playbackId}` && Array.isArray(track.genres) &&
    track.genres.every((genre) => typeof genre === 'string') && typeof track.duration === 'number' && Number.isFinite(track.duration) && track.duration >= 0 &&
    safeArtwork && safeExternalUrl
}

function readQueueSnapshots(): AudiusTrack[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isTrackSnapshot) : []
  } catch { return [] }
}

const AudiusPlaybackPlayer = forwardRef<AudiusPlaybackPlayerHandle, AudiusPlaybackPlayerProps>(function AudiusPlaybackPlayer({ recommendations = [], feedbackByTrack = {}, onTrackChange, onPlayingChange, onQueueChange }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const requestRef = useRef(0)
  const [currentTrack, setCurrentTrack] = useState<AudiusTrack | null>(null)
  const [queue, setQueue] = useState<AudiusTrack[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volumeSupported, setVolumeSupported] = useState(false)
  const [volume, setVolume] = useState(loadVolume)
  const [previousVolume, setPreviousVolume] = useState(() => loadVolume() || 0.7)
  const [isMuted, setIsMuted] = useState(loadVolume() === 0)
  const [autoplay, setAutoplay] = useState(loadAutoplay)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [queueNotice, setQueueNotice] = useState('')

  const updatePlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing)
    onPlayingChange?.(playing)
  }, [onPlayingChange])

  const safeCandidates = recommendations.filter((track) =>
    track.playbackAvailable && track.playbackId !== currentTrack?.playbackId &&
    !queue.some((queued) => queued.playbackId === track.playbackId) &&
    feedbackByTrack[track.id]?.action !== 'skip' && feedbackByTrack[track.id]?.action !== 'dislike',
  )
  const queuedNextTrack = queue.find((track) => track.playbackAvailable)
  const nextTrack = queuedNextTrack ?? safeCandidates[suggestionIndex % Math.max(safeCandidates.length, 1)] ?? null

  const startTrack = useCallback((track: AudiusTrack) => {
    const audio = audioRef.current
    if (!audio || !track.playbackAvailable) return
    const requestId = ++requestRef.current
    audio.pause()
    setCurrentTrack(track)
    onTrackChange?.(track.id)
    setCurrentTime(0)
    setDuration(track.duration || 0)
    setError('')
    setIsBuffering(true)
    updatePlaying(false)
    audio.src = getAudiusStreamUrl(track.playbackId)
    if (volumeSupported) audio.volume = volume
    audio.muted = isMuted
    audio.load()
    void audio.play().then(() => {
      if (requestId === requestRef.current) {
        updatePlaying(true)
        setIsBuffering(false)
      }
    }).catch(() => {
      if (requestId === requestRef.current) {
        updatePlaying(false)
        setIsBuffering(false)
        setError('Audius could not play this track. It may have become unavailable or restricted. Try another track or open its Audius page.')
      }
    })
  }, [isMuted, onTrackChange, updatePlaying, volume, volumeSupported])

  const playTrack = useCallback((track: AudiusTrack) => {
    const audio = audioRef.current
    if (!audio || !track.playbackAvailable) return
    if (currentTrack?.playbackId === track.playbackId) {
      if (isPlaying) {
        audio.pause()
        updatePlaying(false)
        setIsBuffering(false)
      } else {
        setError('')
        setIsBuffering(true)
        const requestId = ++requestRef.current
        if (volumeSupported) audio.volume = volume
        audio.muted = isMuted
        void audio.play().then(() => {
          if (requestId === requestRef.current) { updatePlaying(true); setIsBuffering(false) }
        }).catch(() => {
          if (requestId === requestRef.current) {
            updatePlaying(false); setIsBuffering(false)
            setError('Audius could not start this track. Try again or open the original track page.')
          }
        })
      }
      return
    }
    startTrack(track)
  }, [currentTrack, isMuted, isPlaying, startTrack, updatePlaying, volume, volumeSupported])

  const persistQueue = useCallback((nextQueue: AudiusTrack[]) => {
    setQueue(nextQueue)
    onQueueChange?.(nextQueue.map((track) => track.id))
    try { localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(nextQueue)) } catch { setQueueNotice('Queue could not be saved in this browser.') }
  }, [onQueueChange])

  const queueTrack = useCallback((track: AudiusTrack) => {
    if (!track.playbackAvailable) {
      setQueueNotice('This track is unavailable and cannot be queued.')
      return false
    }
    if (track.playbackId === currentTrack?.playbackId || queue.some((queued) => queued.playbackId === track.playbackId)) {
      setQueueNotice(`${track.title} is already playing or queued.`)
      return false
    }
    persistQueue([...queue, track])
    setQueueNotice(`Queued ${track.title}.`)
    return true
  }, [currentTrack, persistQueue, queue])

  const stop = useCallback(() => {
    requestRef.current += 1
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    setCurrentTrack(null)
    onTrackChange?.(null)
    setCurrentTime(0); setDuration(0); setError(''); setIsBuffering(false)
    updatePlaying(false)
  }, [onTrackChange, updatePlaying])

  useImperativeHandle(ref, () => ({
    playTrack,
    stop,
    queueTrack,
    isQueued: (trackId) => queue.some((track) => track.id === trackId || track.playbackId === trackId),
  }), [playTrack, queue, queueTrack, stop])

  useEffect(() => {
    const audio = audioRef.current
    setVolumeSupported(typeof audio?.volume === 'number')
    if (audio) { if (volumeSupported) audio.volume = volume; audio.muted = isMuted }
    try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volume)) } catch { /* storage is optional */ }
  }, [isMuted, volume, volumeSupported])

  useEffect(() => {
    try { localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(autoplay)) } catch { /* storage is optional */ }
  }, [autoplay])

  useEffect(() => {
    const snapshots = readQueueSnapshots()
    if (!snapshots.length) return
    let cancelled = false
    void Promise.all(snapshots.map(async (snapshot) => {
      try {
        const fresh = await audiusProvider.getTrack(snapshot.playbackId)
        return fresh?.playbackAvailable ? fresh : { ...snapshot, playbackAvailable: false, playbackUnavailableReason: 'Audius no longer reports this queued track as publicly playable.' }
      } catch {
        return { ...snapshot, playbackAvailable: false, playbackUnavailableReason: 'Could not revalidate this queued track with Audius. Search again before playing it.' }
      }
    })).then((restored) => {
      if (!cancelled) {
        setQueue((currentQueue) => {
          const merged = [...restored, ...currentQueue]
          const unique = merged.filter((track, index, all) => all.findIndex((item) => item.playbackId === track.playbackId) === index)
          onQueueChange?.(unique.map((track) => track.id))
          try { localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(unique)) } catch { /* storage is optional */ }
          return unique
        })
      }
    })
    return () => { cancelled = true }
  }, [onQueueChange])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onVolumeChange = () => {
      if (typeof audio.volume === 'number') setVolume(audio.volume)
      setIsMuted(audio.muted)
    }
    audio.addEventListener('volumechange', onVolumeChange)
    return () => audio.removeEventListener('volumechange', onVolumeChange)
  }, [])

  const handleEnded = () => {
    updatePlaying(false)
    setIsBuffering(false)
    if (autoplay && nextTrack?.playbackAvailable) {
      if (queuedNextTrack?.playbackId === nextTrack.playbackId) persistQueue(queue.filter((track) => track.playbackId !== nextTrack.playbackId))
      startTrack(nextTrack)
    }
  }

  const removeQueued = (index: number) => persistQueue(queue.filter((_, queueIndex) => queueIndex !== index))
  const moveQueued = (index: number, offset: number) => {
    const destination = index + offset
    if (destination < 0 || destination >= queue.length) return
    const reordered = [...queue]
    const [track] = reordered.splice(index, 1)
    reordered.splice(destination, 0, track)
    persistQueue(reordered)
  }

  const setVolumeValue = (value: number) => {
    const normalized = Math.max(0, Math.min(1, value))
    if (normalized > 0) setPreviousVolume(normalized)
    setVolume(normalized)
    setIsMuted(normalized === 0)
    if (audioRef.current) { if (volumeSupported) audioRef.current.volume = normalized; audioRef.current.muted = normalized === 0 }
  }
  const toggleMute = () => {
    if (!audioRef.current) return
    if (isMuted || volume === 0) {
      const restored = previousVolume || 0.7
      setVolumeValue(restored)
    } else {
      setPreviousVolume(volume)
      setIsMuted(true)
      audioRef.current.muted = true
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        style={{ display: 'none' }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => { setIsBuffering(false); updatePlaying(true) }}
        onPause={() => updatePlaying(false)}
        onError={() => {
          if (!currentTrack) return
          setIsBuffering(false); updatePlaying(false)
          setError('Audius could not play this track. It may have become unavailable or restricted. Try another track or open its Audius page.')
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const mediaDuration = event.currentTarget.duration
          if (Number.isFinite(mediaDuration) && mediaDuration > 0) setDuration(mediaDuration)
        }}
        onDurationChange={(event) => {
          const mediaDuration = event.currentTarget.duration
          if (Number.isFinite(mediaDuration) && mediaDuration > 0) setDuration(mediaDuration)
        }}
        onEnded={handleEnded}
      />
      {(currentTrack || queueOpen || queue.length > 0) && (
        <section className="audius-player" aria-label="Audius player">
          {currentTrack?.artwork && <img className="audius-player-artwork" src={currentTrack.artwork} alt="" />}
          <div className="audius-player-track">
            <span className="audius-player-eyebrow">{currentTrack ? 'Now playing on Audius' : 'Playback queue'}</span>
            <strong>{currentTrack?.title ?? 'No track playing'}</strong>
            <span>{currentTrack?.artist ?? 'Add eligible Audius tracks from Discover.'}</span>
            {currentTrack?.externalUrl && <a href={currentTrack.externalUrl} target="_blank" rel="noreferrer">Open original track</a>}
          </div>
          {currentTrack && <div className="audius-player-controls">
            <button type="button" onClick={() => playTrack(currentTrack)} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isBuffering ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
            </button>
            <label className="audius-progress-label">
              <span className="sr-only">Playback position</span>
              <span className="audius-time">{formatTime(currentTime)}</span>
              <input aria-label="Playback position" type="range" min={0} max={duration || 0} step={0.1}
                value={Math.min(currentTime, duration || currentTime)} disabled={!duration}
                onChange={(event) => {
                  const nextTime = Number(event.currentTarget.value)
                  if (audioRef.current && Number.isFinite(nextTime)) { audioRef.current.currentTime = nextTime; setCurrentTime(nextTime) }
                }} />
              <span className="audius-time">{formatTime(duration)}</span>
            </label>
            <button type="button" className="audius-stop-button" onClick={stop} aria-label="Stop playback">Stop</button>
          </div>}
          {currentTrack && <div className="audius-volume-controls">
            <button type="button" className="audius-mute-button" aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'} onClick={toggleMute}>
              {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <label htmlFor="audius-volume">Volume <output htmlFor="audius-volume">{Math.round(volume * 100)}%</output></label>
            <input id="audius-volume" aria-label="Volume" type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} disabled={!volumeSupported} onChange={(event) => setVolumeValue(Number(event.currentTarget.value))} />
            {!volumeSupported && <small className="audius-volume-unavailable">Volume adjustment is unavailable in this browser.</small>}
          </div>}
          <div className="audius-queue-actions">
            <button type="button" aria-expanded={queueOpen} onClick={() => setQueueOpen(!queueOpen)}>Queue ({queue.length})</button>
            <label><input aria-label="Autoplay Next" type="checkbox" checked={autoplay} onChange={(event) => setAutoplay(event.currentTarget.checked)} /> Autoplay Next</label>
          </div>
          {nextTrack && <div className="audius-next-up" aria-label="Next Up">
            <span>Next Up{queue.length ? ' · queued' : ' · recommendation'}</span>
            <strong>{nextTrack.title}</strong><span>{nextTrack.artist}</span>
            <button type="button" disabled={!nextTrack.playbackAvailable} onClick={() => {
              if (queuedNextTrack?.playbackId === nextTrack.playbackId) persistQueue(queue.filter((track) => track.playbackId !== nextTrack.playbackId))
              playTrack(nextTrack)
            }}>Play Next</button>
            {queue.length === 0 && <button type="button" onClick={() => setSuggestionIndex((suggestionIndex + 1) % Math.max(safeCandidates.length, 1))}>Another recommendation</button>}
          </div>}
          {queueOpen && <div className="audius-queue" aria-label="Playback queue">
            {queue.length === 0 ? <p>Queue is empty.</p> : <ol>
              {queue.map((track, index) => <li key={track.playbackId} className={queue.find((item) => item.playbackAvailable)?.playbackId === track.playbackId ? 'queue-next' : ''}>
                <span><strong>{track.title}</strong><small>{track.artist}</small>{queue.find((item) => item.playbackAvailable)?.playbackId === track.playbackId && <em>Next</em>}{!track.playbackAvailable && <small role="status">Unavailable; remove it, then add it again from fresh search results.</small>}</span>
                <button type="button" aria-label={`Play ${track.title} next`} disabled={!track.playbackAvailable} onClick={() => {
                  persistQueue(queue.filter((item) => item.playbackId !== track.playbackId))
                  playTrack(track)
                }}>Play next</button>
                <button type="button" aria-label={`Move ${track.title} up`} onClick={() => moveQueued(index, -1)} disabled={index === 0}>↑</button>
                <button type="button" aria-label={`Move ${track.title} down`} onClick={() => moveQueued(index, 1)} disabled={index === queue.length - 1}>↓</button>
                <button type="button" aria-label={`Remove ${track.title} from queue`} onClick={() => removeQueued(index)}>Remove</button>
              </li>)}
            </ol>}
            {queue.length > 0 && <button type="button" onClick={() => persistQueue([])}>Clear queue</button>}
          </div>}
          {queueNotice && <span className="audius-player-status" role="status">{queueNotice}</span>}
          {isBuffering && <span className="audius-player-status" role="status">Loading audio…</span>}
          {error && <span className="audius-player-error" role="alert">{error}</span>}
        </section>
      )}
    </>
  )
})

export default AudiusPlaybackPlayer
