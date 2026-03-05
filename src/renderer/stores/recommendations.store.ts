import { create } from 'zustand'

interface VstPlugin {
  id: number
  plugin_name: string
  vendor: string | null
  category: string | null
  subcategory: string | null
  format: string
  file_path: string
  is_favorite: number
  icon_url: string | null
  website: string | null
}

interface RecommendationsStore {
  unexploredCategories: { category: string; count: number }[]
  trySomethingNew: VstPlugin[]
  similarToFavorites: VstPlugin[]
  recentlyAdded: VstPlugin[]
  loading: boolean
  fetchRecommendations: () => Promise<void>
}

export const useRecommendationsStore = create<RecommendationsStore>((set) => ({
  unexploredCategories: [],
  trySomethingNew: [],
  similarToFavorites: [],
  recentlyAdded: [],
  loading: false,
  fetchRecommendations: async () => {
    set({ loading: true })
    try {
      const data = await window.api.recommendations.getVst()
      set({
        unexploredCategories: data.unexploredCategories,
        trySomethingNew: data.trySomethingNew,
        similarToFavorites: data.similarToFavorites,
        recentlyAdded: data.recentlyAdded,
        loading: false
      })
    } catch (err) {
      console.error('Failed to fetch recommendations:', err)
      set({ loading: false })
    }
  }
}))
