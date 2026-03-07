import { ipcMain, dialog, shell, BrowserWindow, nativeImage } from 'electron'
import * as dawService from '../services/daw.service'
import * as vstService from '../services/vst.service'
import * as sampleService from '../services/sample.service'
import * as audioAnalysisService from '../services/audio-analysis.service'
import * as projectService from '../services/project.service'
import * as tagService from '../services/tag.service'
import * as searchService from '../services/search.service'
import * as enrichmentService from '../services/enrichment.service'
import { backupDatabase, getDbPath, getDb } from '../services/database.service'
import { startWatchingDaw, importUnlinkedDawProjects } from '../services/project-watcher.service'
import { startWatchingVstPath, stopWatchingVstPath } from '../services/vst-watcher.service'
import * as stageService from '../services/stage.service'
import * as similarSampleService from '../services/similar-sample.service'
import * as analyticsService from '../services/analytics.service'
import * as recommendationsService from '../services/recommendations.service'
import * as pluginReferenceService from '../services/plugin-reference.service'
import * as autoTagService from '../services/auto-tag.service'
import * as collectionService from '../services/collection.service'
import * as spliceService from '../services/splice.service'
import * as tracklibService from '../services/tracklib.service'
import { startWatchingServiceFolder, stopWatchingServiceFolder } from '../services/service-watcher.service'

/** Validate that a value is a positive integer (for IPC ID params) */
function validId(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw new Error('Invalid ID')
  return v
}

export function registerAllIpcHandlers(mainWindow: BrowserWindow): void {
  // ---- DAW Hub ----
  ipcMain.handle('daw:register', async (_, data) => {
    const daw = await dawService.registerDaw(data)
    // Start watching the new DAW's project folders immediately
    startWatchingDaw(daw, mainWindow)
    return daw
  })
  ipcMain.handle('daw:list', () => dawService.listDaws())
  ipcMain.handle('daw:launch', (_, dawId) => dawService.launchDaw(validId(dawId)))
  ipcMain.handle('daw:scan-projects', (_, dawId) => {
    const result = dawService.scanProjects(validId(dawId))
    importUnlinkedDawProjects(mainWindow)
    return result
  })
  ipcMain.handle('daw:get-projects', (_, dawId) => dawService.getProjects(validId(dawId)))
  ipcMain.handle('daw:delete', (_, dawId) => dawService.deleteDaw(validId(dawId)))
  ipcMain.handle('daw:refresh-icon', (_, dawId) => dawService.refreshDawIcon(validId(dawId)))

  // ---- VST Manager ----
  ipcMain.handle('vst:add-scan-path', (_, data) => {
    const scanPath = vstService.addScanPath(data)
    startWatchingVstPath(scanPath, mainWindow)
    return scanPath
  })
  ipcMain.handle('vst:list-scan-paths', () => vstService.listScanPaths())
  ipcMain.handle('vst:scan', async (_, scanPathId) => {
    const plugins = vstService.scanVstPath(validId(scanPathId), mainWindow)
    // Auto-enrich newly scanned plugins in the background
    enrichmentService.enrichNewPlugins(mainWindow).catch((err) => console.error('[IPC] enrichNewPlugins failed:', err))
    return plugins
  })
  ipcMain.handle('vst:list', (_, filters) => vstService.listPlugins(filters))
  ipcMain.handle('vst:toggle-favorite', (_, pluginId) => vstService.toggleFavorite(validId(pluginId)))
  ipcMain.handle('vst:update-category', (_, pluginId, category) =>
    vstService.updateCategory(validId(pluginId), category)
  )
  ipcMain.handle('vst:set-hidden', (_, pluginId, hidden) =>
    vstService.setHidden(validId(pluginId), hidden)
  )
  ipcMain.handle('vst:list-hidden', () => vstService.listHiddenPlugins())
  ipcMain.handle('vst:delete-scan-path', (_, scanPathId) => {
    const id = validId(scanPathId)
    stopWatchingVstPath(id)
    return vstService.deleteScanPath(id)
  })
  ipcMain.handle('vst:enrich-all', () => enrichmentService.enrichAllPlugins(mainWindow))
  ipcMain.handle('vst:enrich-single', (_, pluginId) => enrichmentService.enrichSinglePlugin(validId(pluginId)))
  ipcMain.handle('vst:sync-reference-library', () => pluginReferenceService.syncReferenceLibrary(mainWindow))
  ipcMain.handle('vst:reference-stats', () => pluginReferenceService.getReferenceStats())

  // ---- Sample Library ----
  ipcMain.handle('sample:add-folder', (_, data) => sampleService.addFolder(data))
  ipcMain.handle('sample:list-folders', () => sampleService.listFolders())
  ipcMain.handle('sample:scan-folder', (_, folderId) =>
    sampleService.scanFolder(validId(folderId), mainWindow)
  )
  ipcMain.handle('sample:list', (_, filters) => sampleService.listSamples(filters))
  ipcMain.handle('sample:get', (_, sampleId) => sampleService.getSample(validId(sampleId)))
  ipcMain.handle('sample:delete-folder', (_, folderId) => sampleService.deleteFolder(validId(folderId)))
  ipcMain.handle('sample:analyze', (_, sampleId) => audioAnalysisService.analyzeSample(validId(sampleId)))
  ipcMain.handle('sample:get-waveform', (_, sampleId) => audioAnalysisService.getWaveformPeaks(validId(sampleId)))
  ipcMain.handle('sample:analyze-folder', (_, folderId) =>
    audioAnalysisService.analyzeFolder(validId(folderId), mainWindow)
  )
  ipcMain.handle('sample:subfolder-tree', (_, folderId) =>
    sampleService.getSubfolderTree(validId(folderId))
  )
  ipcMain.handle('sample:get-total-count', () => sampleService.getTotalSampleCount())
  ipcMain.handle('sample:toggle-favorite', (_, sampleId) => sampleService.toggleFavorite(validId(sampleId)))

  // ---- Project Tracker ----
  ipcMain.handle('project:create', (_, data) => projectService.createProject(data))
  ipcMain.handle('project:update', (_, id, changes) => projectService.updateProject(validId(id), changes))
  ipcMain.handle('project:move-stage', (_, id, stage, sortOrder) =>
    projectService.moveStage(validId(id), stage, sortOrder)
  )
  ipcMain.handle('project:list', () => projectService.listProjects())
  ipcMain.handle('project:delete', (_, id) => projectService.deleteProject(validId(id)))
  // Todos
  ipcMain.handle('project:get-todos', (_, projectId) => projectService.getTodos(validId(projectId)))
  ipcMain.handle('project:create-todo', (_, projectId, text) => projectService.createTodo(validId(projectId), text))
  ipcMain.handle('project:update-todo', (_, todoId, changes) => projectService.updateTodo(validId(todoId), changes))
  ipcMain.handle('project:delete-todo', (_, todoId) => projectService.deleteTodo(validId(todoId)))

  // ---- Tags ----
  ipcMain.handle('tag:create', (_, data) => tagService.createTag(data))
  ipcMain.handle('tag:list', () => tagService.listTags())
  ipcMain.handle('tag:attach', (_, tagId, entityType, entityId) =>
    tagService.attachTag(validId(tagId), entityType, validId(entityId))
  )
  ipcMain.handle('tag:detach', (_, tagId, entityType, entityId) =>
    tagService.detachTag(validId(tagId), entityType, validId(entityId))
  )
  ipcMain.handle('tag:get-for-entity', (_, entityType, entityId) =>
    tagService.getTagsForEntity(entityType, validId(entityId))
  )
  ipcMain.handle('tag:delete', (_, tagId) => tagService.deleteTag(validId(tagId)))

  // ---- Stages ----
  ipcMain.handle('stage:list', () => stageService.listStages())
  ipcMain.handle('stage:create', (_, data) => stageService.createStage(data))
  ipcMain.handle('stage:update', (_, id, changes) => stageService.updateStage(validId(id), changes))
  ipcMain.handle('stage:delete', (_, id) => stageService.deleteStage(validId(id)))
  ipcMain.handle('stage:reorder', (_, orderedIds) => stageService.reorderStages(orderedIds))

  // ---- Similar Samples & Duplicates ----
  ipcMain.handle('sample:find-similar', (_, sampleId, limit) =>
    similarSampleService.findSimilarSamples(validId(sampleId), limit)
  )
  ipcMain.handle('sample:find-duplicates', () => similarSampleService.findDuplicates())

  // ---- Analytics ----
  ipcMain.handle('analytics:get-data', () => analyticsService.getAnalyticsData())

  // ---- Discover ----
  ipcMain.handle('discover:get-data', () => recommendationsService.getDiscoverData())

  // ---- Project Plugins ----
  ipcMain.handle('project:get-plugins', (_, projectId) => {
    return getDb().prepare('SELECT * FROM project_plugins WHERE project_id = ? ORDER BY plugin_name').all(validId(projectId))
  })

  // ---- Auto-Tagging ----
  ipcMain.handle('sample:auto-tag', () => autoTagService.autoTagUntaggedSamples())

  // ---- BPM/Key Matching ----
  ipcMain.handle('sample:find-matching', (_, bpm: number | null, key: string | null) =>
    sampleService.findMatchingSamples(bpm, key)
  )

  // ---- Sample Delete ----
  ipcMain.handle('sample:delete', (_, sampleId, deleteFromDisk: boolean) =>
    sampleService.deleteSample(validId(sampleId), deleteFromDisk)
  )

  // ---- Search ----
  ipcMain.handle('search:query', (_, query) => searchService.search(query))

  // ---- Database ----
  ipcMain.handle('db:backup', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Database Backup',
      defaultPath: `producers-manager-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })
    if (result.canceled || !result.filePath) return null
    return backupDatabase(result.filePath)
  })
  ipcMain.handle('db:backup-auto', () => backupDatabase())
  ipcMain.handle('db:get-path', () => getDbPath())

  // ---- Dialogs ----
  ipcMain.handle('dialog:pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pick-file', async (_, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || []
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ---- Shell ----
  ipcMain.handle('shell:show-in-folder', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // ---- Service Integrations (Splice / Tracklib) ----
  ipcMain.handle('service:list-connections', () => {
    return getDb().prepare('SELECT * FROM service_connections').all()
  })
  ipcMain.handle('service:update-connection', (_, service: string, changes: Record<string, any>) => {
    const allowed = ['enabled', 'local_folder', 'metadata_db_path', 'config']
    const sets: string[] = []
    const vals: any[] = []
    for (const [k, v] of Object.entries(changes)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v) }
    }
    if (sets.length === 0) return
    sets.push("updated_at = strftime('%s','now')")
    vals.push(service)
    getDb().prepare(`UPDATE service_connections SET ${sets.join(', ')} WHERE service = ?`).run(...vals)

    // Start/stop watcher based on enabled + local_folder
    const conn = getDb().prepare('SELECT * FROM service_connections WHERE service = ?').get(service) as any
    if (conn?.enabled && conn?.local_folder) {
      startWatchingServiceFolder(service as any, conn.local_folder, mainWindow)
    } else {
      stopWatchingServiceFolder(service)
    }
  })
  ipcMain.handle('service:detect-splice', () => spliceService.detectSpliceInstall())
  ipcMain.handle('service:detect-tracklib', () => tracklibService.detectTracklibFolder())
  ipcMain.handle('service:sync-splice', () => {
    const conn = getDb().prepare("SELECT * FROM service_connections WHERE service = 'splice'").get() as any
    if (!conn?.local_folder) throw new Error('Splice folder not configured')
    if (conn.metadata_db_path) {
      return spliceService.syncFromSpliceDb(conn.metadata_db_path, conn.local_folder)
    }
    return spliceService.syncFromSpliceFolder(conn.local_folder)
  })
  ipcMain.handle('service:sync-tracklib', () => {
    const conn = getDb().prepare("SELECT * FROM service_connections WHERE service = 'tracklib'").get() as any
    if (!conn?.local_folder) throw new Error('Tracklib folder not configured')
    return tracklibService.syncFromFolder(conn.local_folder)
  })
  ipcMain.handle('service:search-splice', async (_, query: string, options?: any) => {
    const result = await spliceService.searchCatalog(query, options)
    // Insert cloud samples into DB
    if (result.samples.length > 0) {
      spliceService.insertCloudSamples(result.samples)
    }
    return result
  })
  ipcMain.handle('service:download-sample', async (_, sampleId) => {
    const sample = getDb().prepare('SELECT * FROM samples WHERE id = ?').get(validId(sampleId)) as any
    if (!sample || !sample.is_cloud) throw new Error('Not a cloud sample')
    if (sample.source === 'splice' && sample.source_id) {
      // Open Splice website for this sample (deep links not reliably supported)
      await shell.openExternal(`https://splice.com/sounds/sample/${sample.source_id}`)
    }
  })
  ipcMain.handle('service:fetch-preview', async (_, sampleId) => {
    const sample = getDb().prepare('SELECT cloud_preview_url FROM samples WHERE id = ?').get(validId(sampleId)) as any
    if (!sample?.cloud_preview_url) return null
    const mp3Buffer = await spliceService.fetchPreviewAudio(sample.cloud_preview_url)
    return mp3Buffer.toString('base64')
  })

  // ---- Collections (Organiser) ----
  ipcMain.handle('collection:list', () => collectionService.listCollections())
  ipcMain.handle('collection:get', (_, id) => collectionService.getCollection(validId(id)))
  ipcMain.handle('collection:create', (_, data) => collectionService.createCollection(data))
  ipcMain.handle('collection:update', (_, id, changes) => collectionService.updateCollection(validId(id), changes))
  ipcMain.handle('collection:delete', (_, id) => collectionService.deleteCollection(validId(id)))
  ipcMain.handle('collection:get-items', (_, collectionId) => collectionService.getCollectionItems(validId(collectionId)))
  ipcMain.handle('collection:add-item', (_, collectionId, projectId) =>
    collectionService.addToCollection(validId(collectionId), validId(projectId)))
  ipcMain.handle('collection:remove-item', (_, collectionId, projectId) =>
    collectionService.removeFromCollection(validId(collectionId), validId(projectId)))
  ipcMain.handle('collection:reorder-items', (_, collectionId, orderedProjectIds: number[]) =>
    collectionService.reorderCollectionItems(validId(collectionId), orderedProjectIds))
  ipcMain.handle('collection:update-item-notes', (_, collectionId, projectId, notes: string) =>
    collectionService.updateCollectionItemNotes(validId(collectionId), validId(projectId), notes))
  ipcMain.handle('collection:get-suggestions', (_, collectionId) =>
    collectionService.getCollectionSuggestions(validId(collectionId)))
  ipcMain.handle('collection:set-artwork', async (_, collectionId) => {
    const id = validId(collectionId)
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const artPath = result.filePaths[0]
    collectionService.updateCollection(id, { artwork_path: artPath })
    return artPath
  })

  // ---- Native Drag ----
  // Create a 16x16 RGBA bitmap for the drag icon (Windows requires a valid non-empty icon)
  const size = 16
  const buf = Buffer.alloc(size * size * 4, 0) // fully transparent RGBA
  // Set a few pixels semi-visible so the icon is not empty
  for (let i = 0; i < size * size * 4; i += 4) {
    buf[i + 3] = 1 // alpha = 1 (nearly transparent)
  }
  const dragIcon = nativeImage.createFromBitmap(buf, { width: size, height: size })

  ipcMain.on('drag:start-native', (event, filePaths: string | string[]) => {
    console.log('[Drag] main received:', filePaths)
    try {
      const single = Array.isArray(filePaths) ? filePaths[0] : filePaths
      const { existsSync } = require('fs')
      console.log('[Drag] file exists:', existsSync(single), 'icon size:', dragIcon.getSize())
      event.sender.startDrag({
        file: single,
        icon: dragIcon
      })
      console.log('[Drag] startDrag returned OK')
    } catch (err) {
      console.error('[Drag] startDrag threw:', err)
    }
  })
}
