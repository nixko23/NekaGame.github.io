import type { FeedbackAction } from '../recommendation/tasteProfile'

interface FeedbackControlsProps {
  trackTitle: string
  selected: FeedbackAction | null
  onSelect: (action: FeedbackAction) => void
}

const actions: Array<{ action: FeedbackAction; label: string; icon: string }> = [
  { action: 'like', label: 'Like', icon: '👍' },
  { action: 'skip', label: 'Skip', icon: '⏭' },
  { action: 'dislike', label: 'Dislike', icon: '👎' },
]

export default function FeedbackControls({ trackTitle, selected, onSelect }: FeedbackControlsProps) {
  return (
    <div className="feedback-controls" aria-label={`Recommendation feedback for ${trackTitle}`}>
      {actions.map(({ action, label, icon }) => (
        <button
          key={action}
          type="button"
          className={`feedback-action ${selected === action ? 'selected' : ''}`}
          aria-label={`${label} ${trackTitle}`}
          aria-pressed={selected === action}
          title={`${label} this track`}
          onClick={() => onSelect(action)}
        >
          <span aria-hidden="true">{icon}</span> {label}
        </button>
      ))}
    </div>
  )
}
