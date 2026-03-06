import { create } from 'zustand'
import type { DiscoverData } from '../../main/services/recommendations.service'

interface DiscoverStore {
  data: DiscoverData | null
  loading: boolean
  fetchData: () => Promise<void>
}

export const useDiscoverStore = create<DiscoverStore>((set) => ({
  data: null,
  loading: false,
  fetchData: async () => {
    set({ loading: true })
    try {
      const data = await window.api.discover.getData()
      set({ data, loading: false })
    } catch (err) {
      console.error('Failed to fetch discover data:', err)
      set({ loading: false })
    }
  }
}))
