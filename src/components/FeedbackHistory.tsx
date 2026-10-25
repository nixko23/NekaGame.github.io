import FeedbackControls from './FeedbackControls'
import type { FeedbackAction, TrackFeedback } from '../recommendation/tasteProfile'

interface FeedbackHistoryProps {
  feedbackByTrack: Record<string, TrackFeedback>
  onFeedback: (
    trackId: string,
    action: FeedbackAction | null,
    metadata: { title?: string; genres?: string[]; artist?: string; sourceUrl?: string },
  ) => void
}

const actionNames: Record<FeedbackAction, string> = {
  like: 'Liked',
  skip: 'Skipped',
  dislike: 'Disliked',
}

export default function FeedbackHistory({ feedbackByTrack, onFeedback }: FeedbackHistoryProps) {
  const entries = Object.entries(feedbackByTrack)

  return (
    <section className="feedback-history" aria-labelledby="feedback-history-heading">
      <h2 id="feedback-history-heading">Your Feedback</h2>
      <p className="feedback-history-intro">Update or undo feedback at any time. Favorites are managed separately.</p>
      {entries.length === 0 ? (
        <div className="no-results">No track feedback yet. Use Like, Skip, or Dislike on a track card.</div>
      ) : (
        <ul className="feedback-history-list">
          {entries.map(([trackId, feedback]) => {
            const title = feedback.title || 'Track'
            const metadata = { title: feedback.title, artist: feedback.artist, genres: feedback.genres, sourceUrl: feedback.sourceUrl }
            return (
              <li className="feedback-history-item" key={trackId}>
                <div>
                  <h3>{title}</h3>
                  <p>{feedback.artist || 'Unknown artist'}{feedback.genres.length ? ` · ${feedback.genres.join(', ')}` : ''}</p>
                  {feedback.sourceUrl && <p><a href={feedback.sourceUrl} target="_blank" rel="noreferrer">MusicBrainz source</a></p>}
                  <p className="feedback-status">{actionNames[feedback.action]}</p>
                </div>
                <div className="feedback-history-actions">
                  <FeedbackControls
                    trackTitle={title}
                    selected={feedback.action}
                    onSelect={(action) => onFeedback(trackId, action, metadata)}
                  />
                  <button
                    type="button"
                    className="feedback-clear"
                    onClick={() => onFeedback(trackId, null, metadata)}
                    aria-label={`Undo feedback for ${title}`}
                  >
                    Undo
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
