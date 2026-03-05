import { create } from 'zustand'

export interface Stage {
  id: number
  name: string
  slug: string
  color: string
  sort_order: number
}

interface StageStore {
  stages: Stage[]
  loaded: boolean
  fetchStages: () => Promise<void>
  createStage: (data: { name: string; color: string }) => Promise<Stage>
  updateStage: (id: number, changes: { name?: string; color?: string; sort_order?: number }) => Promise<void>
  deleteStage: (id: number) => Promise<{ ok: boolean; error?: string }>
  reorderStages: (orderedIds: number[]) => Promise<void>
}

export const useStageStore = create<StageStore>((set, get) => ({
  stages: [],
  loaded: false,

  fetchStages: async () => {
    try {
      const stages = await window.api.stage.list() as Stage[]
      set({ stages, loaded: true })
    } catch {
      // Fallback to defaults if IPC not ready (pre-restart)
      set({
        stages: [
          { id: 1, name: 'Idea',        slug: 'idea',        color: '#3b82f6', sort_order: 0 },
          { id: 2, name: 'In Progress', slug: 'in_progress', color: '#f97316', sort_order: 1 },
          { id: 3, name: 'Mixing',      slug: 'mixing',      color: '#8b5cf6', sort_order: 2 },
          { id: 4, name: 'Done',        slug: 'done',        color: '#22c55e', sort_order: 3 }
        ],
        loaded: true
      })
    }
  },

  createStage: async (data) => {
    const stage = await window.api.stage.create(data) as Stage
    set((s) => ({
      stages: [...s.stages, stage].sort((a, b) => a.sort_order - b.sort_order)
    }))
    return stage
  },

  updateStage: async (id, changes) => {
    const updated = await window.api.stage.update(id, changes) as Stage
    set((s) => ({
      stages: s.stages.map((st) => (st.id === id ? updated : st))
        .sort((a, b) => a.sort_order - b.sort_order)
    }))
  },

  deleteStage: async (id) => {
    const result = await window.api.stage.delete(id) as { ok: boolean; error?: string }
    if (result.ok) {
      set((s) => ({ stages: s.stages.filter((st) => st.id !== id) }))
    }
    return result
  },

  reorderStages: async (orderedIds) => {
    await window.api.stage.reorder(orderedIds)
    const current = get().stages
    const reordered = orderedIds
      .map((id, i) => {
        const st = current.find((s) => s.id === id)
        return st ? { ...st, sort_order: i } : null
      })
      .filter(Boolean) as Stage[]
    set({ stages: reordered })
  }
}))
