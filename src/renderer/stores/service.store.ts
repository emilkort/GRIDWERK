import { create } from 'zustand'

export interface ServiceConnection {
  id: number
  service: 'splice' | 'tracklib'
  enabled: number
  local_folder: string | null
  metadata_db_path: string | null
  last_synced: number | null
  config: string | null
}

interface ServiceStore {
  connections: ServiceConnection[]
  syncing: string | null
  fetchConnections: () => Promise<void>
  updateConnection: (service: string, changes: Record<string, any>) => Promise<void>
  detectSplice: () => Promise<{ found: boolean; folderPath: string | null; dbPath: string | null }>
  detectTracklib: () => Promise<{ found: boolean; folderPath: string | null }>
  syncSplice: () => Promise<{ synced: number }>
  syncTracklib: () => Promise<{ synced: number }>
}

export const useServiceStore = create<ServiceStore>((set, get) => ({
  connections: [],
  syncing: null,

  fetchConnections: async () => {
    const connections = await window.api.service.listConnections()
    set({ connections })
  },

  updateConnection: async (service, changes) => {
    await window.api.service.updateConnection(service, changes)
    await get().fetchConnections()
  },

  detectSplice: async () => {
    return window.api.service.detectSplice()
  },

  detectTracklib: async () => {
    return window.api.service.detectTracklib()
  },

  syncSplice: async () => {
    set({ syncing: 'splice' })
    try {
      const result = await window.api.service.syncSplice()
      await get().fetchConnections()
      return result
    } finally {
      set({ syncing: null })
    }
  },

  syncTracklib: async () => {
    set({ syncing: 'tracklib' })
    try {
      const result = await window.api.service.syncTracklib()
      await get().fetchConnections()
      return result
    } finally {
      set({ syncing: null })
    }
  }
}))
