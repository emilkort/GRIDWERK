import { create } from 'zustand'

export interface ProjectTag {
  id: number
  name: string
  color: string
}

export interface Project {
  id: number
  title: string
  description: string | null
  stage: 'idea' | 'in_progress' | 'mixing' | 'done'
  sort_order: number
  bpm: number | null
  musical_key: string | null
  daw_project_id: number | null
  color: string | null
  priority: 'urgent' | 'high' | 'normal' | 'low'
  created_at: number
  updated_at: number
  group_key: string
  todo_count: number
  done_count: number
  daw_file_name: string | null
  daw_last_modified: number | null
  daw_name: string | null
  tags: ProjectTag[]
}

export interface ProjectTodo {
  id: number
  project_id: number
  text: string
  done: number // 0 | 1
  sort_order: number
  created_at: number
}

interface ProjectStore {
  projects: Project[]
  loading: boolean
  selectedProjectId: number | null
  todos: ProjectTodo[]
  todosLoading: boolean
  pendingDawNotification: { event: string; fileName: string } | null

  fetchProjects: () => Promise<void>
  createProject: (data: {
    title: string
    description?: string
    stage?: string
    bpm?: number
    musicalKey?: string
    color?: string
    priority?: string
  }) => Promise<void>
  updateProject: (id: number, changes: Record<string, any>) => Promise<void>
  moveProject: (id: number, stage: string, sortOrder: number) => Promise<void>
  moveGroup: (groupKey: string, stage: string) => Promise<void>
  deleteProject: (id: number) => Promise<void>

  selectProject: (id: number | null) => void
  fetchTodos: (projectId: number) => Promise<void>
  createTodo: (projectId: number, text: string) => Promise<void>
  toggleTodo: (todoId: number, done: boolean) => Promise<void>
  updateTodoText: (todoId: number, text: string) => Promise<void>
  deleteTodo: (todoId: number) => Promise<void>

  dismissDawNotification: () => void
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  // Listen for DAW filesystem events pushed from main process — silent refresh
  window.api.on.dawProjectChanged((data) => {
    window.api.project.list().then((projects: any[]) => {
      set({ projects })
      const { selectedProjectId } = get()
      if (selectedProjectId) get().fetchTodos(selectedProjectId)
      if (data.event !== 'change') {
        set({ pendingDawNotification: { event: data.event, fileName: data.fileName } })
      }
    }).catch(() => {})
  })

  return {
    projects: [],
    loading: false,
    selectedProjectId: null,
    todos: [],
    todosLoading: false,
    pendingDawNotification: null,

    fetchProjects: async () => {
      set({ loading: true })
      try {
        const projects = await window.api.project.list()
        set({ projects })
      } finally {
        set({ loading: false })
      }
    },

    createProject: async (data) => {
      set({ loading: true })
      try {
        await window.api.project.create(data)
        await get().fetchProjects()
      } finally {
        set({ loading: false })
      }
    },

    updateProject: async (id, changes) => {
      await window.api.project.update(id, changes)
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...changes, updated_at: Date.now() / 1000 } : p
        )
      }))
    },

    moveProject: async (id, stage, sortOrder) => {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, stage: stage as Project['stage'], sort_order: sortOrder } : p
        )
      }))
      try {
        await window.api.project.moveStage(id, stage, sortOrder)
      } catch {
        await get().fetchProjects()
      }
    },

    moveGroup: async (groupKey, stage) => {
      const members = get().projects.filter((p) => (p.group_key || p.title) === groupKey)
      await Promise.all(members.map((m, i) => get().moveProject(m.id, stage, i)))
    },

    deleteProject: async (id) => {
      await window.api.project.delete(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
        todos: state.selectedProjectId === id ? [] : state.todos
      }))
    },

    // ── Detail panel ────────────────────────────────────────────────────────

    selectProject: (id) => {
      set({ selectedProjectId: id, todos: [] })
      if (id !== null) get().fetchTodos(id)
    },

    fetchTodos: async (projectId) => {
      set({ todosLoading: true })
      try {
        const todos = await window.api.project.getTodos(projectId)
        set({ todos })
      } finally {
        set({ todosLoading: false })
      }
    },

    createTodo: async (projectId, text) => {
      const todo = await window.api.project.createTodo(projectId, text)
      set((s) => ({
        todos: [...s.todos, todo],
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, todo_count: p.todo_count + 1 } : p
        )
      }))
    },

    toggleTodo: async (todoId, done) => {
      set((s) => ({
        todos: s.todos.map((t) => (t.id === todoId ? { ...t, done: done ? 1 : 0 } : t))
      }))
      const updated = await window.api.project.updateTodo(todoId, { done })
      set((s) => {
        const projectId = updated.project_id
        const doneCount = s.todos.filter((t) => (t.id === todoId ? done : t.done === 1)).length
        return {
          todos: s.todos.map((t) => (t.id === todoId ? updated : t)),
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, done_count: doneCount } : p
          )
        }
      })
    },

    updateTodoText: async (todoId, text) => {
      set((s) => ({
        todos: s.todos.map((t) => (t.id === todoId ? { ...t, text } : t))
      }))
      await window.api.project.updateTodo(todoId, { text })
    },

    deleteTodo: async (todoId) => {
      const todo = get().todos.find((t) => t.id === todoId)
      set((s) => ({ todos: s.todos.filter((t) => t.id !== todoId) }))
      await window.api.project.deleteTodo(todoId)
      if (todo) {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === todo.project_id
              ? {
                  ...p,
                  todo_count: Math.max(0, p.todo_count - 1),
                  done_count: todo.done ? Math.max(0, p.done_count - 1) : p.done_count
                }
              : p
          )
        }))
      }
    },

    dismissDawNotification: () => set({ pendingDawNotification: null })
  }
})
