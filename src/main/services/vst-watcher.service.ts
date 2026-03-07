/**
 * vst-watcher.service.ts
 *
 * Watches configured VST scan paths with chokidar for automatic plugin detection.
 * When a new VST is installed (or removed), updates the database and notifies
 * the renderer so the plugin list updates in real-time.
 *
 * Mirrors the pattern of project-watcher.service.ts.
 */
import chokidar from 'chokidar'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import { getDb } from './database.service'
import { parseVstFile } from './vst.service'
import { normalizePath } from '../utils/paths'
import { inferCategoryFromName } from '../utils/category-inference'
import * as enrichmentService from './enrichment.service'
import type { VstScanPath } from '../db/schema'

const watchers = new Map<number, chokidar.FSWatcher>()

/** Start watchers for every enabled VST scan path on app startup. */
export function startWatchingAllVstPaths(win: BrowserWindow): void {
  try {
    const scanPaths = getDb()
      .prepare('SELECT * FROM vst_scan_paths WHERE enabled = 1')
      .all() as VstScanPath[]
    for (const sp of scanPaths) {
      startWatchingVstPath(sp, win)
    }
  } catch (err) {
    console.error('[VSTWatcher] Failed to start watchers:', err)
  }
}

/** Start (or restart) the watcher for a single scan path. */
export function startWatchingVstPath(scanPath: VstScanPath, win: BrowserWindow): void {
  stopWatchingVstPath(scanPath.id)

  const ext = scanPath.format === 'VST3' ? '.vst3' : '.dll'

  const watcher = chokidar.watch(scanPath.folder_path, {
    ignored: /(^|[/\\])\../, // ignore dot-files / hidden dirs
    persistent: true,
    ignoreInitial: true, // existing files handled by manual scan
    depth: 4,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 }
  })

  watcher
    .on('add', (filePath) => {
      if (scanPath.format === 'VST2' && filePath.toLowerCase().endsWith('.dll')) {
        handleVstAdd(filePath, scanPath, win)
      }
    })
    .on('addDir', (dirPath) => {
      // VST3 bundles are directories ending in .vst3
      if (scanPath.format === 'VST3' && dirPath.toLowerCase().endsWith('.vst3')) {
        // Debounce: installers create the directory then write contents (moduleinfo.json etc.)
        setTimeout(() => handleVstAdd(dirPath, scanPath, win), 3000)
      }
    })
    .on('unlink', (filePath) => {
      if (scanPath.format === 'VST2' && filePath.toLowerCase().endsWith('.dll')) {
        handleVstRemove(filePath, win)
      }
    })
    .on('unlinkDir', (dirPath) => {
      if (scanPath.format === 'VST3' && dirPath.toLowerCase().endsWith('.vst3')) {
        handleVstRemove(dirPath, win)
      }
    })
    .on('error', (err) => console.error('[VSTWatcher] error:', err))

  watchers.set(scanPath.id, watcher)
  console.log(`[VSTWatcher] Watching "${scanPath.folder_path}" for ${scanPath.format} (${ext})`)
}

export function stopWatchingVstPath(scanPathId: number): void {
  const w = watchers.get(scanPathId)
  if (w) { w.close(); watchers.delete(scanPathId) }
}

export function stopAllVstWatchers(): void {
  for (const w of watchers.values()) w.close()
  watchers.clear()
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleVstAdd(filePath: string, scanPath: VstScanPath, win: BrowserWindow): void {
  try {
    const db = getDb()
    const normalized = normalizePath(filePath)

    // Idempotent — safe if manual scan already inserted this plugin
    const existing = db.prepare('SELECT id FROM vst_plugins WHERE file_path = ?').get(normalized)
    if (existing) return

    const parsed = parseVstFile(filePath, scanPath.format)
    if (!parsed) return

    // Apply category inference if metadata didn't provide one
    let { category, subcategory } = parsed
    if (category === 'Unknown') {
      const inferred = inferCategoryFromName(parsed.name, parsed.vendor)
      if (inferred) {
        category = inferred.category
        subcategory = inferred.subcategory ?? subcategory
      }
    }

    const result = db.prepare(
      `INSERT OR IGNORE INTO vst_plugins (scan_path_id, file_path, plugin_name, format, vendor, category, subcategory, file_size, last_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(scanPath.id, parsed.filePath, parsed.name, scanPath.format, parsed.vendor, category, subcategory, parsed.size, parsed.mtime)

    const pluginId = Number(result.lastInsertRowid)
    if (!pluginId) return // INSERT OR IGNORE hit a duplicate

    console.log(`[VSTWatcher] Detected new plugin: ${parsed.name}`)
    notify(win, { event: 'add', pluginId, pluginName: parsed.name, filePath: normalized })

    // Auto-enrich in background (non-blocking)
    enrichmentService.enrichNewPlugins(win).catch((err) => console.error('[VstWatcher] enrichNewPlugins failed:', err))
  } catch (err) {
    console.error('[VSTWatcher] handleVstAdd error:', err)
  }
}

function handleVstRemove(filePath: string, win: BrowserWindow): void {
  try {
    const db = getDb()
    const normalized = normalizePath(filePath)

    const row = db.prepare('SELECT id, plugin_name FROM vst_plugins WHERE file_path = ?').get(normalized) as
      { id: number; plugin_name: string } | undefined
    if (!row) return

    db.prepare('DELETE FROM vst_plugins WHERE id = ?').run(row.id)
    // Clean up any tags attached to this plugin
    db.prepare("DELETE FROM taggables WHERE entity_type = 'vst' AND entity_id = ?").run(row.id)

    console.log(`[VSTWatcher] Removed plugin: ${row.plugin_name}`)
    notify(win, { event: 'unlink', pluginId: row.id, pluginName: row.plugin_name, filePath: normalized })
  } catch (err) {
    console.error('[VSTWatcher] handleVstRemove error:', err)
  }
}

function notify(
  win: BrowserWindow,
  data: { event: string; pluginId?: number; pluginName: string; filePath: string }
): void {
  try {
    if (!win.isDestroyed()) win.webContents.send('vst:plugin-changed', data)
  } catch {}
}
