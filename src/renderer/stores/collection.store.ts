import { create } from 'zustand'

export interface Collection {
  id: number
  name: string
  type: 'album' | 'ep' | 'single' | 'playlist'
  description: string | null
  artwork_path: string | null
  color: string
  created_at: number
  updated_at: number
  item_count: number
}

export interface CollectionItem {
  id: number
  collection_id: number
  project_id: number
  sort_order: number
  notes: string | null
  title: string
  bpm: number | null
  musical_key: string | null
  track_count: number | null
  time_signature: string | null
  stage: string
  color: string | null
  group_key: string
  daw_file_name: string | null
  plugin_count: number
}

export interface CollectionSuggestion {
  project_id: number
  title: string
  bpm: number | null
  musical_key: string | null
  stage: string
  reason: string
  score: number
}

interface CollectionStore {
  collections: Collection[]
  loading: boolean
  selectedCollectionId: number | null
  items: CollectionItem[]
  itemsLoading: boolean
  suggestions: CollectionSuggestion[]
  suggestionsLoading: boolean

  fetchCollections: () => Promise<void>
  createCollection: (data: { name: string; type: string; description?: string; color?: string }) => Promise<Collection>
  updateCollection: (id: number, changes: Record<string, any>) => Promise<void>
  deleteCollection: (id: number) => Promise<void>
  selectCollection: (id: number | null) => void

  fetchItems: (collectionId: number) => Promise<void>
  addItem: (collectionId: number, projectId: number) => Promise<void>
  removeItem: (collectionId: number, projectId: number) => Promise<void>
  reorderItems: (collectionId: number, orderedProjectIds: number[]) => Promise<void>

  fetchSuggestions: (collectionId: number) => Promise<void>
  setArtwork: (collectionId: number) => Promise<string | null>
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  loading: false,
  selectedCollectionId: null,
  items: [],
  itemsLoading: false,
  suggestions: [],
  suggestionsLoading: false,

  fetchCollections: async () => {
    set({ loading: true })
    try {
      const collections = await window.api.collection.list()
      set({ collections })
    } finally {
      set({ loading: false })
    }
  },

  createCollection: async (data) => {
    const collection = await window.api.collection.create(data)
    set(s => ({ collections: [collection, ...s.collections] }))
    return collection
  },

  updateCollection: async (id, changes) => {
    await window.api.collection.update(id, changes)
    set(s => ({
      collections: s.collections.map(c =>
        c.id === id ? { ...c, ...changes, updated_at: Date.now() / 1000 } : c
      )
    }))
  },

  deleteCollection: async (id) => {
    await window.api.collection.delete(id)
    set(s => ({
      collections: s.collections.filter(c => c.id !== id),
      selectedCollectionId: s.selectedCollectionId === id ? null : s.selectedCollectionId,
      items: s.selectedCollectionId === id ? [] : s.items,
      suggestions: s.selectedCollectionId === id ? [] : s.suggestions
    }))
  },

  selectCollection: (id) => {
    set({ selectedCollectionId: id, items: [], suggestions: [] })
    if (id !== null) {
      get().fetchItems(id)
      get().fetchSuggestions(id)
    }
  },

  fetchItems: async (collectionId) => {
    set({ itemsLoading: true })
    try {
      const items = await window.api.collection.getItems(collectionId)
      set({ items })
    } finally {
      set({ itemsLoading: false })
    }
  },

  addItem: async (collectionId, projectId) => {
    await window.api.collection.addItem(collectionId, projectId)
    await get().fetchItems(collectionId)
    await get().fetchSuggestions(collectionId)
    set(s => ({
      collections: s.collections.map(c =>
        c.id === collectionId ? { ...c, item_count: c.item_count + 1 } : c
      )
    }))
  },

  removeItem: async (collectionId, projectId) => {
    set(s => ({ items: s.items.filter(i => i.project_id !== projectId) }))
    await window.api.collection.removeItem(collectionId, projectId)
    await get().fetchSuggestions(collectionId)
    set(s => ({
      collections: s.collections.map(c =>
        c.id === collectionId ? { ...c, item_count: Math.max(0, c.item_count - 1) } : c
      )
    }))
  },

  reorderItems: async (collectionId, orderedProjectIds) => {
    set(s => {
      const reordered = orderedProjectIds.map((pid, i) => {
        const item = s.items.find(it => it.project_id === pid)!
        return { ...item, sort_order: i }
      }).filter(Boolean)
      return { items: reordered }
    })
    await window.api.collection.reorderItems(collectionId, orderedProjectIds)
  },

  fetchSuggestions: async (collectionId) => {
    set({ suggestionsLoading: true })
    try {
      const suggestions = await window.api.collection.getSuggestions(collectionId)
      set({ suggestions })
    } finally {
      set({ suggestionsLoading: false })
    }
  },

  setArtwork: async (collectionId) => {
    const path = await window.api.collection.setArtwork(collectionId)
    if (path) {
      set(s => ({
        collections: s.collections.map(c =>
          c.id === collectionId ? { ...c, artwork_path: path } : c
        )
      }))
    }
    return path
  }
}))
