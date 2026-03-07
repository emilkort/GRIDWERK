import { create } from 'zustand'

export type Page = 'daw-hub' | 'vst-manager' | 'sample-library' | 'project-tracker' | 'organiser' | 'analytics' | 'recommendations' | 'settings'
export type Theme = 'dark' | 'light'

interface UiStore {
  currentPage: Page
  searchQuery: string
  searchOpen: boolean
  theme: Theme
  setPage: (page: Page) => void
  setSearchQuery: (query: string) => void
  setSearchOpen: (open: boolean) => void
  toggleTheme: () => void
}

function getInitialTheme(): Theme {
  try {
    return (localStorage.getItem('gridwerk-theme') as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

export const useUiStore = create<UiStore>((set) => ({
  currentPage: 'daw-hub',
  searchQuery: '',
  searchOpen: false,
  theme: getInitialTheme(),
  setPage: (page) => set({ currentPage: page }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('gridwerk-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),
}))
