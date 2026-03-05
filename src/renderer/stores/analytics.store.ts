import { create } from 'zustand'

export interface AnalyticsData {
  totals: {
    samples: number
    projects: number
    vsts: number
    analyzedPercent: number
  }
  projectsByStage: { stage: string; count: number }[]
  projectsPerMonth: { month: string; count: number }[]
  dawUsage: { name: string; count: number }[]
  samplesByCategory: { category: string; count: number }[]
  samplesByKey: { key: string; count: number }[]
  samplesByBpmRange: { range: string; count: number }[]
  topTags: { name: string; color: string; count: number }[]
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
