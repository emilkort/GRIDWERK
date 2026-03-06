import { useUiStore, type Page } from '@/stores/ui.store'
import { useState, useRef, useEffect, useCallback } from 'react'

const pageLabels: Record<string, string> = {
  'daw-hub': 'DAW Hub',
  'vst-manager': 'VST Plugins',
  'sample-library': 'Sample Library',
  'project-tracker': 'Project Tracker',
  'analytics': 'Analytics',
  'recommendations': 'Recommendations'
}

const entityPageMap: Record<string, Page> = {
  sample: 'sample-library',
  vst: 'vst-manager',
  project: 'project-tracker'
}

export default function TopBar() {
  const { currentPage, searchQuery, setSearchQuery, searchOpen, setSearchOpen, setPage } = useUiStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<any[]>([])

  const handleResultClick = useCallback((result: any) => {
    const page = entityPageMap[result.entityType]
    if (page) {
      setPage(page)
    }
    setSearchOpen(false)
    setSearchQuery('')
  }, [setPage, setSearchOpen, setSearchQuery])

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const data = await window.api.search.query(searchQuery)
        setResults(data)
      } catch {
        setResults([])
      }
    }, 200)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  return (
    <div className="h-14 bg-base border-b border-border flex items-center px-8 gap-6 drag-region shrink-0 z-10">
      {/* Page title */}
      <div className="flex items-center gap-4">
        <h1 className="text-text font-bold text-[11px] tracking-[0.2em] uppercase no-drag">
          {pageLabels[currentPage] || currentPage}
        </h1>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative no-drag">
        <div className="flex items-center gap-2 bg-transparent border-b border-border-hover hover:border-[#444] focus-within:border-white transition-colors pb-1 w-56">
          <svg className="w-3.5 h-3.5 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="search_"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className="bg-transparent text-text text-[11px] outline-none placeholder-text-darker flex-1 tracking-wider uppercase"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && results.length > 0 && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border py-1 z-50 max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={`${r.entityType}-${r.entityId}-${i}`}
                className="w-full text-left px-4 py-2.5 hover:bg-elevated transition-colors flex items-center gap-3"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleResultClick(r)
                }}
              >
                <span className="text-[9px] uppercase font-bold text-accent tracking-[0.15em]">
                  {r.entityType}
                </span>
                <span className="text-[11px] text-text truncate tracking-wide">{r.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PRO badge */}
      <div className="flex items-center gap-4 no-drag">
        <div className="flex items-center gap-1.5 px-2.5 py-1 border border-border">
          <div className="w-3 h-3 bg-accent flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">P</span>
          </div>
          <span className="text-[10px] font-bold text-white tracking-[0.15em]">PRO</span>
        </div>
      </div>
    </div>
  )
}
