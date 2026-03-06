import { create } from 'zustand'
import { LruMap } from '@/utils/lru'

export interface Sample {
  id: number
  folder_id: number | null
  file_path: string
  file_name: string
  file_extension: string
  file_size: number | null
  duration_ms: number | null
  sample_rate: number | null
  channels: number | null
  bit_depth: number | null
  bpm: number | null
  bpm_confidence: number | null
  musical_key: string | null
  key_confidence: number | null
  category: string | null
  waveform_data: any
  has_waveform: number
  is_favorite: number
  spectral_centroid: number | null
  spectral_flatness: number | null
  zero_crossing_rate: number | null
  attack_time_ms: number | null
  onset_count: number | null
  last_modified: number | null
  created_at: number
  updated_at: number
}

export interface SampleFolder {
  id: number
  folder_path: string
  label: string | null
  is_watched: number
  created_at: number
}

interface SampleFilters {
  folderId: number | null
  category: string
  search: string
  subfolderPath: string | null
  tagIds: number[]
  sortBy: 'name' | 'bpm' | 'key' | 'duration' | null
  sortDir: 'asc' | 'desc'
  bpmMin: number | null
  bpmMax: number | null
  keyFilter: string | null
  isFavorites: boolean
  analyzedFilter: 'all' | 'analyzed' | 'unanalyzed'
}

export interface Tag {
  id: number
  name: string
  color: string
  is_auto: number
  created_at: number
}

export interface SubfolderEntry {
  subPath: string
  count: number
}

interface SampleStore {
  samples: Sample[]
  totalSampleCount: number
  totalFilteredCount: number
  hasMore: boolean
  folders: SampleFolder[]
  selectedSample: Sample | null
  filters: SampleFilters
  loading: boolean
  scanning: boolean
  analyzing: boolean
  analysisProgress: { current: number; total: number; currentFile: string } | null
  completionMsg: string | null
  subfolderTree: SubfolderEntry[]
  tags: Tag[]
  fetchFolders: () => Promise<void>
  fetchSamples: () => Promise<void>
  fetchMoreSamples: () => Promise<void>
  fetchTotalCount: () => Promise<void>
  fetchSubfolderTree: (folderId: number) => Promise<void>
  fetchTags: () => Promise<void>
  addFolder: (folderPath: string, label?: string) => Promise<void>
  deleteFolder: (folderId: number) => Promise<void>
  scanFolder: (folderId: number) => Promise<void>
  selectSample: (sample: Sample | null) => void
  setFilters: (filters: Partial<SampleFilters>) => void
  analyzeSample: (sampleId: number) => Promise<void>
  analyzeFolder: (folderId: number) => Promise<void>
  setAnalysisProgress: (progress: { current: number; total: number; currentFile: string } | null) => void
  toggleFavorite: (sampleId: number) => Promise<void>
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// ── Bounded LRU cache — keyed by serialized filter state ──────────────────
// Stale-while-revalidate: instant results on repeat visits; max 50 entries.

const PAGE_SIZE = 100
const CACHE_TTL = 2000 // 2 seconds — skip IPC if cache is fresh

let _sampleCache = new LruMap<string, { samples: Sample[]; total: number; ts: number }>(50)

export const useSampleStore = create<SampleStore>((set, get) => ({
  samples: [],
  totalSampleCount: 0,
  totalFilteredCount: 0,
  hasMore: false,
  folders: [],
  selectedSample: null,
  filters: {
    folderId: null,
    category: 'All',
    search: '',
    subfolderPath: null,
    tagIds: [],
    sortBy: null,
    sortDir: 'asc',
    bpmMin: null,
    bpmMax: null,
    keyFilter: null,
    isFavorites: false,
    analyzedFilter: 'all'
  },
  loading: true, // start true so spinner shows immediately on first render
  scanning: false,
  analyzing: false,
  analysisProgress: null,
  completionMsg: null,
  subfolderTree: [],
  tags: [],

  fetchFolders: async () => {
    const folders = await window.api.sample.listFolders()
    set({ folders })
  },

  fetchTotalCount: async () => {
    const count = await window.api.sample.getTotalCount()
    set({ totalSampleCount: count })
  },

  fetchSamples: async () => {
    const { folderId, category, search, subfolderPath, tagIds, sortBy, sortDir, bpmMin, bpmMax, keyFilter, isFavorites, analyzedFilter } = get().filters
    const cacheKey = JSON.stringify({ folderId, category, search, subfolderPath, tagIds, sortBy, sortDir, bpmMin, bpmMax, keyFilter, isFavorites, analyzedFilter })

    const cached = _sampleCache.get(cacheKey)
    if (cached) {
      set({ samples: cached.samples, totalFilteredCount: cached.total, hasMore: cached.samples.length < cached.total, loading: false })
      // Skip IPC entirely if cache is fresh
      if (Date.now() - cached.ts < CACHE_TTL) return
    } else {
      set({ loading: true })
    }

    const filterParams = {
      folderId: folderId ?? undefined,
      category: category !== 'All' ? category : undefined,
      search: search || undefined,
      subfolderPath: subfolderPath ?? undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      sortBy: sortBy ?? undefined,
      sortDir,
      bpmMin: bpmMin ?? undefined,
      bpmMax: bpmMax ?? undefined,
      key: keyFilter ?? undefined,
      isFavorites: isFavorites || undefined,
      analyzedFilter: analyzedFilter !== 'all' ? analyzedFilter : undefined
    }

    try {
      const raw = await window.api.sample.list({ ...filterParams, limit: PAGE_SIZE, offset: 0 })
      // Handle both new { samples, total } and legacy Sample[] return shapes
      const result: { samples: Sample[]; total: number } = Array.isArray(raw)
        ? { samples: raw, total: raw.length }
        : raw as { samples: Sample[]; total: number }
      _sampleCache.set(cacheKey, { ...result, ts: Date.now() })
      set({ samples: result.samples, totalFilteredCount: result.total, hasMore: result.samples.length < result.total, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchMoreSamples: async () => {
    const { samples, totalFilteredCount, hasMore, filters } = get()
    if (!hasMore || samples.length >= totalFilteredCount) return

    const { folderId, category, search, subfolderPath, tagIds, sortBy, sortDir, bpmMin, bpmMax, keyFilter, isFavorites, analyzedFilter } = filters
    try {
      const raw = await window.api.sample.list({
        folderId: folderId ?? undefined,
        category: category !== 'All' ? category : undefined,
        search: search || undefined,
        subfolderPath: subfolderPath ?? undefined,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        sortBy: sortBy ?? undefined,
        sortDir,
        bpmMin: bpmMin ?? undefined,
        bpmMax: bpmMax ?? undefined,
        key: keyFilter ?? undefined,
        isFavorites: isFavorites || undefined,
        analyzedFilter: analyzedFilter !== 'all' ? analyzedFilter : undefined,
        limit: PAGE_SIZE,
        offset: samples.length,
        skipCount: true
      })
      const result: { samples: Sample[]; total: number } = Array.isArray(raw)
        ? { samples: raw, total: raw.length }
        : raw as { samples: Sample[]; total: number }
      const merged = [...samples, ...result.samples]
      // When skipCount is true, total comes back as -1; keep existing totalFilteredCount
      const total = result.total >= 0 ? result.total : totalFilteredCount
      set({ samples: merged, totalFilteredCount: total, hasMore: merged.length < total })

      // Update cache with accumulated result
      const cacheKey = JSON.stringify({ folderId, category, search, subfolderPath, tagIds, sortBy, sortDir, bpmMin, bpmMax, keyFilter, isFavorites, analyzedFilter })
      _sampleCache.set(cacheKey, { samples: merged, total: result.total, ts: Date.now() })
    } catch { /* ignore */ }
  },

  fetchSubfolderTree: async (folderId: number) => {
    const tree = await window.api.sample.getSubfolderTree(folderId)
    set({ subfolderTree: tree })
  },

  fetchTags: async () => {
    const tags = await window.api.tag.list()
    set({ tags })
  },

  addFolder: async (folderPath: string, label?: string) => {
    await window.api.sample.addFolder({ folderPath, label })
    await get().fetchFolders()
  },

  deleteFolder: async (folderId: number) => {
    _sampleCache.clear()
    await window.api.sample.deleteFolder(folderId)
    const { selectedSample, filters } = get()
    if (selectedSample && selectedSample.folder_id === folderId) {
      set({ selectedSample: null })
    }
    if (filters.folderId === folderId) {
      set((state) => ({
        filters: { ...state.filters, folderId: null }
      }))
    }
    await get().fetchFolders()
    await get().fetchSamples()
    await get().fetchTotalCount()
  },

  scanFolder: async (folderId: number) => {
    set({ scanning: true })
    try {
      _sampleCache.clear()
      await window.api.sample.scanFolder(folderId)
      await get().fetchSamples()
      await get().fetchTotalCount()
      if (get().filters.folderId === folderId) {
        await get().fetchSubfolderTree(folderId)
      }
    } finally {
      set({ scanning: false })
    }
  },

  selectSample: (sample: Sample | null) => {
    set({ selectedSample: sample })
  },

  setFilters: (newFilters: Partial<SampleFilters>) => {
    // isFavorites=true clears folder context
    if (newFilters.isFavorites) {
      newFilters = { ...newFilters, folderId: null, subfolderPath: null }
    }
    // Switching folders clears subfolder + favorites, refreshes subfolder tree
    if ('folderId' in newFilters && newFilters.folderId !== get().filters.folderId) {
      set((state) => ({
        filters: { ...state.filters, ...newFilters, subfolderPath: null, isFavorites: false },
        subfolderTree: []
      }))
      if (newFilters.folderId != null) {
        get().fetchSubfolderTree(newFilters.folderId)
      }
    } else {
      set((state) => ({
        filters: { ...state.filters, ...newFilters }
      }))
    }
    // Debounce search input (300ms); fire immediately for all other filters
    if ('search' in newFilters) {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        get().fetchSamples()
      }, 300)
    } else {
      get().fetchSamples()
    }
  },

  analyzeSample: async (sampleId: number) => {
    await window.api.sample.analyze(sampleId)
    _sampleCache.clear()
    await get().fetchSamples()
  },

  analyzeFolder: async (folderId: number) => {
    set({ analyzing: true, analysisProgress: null })
    try {
      await window.api.sample.analyzeFolder(folderId)
      await get().fetchSamples()
    } finally {
      set({ analyzing: false, analysisProgress: null })
    }
  },

  setAnalysisProgress: (progress) => {
    set({ analysisProgress: progress })
  },

  toggleFavorite: async (sampleId: number) => {
    // Optimistic update — instant UI feedback
    const flip = (s: Sample) =>
      s.id === sampleId ? { ...s, is_favorite: s.is_favorite ? 0 : 1 } : s

    set((state) => ({
      samples: state.samples.map(flip),
      selectedSample: state.selectedSample ? flip(state.selectedSample) : null
    }))

    // Patch all cache entries in-place (no clear + refetch)
    _sampleCache.forEach((entry) => {
      entry.samples = entry.samples.map(flip)
    })

    try {
      await window.api.sample.toggleFavorite(sampleId)
      // Only refetch when viewing favorites filter (item should appear/disappear)
      if (get().filters.isFavorites) {
        _sampleCache.clear()
        get().fetchSamples()
      }
    } catch {
      // Revert on failure
      _sampleCache.clear()
      await get().fetchSamples()
    }
  }
}))

// Module-level IPC listeners — persist across page navigation (never cleaned up)
window.api.on.analysisProgress((data) => {
  useSampleStore.getState().setAnalysisProgress({
    current: data.current,
    total: data.total,
    currentFile: data.currentFile
  })
})
window.api.on.analysisComplete((data) => {
  _sampleCache.clear()
  useSampleStore.getState().fetchSamples()
  useSampleStore.getState().fetchTotalCount()
  if (data.total > 0) {
    useSampleStore.setState({
      analyzing: false,
      analysisProgress: null,
      completionMsg: `Analyzed ${data.successCount}/${data.total} samples`
    })
    setTimeout(() => {
      useSampleStore.setState({ completionMsg: null })
    }, 4000)
  } else {
    useSampleStore.setState({ analyzing: false, analysisProgress: null })
  }
})
