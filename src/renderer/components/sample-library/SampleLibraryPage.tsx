import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import * as Popover from '@radix-ui/react-popover'
import { useSampleStore } from '@/stores/sample.store'
import { useAudioPlayerStore } from '@/stores/audioPlayer.store'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import EmptyState from '@/components/shared/EmptyState'
import SampleBrowser from './SampleBrowser'
import SampleRow from './SampleRow'
import SampleDetailPanel from './SampleDetailPanel'
import DuplicateResultsDialog from './DuplicateResultsDialog'
import { getCamelotColor, getCamelotLabel, isCompatibleKey, sortKeysCamelot } from '@/utils/camelot'

const categories = ['All', 'kick', 'snare', 'hi-hat', 'clap', 'percussion', 'bass', 'vocal', 'fx', 'pad', 'synth', 'keys', 'loop', 'one-shot', 'other'] as const

type SortCol = 'name' | 'bpm' | 'key' | 'duration'

export default function SampleLibraryPage() {
  const samples = useSampleStore((s) => s.samples)
  const totalSampleCount = useSampleStore((s) => s.totalSampleCount)
  const folders = useSampleStore((s) => s.folders)
  const selectedSample = useSampleStore((s) => s.selectedSample)
  const filters = useSampleStore((s) => s.filters)
  const loading = useSampleStore((s) => s.loading)
  const tags = useSampleStore((s) => s.tags)
  const fetchFolders = useSampleStore((s) => s.fetchFolders)
  const fetchSamples = useSampleStore((s) => s.fetchSamples)
  const fetchMoreSamples = useSampleStore((s) => s.fetchMoreSamples)
  const hasMore = useSampleStore((s) => s.hasMore)
  const totalFilteredCount = useSampleStore((s) => s.totalFilteredCount)
  const fetchTags = useSampleStore((s) => s.fetchTags)
  const fetchTotalCount = useSampleStore((s) => s.fetchTotalCount)
  const selectSample = useSampleStore((s) => s.selectSample)
  const setFilters = useSampleStore((s) => s.setFilters)

  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const isEnded = useAudioPlayerStore((s) => s.isEnded)
  const play = useAudioPlayerStore((s) => s.play)
  const pause = useAudioPlayerStore((s) => s.pause)

  useEffect(() => {
    fetchFolders()
    fetchSamples()
    fetchTags()
    fetchTotalCount()
  }, [fetchFolders, fetchSamples, fetchTags, fetchTotalCount])

  // Auto-advance to next sample when current track ends naturally
  useEffect(() => {
    if (!isEnded || !selectedSample) return
    const idx = samples.findIndex((s) => s.id === selectedSample.id)
    const next = samples[idx + 1]
    if (next) {
      selectSample(next)
      play(next.file_path)
      virtualizer.scrollToIndex(idx + 1, { align: 'auto' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnded])

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const hasSamples = samples.length > 0 || loading
  const hasFolders = folders.length > 0

  // Unique keys present in current sample list, sorted by Camelot position
  const uniqueKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const s of samples) {
      if (s.musical_key) keys.add(s.musical_key)
    }
    return sortKeysCamelot(Array.from(keys))
  }, [samples])

  // Multi-select state
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<number>>(new Set())
  const lastMultiSelectIdxRef = useRef<number | null>(null)

  // Stable ref-based getter — called only on dragstart, never during render
  const multiSelectedIdsRef = useRef(multiSelectedIds)
  multiSelectedIdsRef.current = multiSelectedIds
  const samplesRef = useRef(samples)
  samplesRef.current = samples
  const getMultiSelectedPaths = useCallback(
    () => samplesRef.current.filter((s) => multiSelectedIdsRef.current.has(s.id)).map((s) => s.file_path),
    []
  )

  const handleMultiToggle = useCallback((sampleId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const idx = samples.findIndex((s) => s.id === sampleId)

    if (e.shiftKey && lastMultiSelectIdxRef.current !== null) {
      const start = Math.min(lastMultiSelectIdxRef.current, idx)
      const end = Math.max(lastMultiSelectIdxRef.current, idx)
      setMultiSelectedIds((prev) => {
        const next = new Set(prev)
        samples.slice(start, end + 1).forEach((s) => next.add(s.id))
        return next
      })
    } else {
      setMultiSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(sampleId)) next.delete(sampleId)
        else next.add(sampleId)
        return next
      })
      lastMultiSelectIdxRef.current = idx
    }
  }, [samples])

  const clearMultiSelection = useCallback(() => {
    setMultiSelectedIds(new Set())
    lastMultiSelectIdxRef.current = null
  }, [])

  // Duplicate detection dialog
  const [showDuplicates, setShowDuplicates] = useState(false)

  // Collapsible panels
  const [browserCollapsed, setBrowserCollapsed] = useState(false)
  const [detailCollapsed, setDetailCollapsed] = useState(false)

  // Filter bar toggle
  const [showFilters, setShowFilters] = useState(true)
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.category !== 'All') count++
    if (filters.tagIds.length > 0) count += filters.tagIds.length
    if (filters.keyFilter) count++
    if (filters.bpmMin !== null || filters.bpmMax !== null) count++
    if (filters.analyzedFilter !== 'all') count++
    return count
  }, [filters])
  const clearAllFilters = useCallback(() => {
    setFilters({ category: 'All', tagIds: [], keyFilter: null, bpmMin: null, bpmMax: null, analyzedFilter: 'all', search: '' })
  }, [setFilters])

  // Local input state for text fields — decoupled from store for debouncing
  const [searchInput, setSearchInput] = useState(filters.search)
  const [bpmMinInput, setBpmMinInput] = useState(filters.bpmMin?.toString() ?? '')
  const [bpmMaxInput, setBpmMaxInput] = useState(filters.bpmMax?.toString() ?? '')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bpmDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Sync local state when store resets filters externally (e.g. clearing all)
  useEffect(() => { if (filters.search === '') setSearchInput('') }, [filters.search])
  useEffect(() => { if (filters.bpmMin === null) setBpmMinInput('') }, [filters.bpmMin])
  useEffect(() => { if (filters.bpmMax === null) setBpmMaxInput('') }, [filters.bpmMax])

  // Virtualization
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const virtualizer = useVirtualizer({
    count: samples.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 48,
    overscan: 5,
  })

  // Infinite scroll — fetch more when nearing the end
  const virtualItems = virtualizer.getVirtualItems()
  const lastVirtualItem = virtualItems[virtualItems.length - 1]
  useEffect(() => {
    if (!lastVirtualItem) return
    if (lastVirtualItem.index >= samples.length - 30 && hasMore && !loading) {
      fetchMoreSamples()
    }
  }, [lastVirtualItem?.index, samples.length, hasMore, loading, fetchMoreSamples])

  // ── Keyboard shortcuts (ref-based to avoid re-registration on scroll/playback) ──
  const selectedSampleRef = useRef(selectedSample)
  selectedSampleRef.current = selectedSample
  const selectedIndexRef = useRef(-1)
  selectedIndexRef.current = selectedSample ? samples.findIndex((s) => s.id === selectedSample.id) : -1
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === ' ') {
        e.preventDefault()
        if (selectedSampleRef.current) {
          if (isPlayingRef.current) pause()
          else play(selectedSampleRef.current.file_path)
        }
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const curIdx = selectedIndexRef.current
        const nextIdx = e.key === 'ArrowDown' ? curIdx + 1 : curIdx - 1
        if (nextIdx >= 0 && nextIdx < samplesRef.current.length) {
          const next = samplesRef.current[nextIdx]
          selectSample(next)
          virtualizer.scrollToIndex(nextIdx, { align: 'auto' })
          if (isPlayingRef.current) play(next.file_path)
        }
        return
      }

      if (e.key === 'Escape') {
        selectSample(null)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key === '[') {
        setBrowserCollapsed((p) => !p)
        return
      }
      if (e.key === ']') {
        setDetailCollapsed((p) => !p)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [play, pause, selectSample, virtualizer])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setSearchInput(raw)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setFilters({ search: raw }), 200)
  }, [setFilters])

  const handleToggleTag = useCallback((tagId: number) => {
    const current = filters.tagIds
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]
    setFilters({ tagIds: next })
  }, [filters.tagIds, setFilters])

  const handleBpmMin = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setBpmMinInput(raw)
    if (bpmDebounceRef.current) clearTimeout(bpmDebounceRef.current)
    bpmDebounceRef.current = setTimeout(() => {
      setFilters({ bpmMin: raw === '' ? null : Number(raw) })
    }, 300)
  }, [setFilters])

  const handleBpmMax = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setBpmMaxInput(raw)
    if (bpmDebounceRef.current) clearTimeout(bpmDebounceRef.current)
    bpmDebounceRef.current = setTimeout(() => {
      setFilters({ bpmMax: raw === '' ? null : Number(raw) })
    }, 300)
  }, [setFilters])

  const handleToggleKey = useCallback((key: string) => {
    setFilters({ keyFilter: filters.keyFilter === key ? null : key })
  }, [filters.keyFilter, setFilters])

  const handleSort = useCallback((col: SortCol) => {
    if (filters.sortBy === col) {
      if (filters.sortDir === 'asc') {
        setFilters({ sortDir: 'desc' })
      } else {
        setFilters({ sortBy: null, sortDir: 'asc' })
      }
    } else {
      setFilters({ sortBy: col, sortDir: 'asc' })
    }
  }, [filters.sortBy, filters.sortDir, setFilters])

  const cycleAnalyzedFilter = useCallback(() => {
    const next: Record<string, 'all' | 'analyzed' | 'unanalyzed'> = {
      all: 'analyzed',
      analyzed: 'unanalyzed',
      unanalyzed: 'all'
    }
    setFilters({ analyzedFilter: next[filters.analyzedFilter] })
  }, [filters.analyzedFilter, setFilters])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-[0.05em] uppercase">Sample Library</h1>
          <p className="text-text-muted text-[11px] mt-1 uppercase tracking-wider">
            {totalFilteredCount} sample{totalFilteredCount !== 1 ? 's' : ''}
            {folders.length > 0 && ` across ${folders.length} folder${folders.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const result = await window.api.sample.autoTag()
                console.log(`Auto-tagged ${result.tagged} samples`)
                fetchSamples()
                fetchTags()
              } catch (err) { console.error('Auto-tag failed:', err) }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-elevated border border-border text-text-muted hover:text-text text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            Auto-Tag
          </button>
          <button
            onClick={() => setShowDuplicates(true)}
            className="flex items-center gap-2 px-4 py-2 bg-elevated border border-border text-text-muted hover:text-text text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            Find Duplicates
          </button>
        </div>
      </div>

      {showDuplicates && <DuplicateResultsDialog onClose={() => setShowDuplicates(false)} />}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Folder browser */}
        {browserCollapsed ? (
          <button
            onClick={() => setBrowserCollapsed(false)}
            className="flex-shrink-0 w-8 border-r border-border bg-surface flex items-center justify-center hover:bg-elevated transition-colors"
            title="Show browser [ [ ]"
          >
            <svg className="w-3 h-3 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="relative flex-shrink-0">
            <SampleBrowser />
            <button
              onClick={() => setBrowserCollapsed(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 w-5 h-10 bg-elevated border border-border hover:border-accent text-text-dark hover:text-text flex items-center justify-center transition-colors"
              title="Hide browser [ [ ]"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Center panel: Sample list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Row 1 — Primary toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface">
            {/* Search input */}
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dark"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search samples… (Ctrl+F)"
                value={searchInput}
                onChange={handleSearchChange}
                className="w-full bg-transparent border-b border-transparent hover:border-border-hover focus:border-text pl-10 pr-4 py-2 text-[11px] text-text placeholder-text-dark focus:outline-none transition-all duration-200 uppercase tracking-wider"
              />
            </div>

            {/* BPM range */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-dark uppercase font-bold tracking-widest">BPM</span>
              <input
                type="number" placeholder="Min" value={bpmMinInput} onChange={handleBpmMin}
                min={1} max={300}
                className="w-14 bg-base border border-border hover:border-border-hover focus:border-text px-2 py-1 text-[11px] text-text placeholder-text-dark focus:outline-none transition-all"
              />
              <span className="text-text-dark text-[11px]">–</span>
              <input
                type="number" placeholder="Max" value={bpmMaxInput} onChange={handleBpmMax}
                min={1} max={300}
                className="w-14 bg-base border border-border hover:border-border-hover focus:border-text px-2 py-1 text-[11px] text-text placeholder-text-dark focus:outline-none transition-all"
              />
            </div>

            {/* Analyzed filter */}
            <button
              onClick={cycleAnalyzedFilter}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border ${
                filters.analyzedFilter === 'all'
                  ? 'bg-base border-border text-text-dark hover:text-text'
                  : filters.analyzedFilter === 'analyzed'
                  ? 'bg-green-900/30 text-green-400 border-green-700'
                  : 'bg-accent/10 text-accent border-accent/30'
              }`}
              title="Cycle: All → Analyzed → Unanalyzed"
            >
              {filters.analyzedFilter === 'all' ? (
                <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg> All</>
              ) : filters.analyzedFilter === 'analyzed' ? (
                <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Analyzed</>
              ) : (
                <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" /></svg> Unanalyzed</>
              )}
            </button>

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border ${
                showFilters ? 'bg-elevated border-border-hover text-text' : 'bg-base border-border text-text-dark hover:text-text'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-accent text-white text-[9px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[10px] text-accent hover:text-white font-bold uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Row 2 — Collapsible category/tag/key filters */}
          {showFilters && (
            <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-base overflow-hidden">
              {/* Category filter buttons */}
              <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilters({ category: cat === 'All' ? 'All' : cat })}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${
                      filters.category === cat
                        ? 'bg-accent text-white'
                        : 'text-text-dark hover:text-text bg-elevated hover:bg-border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Divider */}
              {tags.length > 0 && <div className="w-px h-5 bg-border flex-shrink-0" />}

              {/* Tag filter pills */}
              {tags.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                  {tags.map((tag) => {
                    const isActive = filters.tagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.id)}
                        className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold transition-all duration-200 whitespace-nowrap border ${
                          isActive
                            ? 'border-transparent text-text'
                            : 'border-border text-text-dark hover:text-text hover:border-border-hover'
                        }`}
                        style={isActive ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.6)' : tag.color }}
                        />
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Divider */}
              {uniqueKeys.length > 0 && <div className="w-px h-5 bg-border flex-shrink-0" />}

              {/* Key filter buttons */}
              {uniqueKeys.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                  <span className="text-[10px] text-text-dark uppercase font-bold tracking-widest flex-shrink-0 mr-1">Key</span>
                  {uniqueKeys.map((key) => {
                    const color = getCamelotColor(key)
                    const label = getCamelotLabel(key)
                    const isActive = filters.keyFilter === key
                    const isCompat = !filters.keyFilter || isCompatibleKey(filters.keyFilter, key)
                    return (
                      <button
                        key={key}
                        onClick={() => handleToggleKey(key)}
                        title={key}
                        className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-150 ${
                          isActive ? 'text-black scale-105' : isCompat ? 'text-white hover:opacity-90' : 'text-white opacity-30 hover:opacity-60'
                        }`}
                        style={{
                          backgroundColor: isActive ? color ?? '#888' : `${color ?? '#888'}33`,
                          borderWidth: 1, borderStyle: 'solid',
                          borderColor: isActive ? 'transparent' : `${color ?? '#888'}88`
                        }}
                      >
                        <span style={{ color: isActive ? '#000' : color ?? undefined }}>{label}</span>
                        <span className={isActive ? 'text-black opacity-70' : 'text-white opacity-70'}>{key.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                  {filters.keyFilter && (
                    <button
                      onClick={() => setFilters({ keyFilter: null })}
                      className="flex-shrink-0 ml-1 text-[10px] text-text-secondary hover:text-text transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 px-6 py-1.5 border-b border-border bg-base overflow-x-auto">
              {filters.category !== 'All' && (
                <FilterChip label={`Category: ${filters.category}`} onRemove={() => setFilters({ category: 'All' })} />
              )}
              {filters.keyFilter && (
                <FilterChip label={`Key: ${filters.keyFilter}`} onRemove={() => setFilters({ keyFilter: null })} />
              )}
              {(filters.bpmMin !== null || filters.bpmMax !== null) && (
                <FilterChip
                  label={`BPM: ${filters.bpmMin ?? '–'}–${filters.bpmMax ?? '–'}`}
                  onRemove={() => { setFilters({ bpmMin: null, bpmMax: null }); setBpmMinInput(''); setBpmMaxInput('') }}
                />
              )}
              {filters.analyzedFilter !== 'all' && (
                <FilterChip label={filters.analyzedFilter === 'analyzed' ? 'Analyzed' : 'Unanalyzed'} onRemove={() => setFilters({ analyzedFilter: 'all' })} />
              )}
              {filters.tagIds.map((tagId) => {
                const tag = tagsById.get(tagId)
                return tag ? (
                  <FilterChip key={tagId} label={`Tag: ${tag.name}`} onRemove={() => handleToggleTag(tagId)} />
                ) : null
              })}
              <button
                onClick={clearAllFilters}
                className="ml-auto text-[10px] text-accent hover:text-white font-bold uppercase tracking-widest transition-colors flex-shrink-0"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Column headers with sort */}
          <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border bg-base text-[9px] text-text-dark uppercase tracking-[0.15em] font-bold select-none">
            {/* Spacers matching SampleRow layout: checkbox(16) + drag(14) + play(32) + waveform(200) */}
            <div className="flex-shrink-0" style={{ width: 16 }} />
            <div className="flex-shrink-0" style={{ width: 14 }} />
            <div className="flex-shrink-0" style={{ width: 32 }} />
            <div className="flex-shrink-0" style={{ width: 200 }} />

            <SortHeader label="Name" col="name" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} className="flex-1 text-left" />
            {/* Spacer for fav button + category badge */}
            <div style={{ width: 14 }} />
            <SortHeader label="BPM" col="bpm" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} className="w-12 text-right" />
            <SortHeader label="Key" col="key" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} className="w-8 text-center" />
            <SortHeader label="Dur" col="duration" sortBy={filters.sortBy} sortDir={filters.sortDir} onSort={handleSort} className="w-10 text-right" />
          </div>

          {/* Sample list — VIRTUALIZED */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 py-2">
            {loading && samples.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <LoadingSpinner />
                {totalSampleCount > 0 && (
                  <p className="text-text-secondary text-[12px]">Loading {totalSampleCount} samples…</p>
                )}
              </div>
            ) : hasSamples ? (
              <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const sample = samples[virtualRow.index]
                  return (
                    <div
                      key={sample.id}
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <SampleRow
                        sample={sample}
                        isSelected={selectedSample?.id === sample.id}
                        isMultiSelected={multiSelectedIds.has(sample.id)}
                        getMultiSelectedPaths={getMultiSelectedPaths}
                        onSelect={selectSample}
                        onMultiToggle={handleMultiToggle}
                        activeKeyFilter={filters.keyFilter}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="No Samples Found"
                description={
                  hasFolders
                    ? 'No samples match your current filters. Try adjusting your search or category.'
                    : 'Add a sample folder and scan it to discover your audio files.'
                }
              />
            )}
          </div>

          {/* Status bar — bulk actions + keyboard hints (always visible) */}
          <div className="px-4 py-1.5 border-t border-border bg-base flex items-center gap-3 text-[10px] text-text-darker">
            {multiSelectedIds.size > 0 && (
              <>
                <span className="text-[11px] font-bold text-accent tabular-nums uppercase tracking-wider">
                  {multiSelectedIds.size} selected
                </span>
                <BulkTagPopover
                  tags={tags}
                  selectedIds={Array.from(multiSelectedIds)}
                  onDone={() => { clearMultiSelection(); fetchSamples() }}
                />
                <button
                  onClick={clearMultiSelection}
                  className="text-[10px] font-bold uppercase tracking-widest text-text-dark hover:text-text transition-colors"
                >
                  Clear
                </button>
                <span className="w-px h-3 bg-border" />
              </>
            )}
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">Space</kbd> play</span>
            <span><kbd className="font-mono">Esc</kbd> deselect</span>
            <span><kbd className="font-mono">Ctrl+F</kbd> search</span>
            <span><kbd className="font-mono">[ ]</kbd> panels</span>
          </div>
        </div>

        {/* Right panel: Sample detail */}
        {detailCollapsed ? (
          <button
            onClick={() => setDetailCollapsed(false)}
            className="flex-shrink-0 w-8 border-l border-border bg-surface flex items-center justify-center hover:bg-elevated transition-colors"
            title="Show details [ ] ]"
          >
            <svg className="w-3 h-3 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : selectedSample ? (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setDetailCollapsed(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-5 h-10 bg-elevated border border-border hover:border-accent text-text-dark hover:text-text flex items-center justify-center transition-colors"
              title="Hide details [ ] ]"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <SampleDetailPanel sample={selectedSample} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Bulk tag popover ────────────────────────────────────────────────────────

interface BulkTagPopoverProps {
  tags: { id: number; name: string; color: string }[]
  selectedIds: number[]
  onDone: () => void
}

function BulkTagPopover({ tags, selectedIds, onDone }: BulkTagPopoverProps) {
  const [applying, setApplying] = useState(false)

  const handleApplyTag = async (tagId: number) => {
    setApplying(true)
    try {
      await Promise.all(selectedIds.map((id) => window.api.tag.attach(tagId, 'sample', id)))
      onDone()
    } finally {
      setApplying(false)
    }
  }

  const handleRemoveTag = async (tagId: number) => {
    setApplying(true)
    try {
      await Promise.all(selectedIds.map((id) => window.api.tag.detach(tagId, 'sample', id)))
      onDone()
    } finally {
      setApplying(false)
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          disabled={applying}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          Tag All
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 bg-base border border-border p-3 w-52 shadow-2xl shadow-black/90 focus:outline-none"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-dark mb-2">
            Apply to {selectedIds.length} sample{selectedIds.length !== 1 ? 's' : ''}
          </p>
          {tags.length === 0 ? (
            <p className="text-[11px] text-text-dark py-2">No tags yet — create tags in the detail panel.</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handleApplyTag(tag.id)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-elevated text-left transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="text-[11px] text-text">{tag.name}</span>
                  </button>
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-[#282828] transition-colors"
                    title="Remove this tag from all selected"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Sort header button ──────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string
  col: SortCol
  sortBy: SortCol | null
  sortDir: 'asc' | 'desc'
  onSort: (col: SortCol) => void
  className?: string
}

function SortHeader({ label, col, sortBy, sortDir, onSort, className = '' }: SortHeaderProps) {
  const isActive = sortBy === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 hover:text-text transition-colors ${isActive ? 'text-text' : ''} ${className}`}
    >
      {label}
      <span className="ml-0.5 flex flex-col leading-none" style={{ fontSize: 7 }}>
        <span className={isActive && sortDir === 'asc' ? 'text-accent' : ''}>▲</span>
        <span className={isActive && sortDir === 'desc' ? 'text-accent' : ''}>▼</span>
      </span>
    </button>
  )
}

// ── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-elevated border border-border text-[10px] text-text uppercase tracking-wider whitespace-nowrap">
      {label}
      <button onClick={onRemove} className="ml-1 text-text-dark hover:text-accent transition-colors">&times;</button>
    </span>
  )
}
