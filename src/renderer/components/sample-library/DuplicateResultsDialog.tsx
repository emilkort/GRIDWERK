import { useEffect, useState } from 'react'

interface DuplicateGroup {
  hash: string
  samples: { id: number; file_name: string; file_path: string; file_size: number | null }[]
}

interface NearDuplicateGroup {
  samples: { id: number; file_name: string; file_path: string; file_size: number | null; similarity: number }[]
}

interface DuplicateResults {
  exact: DuplicateGroup[]
  near: NearDuplicateGroup[]
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DuplicateResultsDialog({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DuplicateResults | null>(null)
  const [loading, setLoading] = useState(true)
  // Track which sample IDs the user wants to DELETE (not keep)
  const [markedForDelete, setMarkedForDelete] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteFromDisk, setDeleteFromDisk] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await window.api.sample.findDuplicates()
        if (!cancelled) {
          setResults(data)
          // Auto-mark: for each exact group, mark all but the largest for deletion
          const autoDelete = new Set<number>()
          for (const group of data.exact) {
            const sorted = [...group.samples].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))
            // Keep first (largest), mark rest
            for (let i = 1; i < sorted.length; i++) {
              autoDelete.add(sorted[i].id)
            }
          }
          setMarkedForDelete(autoDelete)
        }
      } catch (err) {
        console.error('Failed to find duplicates:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggleMark = (id: number) => {
    setMarkedForDelete(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async () => {
    if (markedForDelete.size === 0) return
    setDeleting(true)
    try {
      const ids = [...markedForDelete]
      for (const id of ids) {
        await window.api.sample.delete(id, deleteFromDisk)
      }
      // Refresh
      const data = await window.api.sample.findDuplicates()
      setResults(data)
      setMarkedForDelete(new Set())
      setConfirmDelete(false)
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  const totalExact = results?.exact.reduce((sum, g) => sum + g.samples.length, 0) ?? 0
  const totalNear = results?.near.reduce((sum, g) => sum + g.samples.length, 0) ?? 0

  // Estimate space freed
  const spaceFreed = results
    ? [...results.exact.flatMap(g => g.samples), ...results.near.flatMap(g => g.samples)]
        .filter(s => markedForDelete.has(s.id))
        .reduce((sum, s) => sum + (s.file_size ?? 0), 0)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/60 backdrop-blur-sm">
      <div className="bg-surface border border-border w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-[13px] font-bold text-text uppercase tracking-[0.1em]">Duplicate Cleanup</h2>
            {results && (
              <p className="text-[10px] text-text-dark mt-1">
                {results.exact.length} exact group{results.exact.length !== 1 ? 's' : ''} ({totalExact} files)
                {results.near.length > 0 && ` · ${results.near.length} near-duplicate group${results.near.length !== 1 ? 's' : ''} (${totalNear} files)`}
                {markedForDelete.size > 0 && (
                  <span className="text-accent-red ml-2">
                    {markedForDelete.size} selected for removal ({formatSize(spaceFreed)})
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-elevated text-text-dark hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
                <span className="text-text-dark text-[11px] uppercase tracking-widest">Scanning for duplicates...</span>
              </div>
            </div>
          ) : !results || (results.exact.length === 0 && results.near.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-10 h-10 text-text-dark mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-text-secondary text-[12px] font-bold uppercase tracking-widest">No duplicates found</p>
              <p className="text-text-dark text-[10px] mt-1">Your sample library is clean!</p>
            </div>
          ) : (
            <>
              {/* Exact duplicates */}
              {results.exact.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-accent uppercase tracking-[0.15em] mb-3">
                    Exact Duplicates
                  </h3>
                  <div className="space-y-3">
                    {results.exact.map((group, gi) => (
                      <div key={gi} className="border border-border bg-base p-3 space-y-1">
                        {group.samples.map((s) => {
                          const isMarked = markedForDelete.has(s.id)
                          return (
                            <div key={s.id} className={`flex items-center gap-3 py-1 ${isMarked ? 'opacity-50' : ''}`}>
                              <button
                                onClick={() => toggleMark(s.id)}
                                className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-all ${
                                  isMarked
                                    ? 'bg-red-500/80 border-red-500'
                                    : 'border-green-500/50 bg-green-500/10'
                                }`}
                                title={isMarked ? 'Click to keep' : 'Click to remove'}
                              >
                                {isMarked ? (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                ) : (
                                  <svg className="w-2.5 h-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ${isMarked ? 'text-red-400' : 'text-green-400'}`}>
                                {isMarked ? 'Remove' : 'Keep'}
                              </span>
                              <span className="flex-1 text-[10px] text-text truncate font-mono">{s.file_path}</span>
                              <span className="text-[9px] text-text-dark shrink-0">{formatSize(s.file_size)}</span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Near duplicates */}
              {results.near.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-accent-orange uppercase tracking-[0.15em] mb-3">
                    Near Duplicates
                  </h3>
                  <div className="space-y-3">
                    {results.near.map((group, gi) => (
                      <div key={gi} className="border border-border bg-base p-3 space-y-1">
                        {group.samples.map((s) => {
                          const isMarked = markedForDelete.has(s.id)
                          return (
                            <div key={s.id} className={`flex items-center gap-3 py-1 ${isMarked ? 'opacity-50' : ''}`}>
                              <button
                                onClick={() => toggleMark(s.id)}
                                className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-all ${
                                  isMarked
                                    ? 'bg-red-500/80 border-red-500'
                                    : 'border-border'
                                }`}
                                title={isMarked ? 'Click to keep' : 'Click to remove'}
                              >
                                {isMarked && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </button>
                              <span className="flex-1 text-[10px] text-text truncate font-mono">{s.file_path}</span>
                              <span className="text-[9px] text-accent-orange font-bold shrink-0">
                                {Math.round(s.similarity * 100)}%
                              </span>
                              <span className="text-[9px] text-text-dark shrink-0">{formatSize(s.file_size)}</span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            {markedForDelete.size > 0 && !confirmDelete && (
              <>
                <label className="flex items-center gap-1.5 text-[10px] text-text-dark cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteFromDisk}
                    onChange={(e) => setDeleteFromDisk(e.target.checked)}
                    className="accent-red-500"
                  />
                  Also delete files from disk
                </label>
              </>
            )}
            {confirmDelete && (
              <span className="text-[10px] text-red-400 font-bold">
                Are you sure? This will {deleteFromDisk ? 'permanently delete files from disk' : 'remove from database only'}.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {markedForDelete.size > 0 && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
              >
                Delete {markedForDelete.size} file{markedForDelete.size !== 1 ? 's' : ''}
              </button>
            )}
            {confirmDelete && (
              <>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 bg-elevated border border-border text-text-secondary text-[10px] font-bold uppercase tracking-widest hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-elevated border border-border text-text-secondary text-[10px] font-bold uppercase tracking-widest hover:text-text transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
