import { create } from 'zustand'

export interface Daw {
  id: number
  name: string
  executable_path: string
  version: string | null
  icon_name: string | null
  icon_data: string | null
  project_extension: string
  project_folders: string
  created_at: number
  updated_at: number
}

export interface DawProject {
  id: number
  daw_id: number
  file_path: string
  file_name: string
  file_size: number | null
  last_modified: number | null
  created_at: number
}

interface DawStore {
  daws: Daw[]
  projects: Record<number, DawProject[]>
  loading: boolean
  fetchDaws: () => Promise<void>
  fetchProjects: (dawId: number) => Promise<void>
  registerDaw: (data: {
    name: string
    executablePath: string
    projectExtension: string
    projectFolders: string[]
  }) => Promise<void>
  launchDaw: (dawId: number) => Promise<void>
  scanProjects: (dawId: number) => Promise<void>
  deleteDaw: (dawId: number) => Promise<void>
  refreshIcon: (dawId: number) => Promise<void>
}

export const useDawStore = create<DawStore>((set, get) => ({
  daws: [],
  projects: {},
  loading: false,

  fetchDaws: async () => {
    set({ loading: true })
    try {
      const daws = await window.api.daw.list()
      set({ daws })
    } finally {
      set({ loading: false })
    }
  },

  fetchProjects: async (dawId: number) => {
    const projects = await window.api.daw.getProjects(dawId)
    set((state) => ({
      projects: { ...state.projects, [dawId]: projects }
    }))
  },

  registerDaw: async (data) => {
    set({ loading: true })
    try {
      await window.api.daw.register(data)
      await get().fetchDaws()
    } finally {
      set({ loading: false })
    }
  },

  launchDaw: async (dawId: number) => {
    await window.api.daw.launch(dawId)
  },

  scanProjects: async (dawId: number) => {
    const projects = await window.api.daw.scanProjects(dawId)
    set((state) => ({
      projects: { ...state.projects, [dawId]: projects }
    }))
  },

  deleteDaw: async (dawId: number) => {
    await window.api.daw.delete(dawId)
    set((state) => ({
      daws: state.daws.filter((d) => d.id !== dawId),
      projects: Object.fromEntries(
        Object.entries(state.projects).filter(([key]) => Number(key) !== dawId)
      )
    }))
  },

  refreshIcon: async (dawId: number) => {
    const iconData = await window.api.daw.refreshIcon(dawId)
    if (iconData) {
      set((state) => ({
        daws: state.daws.map((d) =>
          d.id === dawId ? { ...d, icon_data: iconData } : d
        )
      }))
    }
  }
}))
