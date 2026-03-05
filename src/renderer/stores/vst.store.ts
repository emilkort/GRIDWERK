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

interface VstFilters {
  category: string
  subcategory: string
  favorite: boolean
  search: string
}

interface VstStore {
  plugins: VstPlugin[]
  scanPaths: VstScanPath[]
  filters: VstFilters
  loading: boolean
  scanning: boolean
  enriching: boolean
  enrichProgress: { current: number; total: number; currentFile: string } | null
  fetchPlugins: () => Promise<void>
  fetchScanPaths: () => Promise<void>
  addScanPath: (folderPath: string, format: 'VST2' | 'VST3') => Promise<void>
  deleteScanPath: (scanPathId: number) => Promise<void>
  scan: (scanPathId: number) => Promise<void>
  toggleFavorite: (pluginId: number) => Promise<void>
  setFilters: (filters: Partial<VstFilters>) => void
  enrichAll: () => Promise<void>
}

export const useVstStore = create<VstStore>((set, get) => ({
  plugins: [],
  scanPaths: [],
  filters: {
    category: 'All',
    subcategory: 'All',
    favorite: false,
    search: ''
  },
  loading: false,
  scanning: false,
  enriching: false,
  enrichProgress: null,

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
  }
}))
