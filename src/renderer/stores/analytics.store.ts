import { create } from 'zustand'

export interface AnalyticsData {
  totals: {
    samples: number
    projects: number
    songs: number
    vsts: number
    analyzedPercent: number
    vstEnrichedPercent: number
    favoriteSamples: number
    favoriteVsts: number
    totalDiskMb: number
  }
  projectsByStage: { stage: string; count: number }[]
  projectsPerMonth: { month: string; count: number }[]
  dawUsage: { name: string; count: number }[]
  samplesByCategory: { category: string; count: number }[]
  samplesByKey: { key: string; count: number }[]
  samplesByBpmRange: { range: string; count: number }[]
  topTags: { name: string; color: string; count: number }[]
  vstsByFormat: { format: string; count: number }[]
  vstsByVendor: { vendor: string; count: number }[]
  vstsByCategory: { category: string; count: number }[]
  recentVsts: { plugin_name: string; vendor: string | null; category: string | null; icon_url: string | null }[]
  completionRate: number
  avgVersionsPerSong: number
  mostProductiveDay: { day: string; count: number } | null
  topSampleFormats: { format: string; count: number }[]
  recentProjects: { title: string; stage: string; created_at: number }[]
}

interface AnalyticsStore {
  data: AnalyticsData | null
  loading: boolean
  fetchData: () => Promise<void>
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  data: null,
  loading: false,
  fetchData: async () => {
    set({ loading: true })
    try {
      const data = await window.api.analytics.getData()
      set({ data, loading: false })
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      set({ loading: false })
    }
  }
}))
