import type { Playlist } from '../types'

interface PlaylistViewProps {
  playlist: Playlist
  onViewPlaylist: (playlist: Playlist) => void
}

export default function PlaylistView({ playlist, onViewPlaylist }: PlaylistViewProps) {
  return (
    <div className="playlist-card">
      <div className="playlist-image">
        <img src={playlist.image} alt={playlist.name} />
        <div className="playlist-overlay">
          <button className="play-button" disabled title="Playback not available in demo">▶️</button>
        </div>
      </div>

      <div className="playlist-info">
        <h3 className="playlist-name">{playlist.name}</h3>
        <p className="playlist-description">{playlist.description}</p>
        <p className="playlist-count">📍 {playlist.trackCount} tracks</p>

        <div className="playlist-preview">
          <h4>Preview:</h4>
          <ul className="preview-tracks">
            {playlist.tracks.slice(0, 3).map((track) => (
              <li key={track.id}>
                <span className="preview-artist">{track.artist}</span>
                <span className="preview-title">{track.title}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          className="view-playlist-btn"
          onClick={() => onViewPlaylist(playlist)}
        >
          View Playlist
        </button>
      </div>
    </div>
  )
}
