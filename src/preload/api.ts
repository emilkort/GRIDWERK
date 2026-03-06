import { ipcRenderer } from 'electron'

// API shape exposed to the renderer via contextBridge
export const producerApi = {
  // DAW Hub
  daw: {
    register: (data: {
      name: string
      executablePath: string
      projectExtension: string
      projectFolders: string[]
    }) => ipcRenderer.invoke('daw:register', data),
    list: () => ipcRenderer.invoke('daw:list'),
    launch: (dawId: number) => ipcRenderer.invoke('daw:launch', dawId),
    scanProjects: (dawId: number) => ipcRenderer.invoke('daw:scan-projects', dawId),
    getProjects: (dawId: number) => ipcRenderer.invoke('daw:get-projects', dawId),
    delete: (dawId: number) => ipcRenderer.invoke('daw:delete', dawId),
    refreshIcon: (dawId: number) =>
      ipcRenderer.invoke('daw:refresh-icon', dawId) as Promise<string | null>
  },

  // VST Manager
  vst: {
    addScanPath: (data: { folderPath: string; format: 'VST2' | 'VST3' }) =>
      ipcRenderer.invoke('vst:add-scan-path', data),
    listScanPaths: () => ipcRenderer.invoke('vst:list-scan-paths'),
    scan: (scanPathId: number) => ipcRenderer.invoke('vst:scan', scanPathId),
    list: (filters?: { category?: string; subcategory?: string; favorite?: boolean; search?: string }) =>
      ipcRenderer.invoke('vst:list', filters),
    toggleFavorite: (pluginId: number) => ipcRenderer.invoke('vst:toggle-favorite', pluginId),
    updateCategory: (pluginId: number, category: string) =>
      ipcRenderer.invoke('vst:update-category', pluginId, category),
    deleteScanPath: (scanPathId: number) =>
      ipcRenderer.invoke('vst:delete-scan-path', scanPathId),
    setHidden: (pluginId: number, hidden: boolean) =>
      ipcRenderer.invoke('vst:set-hidden', pluginId, hidden),
    listHidden: () => ipcRenderer.invoke('vst:list-hidden'),
    enrichAll: () =>
      ipcRenderer.invoke('vst:enrich-all') as Promise<{ enriched: number; total: number }>,
    enrichSingle: (pluginId: number) =>
      ipcRenderer.invoke('vst:enrich-single', pluginId),
    syncReferenceLibrary: () =>
      ipcRenderer.invoke('vst:sync-reference-library') as Promise<{ added: number; updated: number; total: number }>,
    getReferenceStats: () =>
      ipcRenderer.invoke('vst:reference-stats') as Promise<{ total: number; sources: Record<string, number> }>
  },

  // Sample Library
  sample: {
    addFolder: (data: { folderPath: string; label?: string }) =>
      ipcRenderer.invoke('sample:add-folder', data),
    listFolders: () => ipcRenderer.invoke('sample:list-folders'),
    scanFolder: (folderId: number) => ipcRenderer.invoke('sample:scan-folder', folderId),
    list: (filters?: {
      folderId?: number
      category?: string
      bpmMin?: number
      bpmMax?: number
      key?: string
      search?: string
      subfolderPath?: string
      tagIds?: number[]
      sortBy?: 'name' | 'bpm' | 'key' | 'duration'
      sortDir?: 'asc' | 'desc'
      isFavorites?: boolean
      analyzedFilter?: 'analyzed' | 'unanalyzed'
      limit?: number
      offset?: number
      skipCount?: boolean
    }) => ipcRenderer.invoke('sample:list', filters),
    get: (sampleId: number) => ipcRenderer.invoke('sample:get', sampleId),
    analyze: (sampleId: number) => ipcRenderer.invoke('sample:analyze', sampleId),
    getWaveform: (sampleId: number) => ipcRenderer.invoke('sample:get-waveform', sampleId),
    deleteFolder: (folderId: number) => ipcRenderer.invoke('sample:delete-folder', folderId),
    analyzeFolder: (folderId: number) => ipcRenderer.invoke('sample:analyze-folder', folderId),
    getSubfolderTree: (folderId: number) =>
      ipcRenderer.invoke('sample:subfolder-tree', folderId) as Promise<
        { subPath: string; count: number }[]
      >,
    getTotalCount: () => ipcRenderer.invoke('sample:get-total-count') as Promise<number>,
    toggleFavorite: (sampleId: number) =>
      ipcRenderer.invoke('sample:toggle-favorite', sampleId) as Promise<number>,
    findSimilar: (sampleId: number, limit?: number) =>
      ipcRenderer.invoke('sample:find-similar', sampleId, limit) as Promise<
        { id: number; file_name: string; file_path: string; category: string | null; similarity: number }[]
      >,
    findDuplicates: () =>
      ipcRenderer.invoke('sample:find-duplicates') as Promise<{
        exact: { hash: string; samples: { id: number; file_name: string; file_path: string; file_size: number | null }[] }[]
        near: { samples: { id: number; file_name: string; file_path: string; file_size: number | null; similarity: number }[] }[]
      }>,
    autoTag: () =>
      ipcRenderer.invoke('sample:auto-tag') as Promise<{ tagged: number; tagsCreated: number }>,
    findMatching: (bpm: number | null, key: string | null) =>
      ipcRenderer.invoke('sample:find-matching', bpm, key) as Promise<any[]>,
    delete: (sampleId: number, deleteFromDisk: boolean) =>
      ipcRenderer.invoke('sample:delete', sampleId, deleteFromDisk) as Promise<{ deleted: boolean; filePath?: string }>
  },

  // Project Tracker
  project: {
    create: (data: {
      title: string
      description?: string
      stage?: string
      bpm?: number
      musicalKey?: string
      color?: string
      dawProjectId?: number
    }) => ipcRenderer.invoke('project:create', data),
    update: (id: number, changes: Record<string, any>) =>
      ipcRenderer.invoke('project:update', id, changes),
    moveStage: (id: number, stage: string, sortOrder: number) =>
      ipcRenderer.invoke('project:move-stage', id, stage, sortOrder),
    list: () => ipcRenderer.invoke('project:list'),
    delete: (id: number) => ipcRenderer.invoke('project:delete', id),
    // Todos
    getTodos: (projectId: number) =>
      ipcRenderer.invoke('project:get-todos', projectId) as Promise<any[]>,
    createTodo: (projectId: number, text: string) =>
      ipcRenderer.invoke('project:create-todo', projectId, text) as Promise<any>,
    updateTodo: (todoId: number, changes: { text?: string; done?: boolean }) =>
      ipcRenderer.invoke('project:update-todo', todoId, changes) as Promise<any>,
    deleteTodo: (todoId: number) =>
      ipcRenderer.invoke('project:delete-todo', todoId) as Promise<void>,
    getPlugins: (projectId: number) =>
      ipcRenderer.invoke('project:get-plugins', projectId) as Promise<
        { id: number; plugin_name: string; format: string | null; file_name: string | null }[]
      >
  },

  // Tags
  tag: {
    create: (data: { name: string; color?: string }) =>
      ipcRenderer.invoke('tag:create', data),
    list: () => ipcRenderer.invoke('tag:list'),
    attach: (tagId: number, entityType: string, entityId: number) =>
      ipcRenderer.invoke('tag:attach', tagId, entityType, entityId),
    detach: (tagId: number, entityType: string, entityId: number) =>
      ipcRenderer.invoke('tag:detach', tagId, entityType, entityId),
    getForEntity: (entityType: string, entityId: number) =>
      ipcRenderer.invoke('tag:get-for-entity', entityType, entityId),
    delete: (tagId: number) => ipcRenderer.invoke('tag:delete', tagId)
  },

  // Stages
  stage: {
    list: () => ipcRenderer.invoke('stage:list'),
    create: (data: { name: string; color: string }) => ipcRenderer.invoke('stage:create', data),
    update: (id: number, changes: { name?: string; color?: string; sort_order?: number }) =>
      ipcRenderer.invoke('stage:update', id, changes),
    delete: (id: number) => ipcRenderer.invoke('stage:delete', id) as Promise<{ ok: boolean; error?: string }>,
    reorder: (orderedIds: number[]) => ipcRenderer.invoke('stage:reorder', orderedIds)
  },

  // Analytics
  analytics: {
    getData: () => ipcRenderer.invoke('analytics:get-data')
  },

  // Discover
  discover: {
    getData: () => ipcRenderer.invoke('discover:get-data')
  },

  // Search
  search: {
    query: (query: string) => ipcRenderer.invoke('search:query', query)
  },

  // Database
  db: {
    backup: () => ipcRenderer.invoke('db:backup') as Promise<string | null>,
    backupAuto: () => ipcRenderer.invoke('db:backup-auto') as Promise<string>,
    getPath: () => ipcRenderer.invoke('db:get-path') as Promise<string>
  },

  // Dialogs
  dialog: {
    pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
    pickFile: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('dialog:pick-file', filters)
  },

  // Shell
  shell: {
    showInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-in-folder', filePath)
  },

  // Native drag
  drag: {
    startNative: (filePaths: string | string[]) => ipcRenderer.send('drag:start-native', filePaths)
  },

  // Event listeners (push from main)
  on: {
    scanProgress: (
      callback: (data: {
        scanType: string
        current: number
        total: number
        currentFile: string
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('scan:progress', handler)
      return () => ipcRenderer.removeListener('scan:progress', handler)
    },
    analysisProgress: (
      callback: (data: {
        current: number
        total: number
        currentFile: string
        sampleId: number
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('analysis:progress', handler)
      return () => ipcRenderer.removeListener('analysis:progress', handler)
    },
    enrichProgress: (
      callback: (data: {
        current: number
        total: number
        currentFile: string
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('enrich:progress', handler)
      return () => ipcRenderer.removeListener('enrich:progress', handler)
    },
    analysisComplete: (
      callback: (data: {
        folderId: number
        successCount: number
        total: number
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('analysis:complete', handler)
      return () => ipcRenderer.removeListener('analysis:complete', handler)
    },
    // Fired when a DAW project file is added / changed / removed on disk
    dawProjectChanged: (
      callback: (data: {
        event: 'add' | 'change' | 'unlink'
        dawProjectId: number
        fileName: string
        projectId?: number
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('project:daw-changed', handler)
      return () => ipcRenderer.removeListener('project:daw-changed', handler)
    },
    // Fired when a VST plugin is added / removed on disk
    vstPluginChanged: (
      callback: (data: {
        event: 'add' | 'unlink'
        pluginId?: number
        pluginName: string
        filePath: string
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('vst:plugin-changed', handler)
      return () => ipcRenderer.removeListener('vst:plugin-changed', handler)
    },
    mainLog: (
      callback: (data: {
        level: string
        message: string
        timestamp: number
      }) => void
    ) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('main:log', handler)
      return () => ipcRenderer.removeListener('main:log', handler)
    }
  }
}

export type ProducerApi = typeof producerApi
