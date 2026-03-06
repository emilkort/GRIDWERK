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

export function registerAllIpcHandlers(mainWindow: BrowserWindow): void {
  // ---- DAW Hub ----
  ipcMain.handle('daw:register', async (_, data) => {
    const daw = await dawService.registerDaw(data)
    // Start watching the new DAW's project folders immediately
    startWatchingDaw(daw, mainWindow)
    return daw
  })
  ipcMain.handle('daw:list', () => dawService.listDaws())
  ipcMain.handle('daw:launch', (_, dawId) => dawService.launchDaw(dawId))
  ipcMain.handle('daw:scan-projects', (_, dawId) => {
    const result = dawService.scanProjects(dawId)
    importUnlinkedDawProjects(mainWindow)
    return result
  })
  ipcMain.handle('daw:get-projects', (_, dawId) => dawService.getProjects(dawId))
  ipcMain.handle('daw:delete', (_, dawId) => dawService.deleteDaw(dawId))
  ipcMain.handle('daw:refresh-icon', (_, dawId) => dawService.refreshDawIcon(dawId))

  // ---- VST Manager ----
  ipcMain.handle('vst:add-scan-path', (_, data) => {
    const scanPath = vstService.addScanPath(data)
    startWatchingVstPath(scanPath, mainWindow)
    return scanPath
  })
  ipcMain.handle('vst:list-scan-paths', () => vstService.listScanPaths())
  ipcMain.handle('vst:scan', async (_, scanPathId) => {
    const plugins = vstService.scanVstPath(scanPathId, mainWindow)
    // Auto-enrich newly scanned plugins in the background
    enrichmentService.enrichNewPlugins(mainWindow).catch(() => {})
    return plugins
  })
  ipcMain.handle('vst:list', (_, filters) => vstService.listPlugins(filters))
  ipcMain.handle('vst:toggle-favorite', (_, pluginId) => vstService.toggleFavorite(pluginId))
  ipcMain.handle('vst:update-category', (_, pluginId, category) =>
    vstService.updateCategory(pluginId, category)
  )
  ipcMain.handle('vst:set-hidden', (_, pluginId, hidden) =>
    vstService.setHidden(pluginId, hidden)
  )
  ipcMain.handle('vst:list-hidden', () => vstService.listHiddenPlugins())
  ipcMain.handle('vst:delete-scan-path', (_, scanPathId) => {
    stopWatchingVstPath(scanPathId)
    return vstService.deleteScanPath(scanPathId)
  })
  ipcMain.handle('vst:enrich-all', () => enrichmentService.enrichAllPlugins(mainWindow))
  ipcMain.handle('vst:enrich-single', (_, pluginId) => enrichmentService.enrichSinglePlugin(pluginId))
  ipcMain.handle('vst:sync-reference-library', () => pluginReferenceService.syncReferenceLibrary(mainWindow))
  ipcMain.handle('vst:reference-stats', () => pluginReferenceService.getReferenceStats())

  // ---- Sample Library ----
  ipcMain.handle('sample:add-folder', (_, data) => sampleService.addFolder(data))
  ipcMain.handle('sample:list-folders', () => sampleService.listFolders())
  ipcMain.handle('sample:scan-folder', (_, folderId) =>
    sampleService.scanFolder(folderId, mainWindow)
  )
  ipcMain.handle('sample:list', (_, filters) => sampleService.listSamples(filters))
  ipcMain.handle('sample:get', (_, sampleId) => sampleService.getSample(sampleId))
  ipcMain.handle('sample:delete-folder', (_, folderId) => sampleService.deleteFolder(folderId))
  ipcMain.handle('sample:analyze', (_, sampleId) => audioAnalysisService.analyzeSample(sampleId))
  ipcMain.handle('sample:get-waveform', (_, sampleId) => audioAnalysisService.getWaveformPeaks(sampleId))
  ipcMain.handle('sample:analyze-folder', (_, folderId) =>
    audioAnalysisService.analyzeFolder(folderId, mainWindow)
  )
  ipcMain.handle('sample:subfolder-tree', (_, folderId) =>
    sampleService.getSubfolderTree(folderId)
  )
  ipcMain.handle('sample:get-total-count', () => sampleService.getTotalSampleCount())
  ipcMain.handle('sample:toggle-favorite', (_, sampleId) => sampleService.toggleFavorite(sampleId))

  // ---- Project Tracker ----
  ipcMain.handle('project:create', (_, data) => projectService.createProject(data))
  ipcMain.handle('project:update', (_, id, changes) => projectService.updateProject(id, changes))
  ipcMain.handle('project:move-stage', (_, id, stage, sortOrder) =>
    projectService.moveStage(id, stage, sortOrder)
  )
  ipcMain.handle('project:list', () => projectService.listProjects())
  ipcMain.handle('project:delete', (_, id) => projectService.deleteProject(id))
  // Todos
  ipcMain.handle('project:get-todos', (_, projectId) => projectService.getTodos(projectId))
  ipcMain.handle('project:create-todo', (_, projectId, text) => projectService.createTodo(projectId, text))
  ipcMain.handle('project:update-todo', (_, todoId, changes) => projectService.updateTodo(todoId, changes))
  ipcMain.handle('project:delete-todo', (_, todoId) => projectService.deleteTodo(todoId))

  // ---- Tags ----
  ipcMain.handle('tag:create', (_, data) => tagService.createTag(data))
  ipcMain.handle('tag:list', () => tagService.listTags())
  ipcMain.handle('tag:attach', (_, tagId, entityType, entityId) =>
    tagService.attachTag(tagId, entityType, entityId)
  )
  ipcMain.handle('tag:detach', (_, tagId, entityType, entityId) =>
    tagService.detachTag(tagId, entityType, entityId)
  )
  ipcMain.handle('tag:get-for-entity', (_, entityType, entityId) =>
    tagService.getTagsForEntity(entityType, entityId)
  )
  ipcMain.handle('tag:delete', (_, tagId) => tagService.deleteTag(tagId))

  // ---- Stages ----
  ipcMain.handle('stage:list', () => stageService.listStages())
  ipcMain.handle('stage:create', (_, data) => stageService.createStage(data))
  ipcMain.handle('stage:update', (_, id, changes) => stageService.updateStage(id, changes))
  ipcMain.handle('stage:delete', (_, id) => stageService.deleteStage(id))
  ipcMain.handle('stage:reorder', (_, orderedIds) => stageService.reorderStages(orderedIds))

  // ---- Similar Samples & Duplicates ----
  ipcMain.handle('sample:find-similar', (_, sampleId, limit) =>
    similarSampleService.findSimilarSamples(sampleId, limit)
  )
  ipcMain.handle('sample:find-duplicates', () => similarSampleService.findDuplicates())

  // ---- Analytics ----
  ipcMain.handle('analytics:get-data', () => analyticsService.getAnalyticsData())

  // ---- Discover ----
  ipcMain.handle('discover:get-data', () => recommendationsService.getDiscoverData())

  // ---- Project Plugins ----
  ipcMain.handle('project:get-plugins', (_, projectId: number) => {
    return getDb().prepare('SELECT * FROM project_plugins WHERE project_id = ? ORDER BY plugin_name').all(projectId)
  })

  // ---- Auto-Tagging ----
  ipcMain.handle('sample:auto-tag', () => autoTagService.autoTagUntaggedSamples())

  // ---- BPM/Key Matching ----
  ipcMain.handle('sample:find-matching', (_, bpm: number | null, key: string | null) =>
    sampleService.findMatchingSamples(bpm, key)
  )

  // ---- Sample Delete ----
  ipcMain.handle('sample:delete', (_, sampleId: number, deleteFromDisk: boolean) =>
    sampleService.deleteSample(sampleId, deleteFromDisk)
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

  // ---- Native Drag ----
  // 16x16 transparent PNG for drag operations (Windows requires a non-empty icon)
  const dragIcon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAE0lEQVQ4y2NgGAWjYBSMglEAAQQAAUAAAdGgukQAAAAASUVORK5CYII=',
      'base64'
    ),
    { scaleFactor: 1.0 }
  )

  ipcMain.on('drag:start-native', (event, filePaths: string | string[]) => {
    try {
      if (Array.isArray(filePaths) && filePaths.length > 1) {
        event.sender.startDrag({
          files: filePaths,
          icon: dragIcon
        })
      } else {
        const single = Array.isArray(filePaths) ? filePaths[0] : filePaths
        event.sender.startDrag({
          file: single,
          icon: dragIcon
        })
      }
    } catch (err) {
      console.error('Native drag failed:', err)
    }
  })
}
