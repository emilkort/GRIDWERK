import { useState, useEffect, useRef, useCallback } from 'react'

interface LogEntry {
  level: string
  message: string
  timestamp: number
}

const MAX_LOGS = 500

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-text-secondary',
  warn: 'text-yellow-400',
  error: 'text-red-400'
}

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [visible, setVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    const unsub = window.api.on.mainLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <>
      {/* Toggle button — fixed bottom-right */}
      <button
        onClick={() => setVisible((v) => !v)}
        className="fixed bottom-3 right-3 z-50 w-8 h-8 bg-elevated border border-border hover:border-border-hover flex items-center justify-center transition-colors"
        title="Toggle Log Viewer"
      >
        <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </button>

      {/* Log panel */}
      {visible && (
        <div className="fixed bottom-12 right-3 z-50 w-[600px] h-[320px] bg-background border border-border shadow-2xl shadow-black/80 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface shrink-0">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Main Process Log</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-text-dark">{logs.length} entries</span>
              <button onClick={clearLogs} className="text-[9px] text-text-dark hover:text-accent transition-colors uppercase tracking-wider">
                Clear
              </button>
              <button onClick={() => setVisible(false)} className="text-text-dark hover:text-text transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Log entries */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto font-mono text-[10px] leading-[1.6] p-2 space-y-0"
          >
            {logs.length === 0 ? (
              <div className="text-text-dark text-center py-8">No logs yet. Trigger an action (e.g. Enrich All) to see output.</div>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="flex gap-2 hover:bg-elevated/50 px-1">
                  <span className="text-text-dark shrink-0">{formatTime(entry.timestamp)}</span>
                  <span className={`${LEVEL_COLORS[entry.level] || 'text-text-secondary'} break-all`}>
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
