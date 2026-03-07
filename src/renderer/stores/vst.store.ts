import { create } from 'zustand'

export interface VstPlugin {
  id: number
  scan_path_id: number | null
  file_path: string
  plugin_name: string
  format: 'VST2' | 'VST3'
  vendor: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  icon_url: string | null
  website: string | null
  enriched: number
  is_favorite: number
  is_hidden: number
  file_size: number | null
  last_modified: number | null
  created_at: number
  updated_at: number
}

export interface VstScanPath {
  id: number
  folder_path: string
  format: 'VST2' | 'VST3'
  enabled: number
}

export type VstGroupBy = 'none' | 'vendor' | 'category' | 'format'

interface VstFilters {
  category: string
  subcategory: string
  favorite: boolean
  search: string
  vendor: string
  groupBy: VstGroupBy
}

interface VstStore {
  plugins: VstPlugin[]
  scanPaths: VstScanPath[]
  filters: VstFilters
  selectedPlugin: VstPlugin | null
  loading: boolean
  scanning: boolean
  enriching: boolean
  enrichProgress: { current: number; total: number; currentFile: string } | null
  syncingLibrary: boolean
  fetchPlugins: () => Promise<void>
  fetchScanPaths: () => Promise<void>
  addScanPath: (folderPath: string, format: 'VST2' | 'VST3') => Promise<void>
  deleteScanPath: (scanPathId: number) => Promise<void>
  scan: (scanPathId: number) => Promise<void>
  toggleFavorite: (pluginId: number) => Promise<void>
  setFilters: (filters: Partial<VstFilters>) => void
  enrichAll: () => Promise<void>
  syncReferenceLibrary: () => Promise<void>
  selectPlugin: (plugin: VstPlugin | null) => void
  enrichSingle: (pluginId: number) => Promise<void>
  hidePlugin: (pluginIds: number[]) => Promise<void>
  hiddenPlugins: VstPlugin[]
  hiddenLoading: boolean
  fetchHiddenPlugins: () => Promise<void>
  unhidePlugin: (pluginId: number) => Promise<void>
}

export const useVstStore = create<VstStore>((set, get) => {
  // Auto-refresh plugin list when the watcher detects changes on disk
  // Guard against duplicate registration during HMR reloads
  if (typeof window !== 'undefined' && window.api?.on?.vstPluginChanged && !(window as any).__vstListenersRegistered) {
    (window as any).__vstListenersRegistered = true
    window.api.on.vstPluginChanged(() => {
      get().fetchPlugins()
    })
  }

  return {
  plugins: [],
  scanPaths: [],
  filters: {
    category: 'All',
    subcategory: 'All',
    favorite: false,
    search: '',
    vendor: '',
    groupBy: 'vendor' as VstGroupBy
  },
  selectedPlugin: null,
  loading: false,
  scanning: false,
  enriching: false,
  enrichProgress: null,
  syncingLibrary: false,

  fetchPlugins: async () => {
    set({ loading: true })
    try {
      const { category, subcategory, favorite, search } = get().filters
      const plugins = await window.api.vst.list({
        category: category !== 'All' ? category : undefined,
        subcategory: subcategory !== 'All' ? subcategory : undefined,
        favorite: favorite || undefined,
        search: search || undefined
      })
      set({ plugins })
    } finally {
      set({ loading: false })
    }
  },

  fetchScanPaths: async () => {
    const scanPaths = await window.api.vst.listScanPaths()
    set({ scanPaths })
  },

  addScanPath: async (folderPath: string, format: 'VST2' | 'VST3') => {
    await window.api.vst.addScanPath({ folderPath, format })
    await get().fetchScanPaths()
  },

  deleteScanPath: async (scanPathId: number) => {
    await window.api.vst.deleteScanPath(scanPathId)
    await get().fetchScanPaths()
  },

  scan: async (scanPathId: number) => {
    set({ scanning: true })
    try {
      await window.api.vst.scan(scanPathId)
      await get().fetchPlugins()
    } finally {
      set({ scanning: false })
    }
  },

  toggleFavorite: async (pluginId: number) => {
    await window.api.vst.toggleFavorite(pluginId)
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === pluginId ? { ...p, is_favorite: p.is_favorite ? 0 : 1 } : p
      )
    }))
  },

  setFilters: (newFilters: Partial<VstFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }))
    get().fetchPlugins()
  },

  enrichAll: async () => {
    set({ enriching: true, enrichProgress: { current: 0, total: 0, currentFile: '' } })
    try {
      await window.api.vst.enrichAll()
      await get().fetchPlugins()
    } finally {
      set({ enriching: false, enrichProgress: null })
    }
  },

  syncReferenceLibrary: async () => {
    set({ syncingLibrary: true })
    try {
      const result = await window.api.vst.syncReferenceLibrary()
      console.log(`Reference library synced: ${result.total} plugins`)
    } finally {
      set({ syncingLibrary: false })
    }
  },

  selectPlugin: (plugin: VstPlugin | null) => {
    set({ selectedPlugin: plugin })
  },

  enrichSingle: async (pluginId: number) => {
    await window.api.vst.enrichSingle(pluginId)
    // Refresh plugin list and update selected plugin
    await get().fetchPlugins()
    const updated = get().plugins.find((p) => p.id === pluginId)
    if (updated) set({ selectedPlugin: updated })
  },

  hidePlugin: async (pluginIds: number[]) => {
    for (const id of pluginIds) {
      await window.api.vst.setHidden(id, true)
    }
    // Remove from local state immediately
    set((state) => ({
      plugins: state.plugins.filter((p) => !pluginIds.includes(p.id)),
      selectedPlugin: state.selectedPlugin && pluginIds.includes(state.selectedPlugin.id)
        ? null
        : state.selectedPlugin
    }))
  },

  hiddenPlugins: [],
  hiddenLoading: false,

  fetchHiddenPlugins: async () => {
    set({ hiddenLoading: true })
    try {
      const hiddenPlugins = await window.api.vst.listHidden()
      set({ hiddenPlugins })
    } finally {
      set({ hiddenLoading: false })
    }
  },

  unhidePlugin: async (pluginId: number) => {
    await window.api.vst.setHidden(pluginId, false)
    set((state) => ({
      hiddenPlugins: state.hiddenPlugins.filter((p) => p.id !== pluginId)
    }))
    // Refresh main list so the unhidden plugin appears
    await get().fetchPlugins()
  }
}})
