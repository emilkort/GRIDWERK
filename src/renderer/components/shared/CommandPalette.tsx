import { useCallback, useEffect, useState } from 'react'
import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import { useUiStore, type Page } from '@/stores/ui.store'

interface SearchResult {
  entityType: string
  entityId: number
  title: string
  tags: string
  metadata: string
}

const NAV_ITEMS: { label: string; page: Page; shortcut: string }[] = [
  { label: 'DAW Hub', page: 'daw-hub', shortcut: '1' },
  { label: 'VST Manager', page: 'vst-manager', shortcut: '2' },
  { label: 'Sample Library', page: 'sample-library', shortcut: '3' },
  { label: 'Project Tracker', page: 'project-tracker', shortcut: '4' },
]

const ENTITY_ICONS: Record<string, JSX.Element> = {
  sample: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </svg>
  ),
  vst: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  project: (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
    </svg>
  ),
}

const NAV_ICONS: Record<Page, JSX.Element> = {
  'daw-hub': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  'vst-manager': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  'sample-library': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </svg>
  ),
  'project-tracker': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
    </svg>
  ),
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const setPage = useUiStore((s) => s.setPage)

  // Ctrl+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await window.api.search.query(query)
        setResults(res)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
  }, [])

  const navigate = useCallback((page: Page) => {
    setPage(page)
    handleClose()
  }, [setPage, handleClose])

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.entityType === 'sample') navigate('sample-library')
    else if (result.entityType === 'vst') navigate('vst-manager')
    else if (result.entityType === 'project') navigate('project-tracker')
    else handleClose()
  }, [navigate, handleClose])

  const sampleResults = results.filter((r) => r.entityType === 'sample').slice(0, 6)
  const vstResults = results.filter((r) => r.entityType === 'vst').slice(0, 6)
  const projectResults = results.filter((r) => r.entityType === 'project').slice(0, 6)

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/70 z-[100]" />
        <Dialog.Content
          className="fixed z-[100] top-[20%] left-1/2 -translate-x-1/2 w-[580px] max-h-[480px] focus:outline-none"
          aria-label="Command palette"
        >
          <Command
            className="flex flex-col bg-base border border-border shadow-2xl shadow-black/90 overflow-hidden"
            loop
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <svg className="w-4 h-4 text-text-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
              </svg>
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search samples, VSTs, projects..."
                className="flex-1 bg-transparent text-text text-[11px] placeholder-text-dark focus:outline-none uppercase tracking-wider"
              />
              {loading && (
                <svg className="w-4 h-4 text-accent animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-text-dark bg-surface border border-border">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <Command.List className="overflow-y-auto max-h-[380px] p-2">
              {/* Navigation group — shown when no query */}
              {!query.trim() && (
                <Command.Group
                  heading="Navigation"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {NAV_ITEMS.map((item) => (
                    <Command.Item
                      key={item.page}
                      value={`navigate-${item.page}`}
                      onSelect={() => navigate(item.page)}
                      className="flex items-center gap-3 px-3 py-2.5 text-[11px] text-text-muted cursor-pointer data-[selected=true]:bg-elevated data-[selected=true]:text-text transition-colors uppercase tracking-wider"
                    >
                      <span className="text-text-secondary">{NAV_ICONS[item.page]}</span>
                      <span className="flex-1">{item.label}</span>
                      <kbd className="text-[10px] font-bold text-text-dark bg-surface border border-border px-1.5 py-0.5">
                        {item.shortcut}
                      </kbd>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Empty state */}
              {query.trim() && !loading && results.length === 0 && (
                <Command.Empty className="py-10 text-center text-[11px] text-text-dark uppercase tracking-wider">
                  No results for "{query}"
                </Command.Empty>
              )}

              {/* Search results */}
              {sampleResults.length > 0 && (
                <Command.Group
                  heading="Samples"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {sampleResults.map((r) => (
                    <Command.Item
                      key={`sample-${r.entityId}`}
                      value={`sample-${r.entityId}-${r.title}`}
                      onSelect={() => handleSelect(r)}
                      className="flex items-center gap-3 px-3 py-2.5 text-[11px] text-text-muted cursor-pointer data-[selected=true]:bg-elevated data-[selected=true]:text-text transition-colors uppercase tracking-wider"
                    >
                      <span className="text-text-muted">{ENTITY_ICONS.sample}</span>
                      <span className="flex-1 truncate">{r.title}</span>
                      {r.metadata && (
                        <span className="text-[10px] text-text-muted shrink-0">{r.metadata.trim().split(' ')[0]}</span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {vstResults.length > 0 && (
                <Command.Group
                  heading="VSTs"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {vstResults.map((r) => (
                    <Command.Item
                      key={`vst-${r.entityId}`}
                      value={`vst-${r.entityId}-${r.title}`}
                      onSelect={() => handleSelect(r)}
                      className="flex items-center gap-3 px-3 py-2.5 text-[11px] text-text-muted cursor-pointer data-[selected=true]:bg-elevated data-[selected=true]:text-text transition-colors uppercase tracking-wider"
                    >
                      <span className="text-text-muted">{ENTITY_ICONS.vst}</span>
                      <span className="flex-1 truncate">{r.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {projectResults.length > 0 && (
                <Command.Group
                  heading="Projects"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {projectResults.map((r) => (
                    <Command.Item
                      key={`project-${r.entityId}`}
                      value={`project-${r.entityId}-${r.title}`}
                      onSelect={() => handleSelect(r)}
                      className="flex items-center gap-3 px-3 py-2.5 text-[11px] text-text-muted cursor-pointer data-[selected=true]:bg-elevated data-[selected=true]:text-text transition-colors uppercase tracking-wider"
                    >
                      <span className="text-text-muted">{ENTITY_ICONS.project}</span>
                      <span className="flex-1 truncate">{r.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[10px] text-text-darker font-medium">
              <span className="flex items-center gap-1">
                <kbd className="bg-surface border border-border px-1">↑</kbd>
                <kbd className="bg-surface border border-border px-1">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-surface border border-border px-1.5">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-surface border border-border px-1.5">Esc</kbd>
                Close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
