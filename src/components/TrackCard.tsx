import type { Track } from '../types'
import FeedbackControls from './FeedbackControls'
import type { FeedbackAction } from '../recommendation/tasteProfile'

interface TrackCardProps {
  track: Track
  onToggleFavorite: (trackId: string) => void
  favoriteEnabled?: boolean
  recommendation?: {
    reason: string
    score?: number
  }
  feedback?: FeedbackAction | null
  onFeedback?: (action: FeedbackAction) => void
  onPlay?: (trackId: string) => void
  isCurrentTrack?: boolean
  isPlaying?: boolean
  onQueue?: (trackId: string) => void
  isQueued?: boolean
}

export default function TrackCard({ track, onToggleFavorite, favoriteEnabled = true, recommendation, feedback = null, onFeedback, onPlay, isCurrentTrack = false, isPlaying = false, onQueue, isQueued = false }: TrackCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatPlays = (plays: number) => {
    if (plays >= 1000000) {
      return `${(plays / 1000000).toFixed(1)}M`
    }
    if (plays >= 1000) {
      return `${(plays / 1000).toFixed(1)}K`
    }
    return plays.toString()
  }

  return (
    <article className="track-card" aria-label={`${track.title} by ${track.artist || 'Unknown artist'}`}>
      <div className="track-image-container">
        {track.image
          ? <img src={track.image} alt={track.title} className="track-image" />
          : <div className="track-image-placeholder" aria-label="Artwork unavailable">Artwork unavailable</div>}
        {favoriteEnabled && <button
          className={`favorite-button ${track.isFavorite ? 'active' : ''}`}
          onClick={() => onToggleFavorite(track.id)}
          aria-label={track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {track.isFavorite ? '❤️' : '🤍'}
        </button>}
        {track.sourceName !== 'MusicBrainz' && <button
          type="button"
          className="play-button"
          disabled={track.sourceName === 'Audius' ? !track.playbackAvailable : true}
          onClick={track.sourceName === 'Audius' && track.playbackAvailable ? () => onPlay?.(track.id) : undefined}
          aria-label={track.sourceName === 'Audius' ? (isCurrentTrack && isPlaying ? `Pause ${track.title}` : isCurrentTrack ? `Resume ${track.title}` : `Play ${track.title}`) : 'Playback unavailable in demo'}
          title={track.sourceName === 'Audius' ? (track.playbackUnavailableReason || 'Play this track from Audius') : 'Playback not available in the demo catalog.'}
        >
          {track.sourceName === 'Audius' ? (isCurrentTrack && isPlaying ? '⏸' : '▶') : '▶️'}
        </button>}
        {track.sourceName === 'Audius' && track.playbackAvailable && onQueue && <button
          type="button"
          className="queue-button"
          disabled={isQueued || isCurrentTrack}
          onClick={() => onQueue(track.id)}
          aria-label={isQueued ? `${track.title} already queued` : isCurrentTrack ? `${track.title} is playing` : `Add ${track.title} to queue`}
          title={isQueued ? 'Already in queue' : 'Add to playback queue'}
        >{isQueued || isCurrentTrack ? '✓' : '+'}</button>}
      </div>

      <div className="track-info">
        <h3 className="track-title">{track.title}</h3>
        <p className="track-artist">{track.artist || 'Unknown artist'}</p>
        {(track.album || track.releaseDate) && <p className="track-release">
          {track.album}{track.album && track.releaseDate ? ' · ' : ''}{track.releaseDate}
        </p>}

        {(track.genre || (track.duration && track.duration > 0)) && <div className="track-meta">
          {track.genre && <span className="genre-badge">{track.genre}</span>}
          {track.duration && track.duration > 0 ? <span className="duration">{formatDuration(track.duration)}</span> : null}
        </div>}

        {track.plays !== undefined && <div className="track-stats">
          <span className="plays">🎧 {formatPlays(track.plays)} plays</span>
        </div>}

        {track.sourceName && track.sourceUrl && <p className="track-source">Source: <a href={track.sourceUrl} target="_blank" rel="noreferrer">{track.sourceName === 'Audius' ? 'Audius track' : track.sourceName}</a>{track.sourceName === 'MusicBrainz' ? ' · Metadata only; playback is unavailable. Favorites are limited to the demo catalog.' : track.sourceName === 'Audius' ? ' · Creator-uploaded track; playback follows Audius stream and license status.' : ''}</p>}

        {onFeedback && (
          <FeedbackControls
            trackTitle={track.title}
            selected={feedback}
            onSelect={onFeedback}
          />
        )}

        {recommendation && feedback !== 'dislike' && (
          <div className="recommendation-badge" title={recommendation.reason}>
            <span className="badge-icon">✨</span>
            <span className="badge-text">{recommendation.reason}</span>
            {recommendation.score && (
              <span className="badge-score">{Math.round(recommendation.score)}%</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

