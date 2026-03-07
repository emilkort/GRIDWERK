import { useCollectionStore } from '@/stores/collection.store'

const STAGE_COLORS: Record<string, string> = {
  idea: '#3b82f6', in_progress: '#f97316', mixing: '#8b5cf6', done: '#22c55e'
}

function formatKey(key: string | null): string {
  if (!key) return ''
  return key.replace(' Major', 'M').replace(' Minor', 'm')
}

export default function SuggestionSidebar() {
  const {
    selectedCollectionId, items, suggestions, suggestionsLoading, addItem
  } = useCollectionStore()

  if (!selectedCollectionId) return null

  // Compute collection stats for the header
  const bpms = items.map(i => i.bpm).filter((b): b is number => b != null)
  const avgBpm = bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null
  const keys = items.map(i => i.musical_key).filter((k): k is string => k != null)
  const keyCounts = new Map<string, number>()
  for (const k of keys) keyCounts.set(k, (keyCounts.get(k) || 0) + 1)
  const dominantKey = keyCounts.size > 0 ? [...keyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null

  const existingIds = new Set(items.map(i => i.project_id))

  return (
    <div className="w-72 bg-base border-l border-border flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">Suggestions</h3>
        </div>

        {/* Collection profile summary */}
        {items.length > 0 && (
          <div className="space-y-1 text-[10px] text-text-dark">
            {avgBpm && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-darker">Avg BPM:</span>
                <span className="font-bold text-text-secondary">{avgBpm}</span>
              </div>
            )}
            {dominantKey && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-darker">Dominant Key:</span>
                <span className="font-bold text-text-secondary">{formatKey(dominantKey)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestion list */}
      <div className="flex-1 overflow-y-auto">
        {suggestionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-text-darker border-t-text animate-spin rounded-full" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-text-darker text-[11px]">No suggestions available</p>
            <p className="text-[10px] text-text-darker mt-1">Create more projects to get recommendations</p>
          </div>
        ) : (
          <div className="py-1">
            {suggestions.filter(s => !existingIds.has(s.project_id)).map(s => {
              const stageColor = STAGE_COLORS[s.stage] || '#666'
              return (
                <div
                  key={s.project_id}
                  className="group px-4 py-3 border-b border-border/30 hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-text font-medium truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {s.bpm && (
                          <span className="text-[10px] text-text-dark tabular-nums">{Math.round(s.bpm)} bpm</span>
                        )}
                        {s.musical_key && (
                          <span className="text-[10px] text-text-dark font-bold">{formatKey(s.musical_key)}</span>
                        )}
                        <span
                          className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 ml-auto"
                          style={{ color: stageColor, backgroundColor: `${stageColor}10`, border: `1px solid ${stageColor}25` }}
                        >
                          {s.stage.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => addItem(selectedCollectionId!, s.project_id)}
                      className="shrink-0 p-1 text-text-darker hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                      title="Add to collection"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </div>

                  {/* Reason */}
                  <p className="text-[9px] text-accent/70 mt-1.5 leading-relaxed">
                    {s.reason}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
