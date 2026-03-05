import { memo } from 'react'

interface TagBadgeProps {
  name: string
  color: string
  onRemove?: () => void
}

export default memo(function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-elevated border border-border text-text-muted">
      <span
        className="w-2 h-2 flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 text-text-dark hover:text-text transition-colors"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
})
