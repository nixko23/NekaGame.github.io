import type { Playlist } from '../types'
import TrackCard from './TrackCard'
import type { FeedbackAction } from '../recommendation/tasteProfile'

interface PlaylistDetailProps {
  playlist: Playlist
  onBack: () => void
  onToggleFavorite: (trackId: string) => void
  feedbackByTrack: Record<string, { action: FeedbackAction }>
  onFeedback: (trackId: string, action: FeedbackAction) => void
}

export default function PlaylistDetail({
  playlist,
  onBack,
  onToggleFavorite,
  feedbackByTrack,
  onFeedback,
}: PlaylistDetailProps) {
  return (
    <div className="playlist-detail">
      <button className="back-button" onClick={onBack} title="Back to playlists">
        ← Back
      </button>

      <div className="playlist-detail-header">
        <img src={playlist.image} alt={playlist.name} className="playlist-detail-image" />
        <div className="playlist-detail-info">
          <h2>{playlist.name}</h2>
          <p className="playlist-detail-description">{playlist.description}</p>
          <p className="playlist-detail-count">📍 {playlist.trackCount} tracks total</p>
        </div>
      </div>

      <div className="playlist-tracks-section">
        <h3>Tracks in this playlist</h3>
        {playlist.tracks && playlist.tracks.length > 0 ? (
          <div className="tracks-grid">
            {playlist.tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                onToggleFavorite={onToggleFavorite}
                feedback={feedbackByTrack[track.id]?.action ?? null}
                onFeedback={(action) => onFeedback(track.id, action)}
              />
            ))}
          </div>
        ) : (
          <div className="no-results">No tracks in this playlist.</div>
        )}
      </div>
    </div>
  )
}
