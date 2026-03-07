/**
 * service-watcher.service.ts
 *
 * Watches Splice and Tracklib download folders with chokidar.
 * When new audio files appear, they are automatically imported into the app's database.
 * For Splice: also flips is_cloud→0 if a matching cloud sample exists.
 *
 * Follows the pattern of vst-watcher.service.ts.
 */
import chokidar from 'chokidar'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import { getDb } from './database.service'
import { AUDIO_EXTENSIONS } from '../utils/paths'
import { parseTracklibFilename } from './tracklib.service'

const watchers = new Map<string, chokidar.FSWatcher>()

export interface ServiceConnection {
  id: number
  service: string
  enabled: number
  local_folder: string | null
  metadata_db_path: string | null
  last_synced: number | null
  config: string | null
}

/** Start watchers for all enabled services on app startup. */
export function startAllServiceWatchers(win: BrowserWindow): void {
  try {
    const connections = getDb()
      .prepare('SELECT * FROM service_connections WHERE enabled = 1 AND local_folder IS NOT NULL')
      .all() as ServiceConnection[]

    for (const conn of connections) {
      if (conn.local_folder) {
        startWatchingServiceFolder(conn.service as 'splice' | 'tracklib', conn.local_folder, win)
      }
    }
  } catch (err) {
    console.error('[ServiceWatcher] Failed to start watchers:', err)
  }
}

/** Start watching a specific service's download folder. */
export function startWatchingServiceFolder(
  service: 'splice' | 'tracklib',
  folderPath: string,
  win: BrowserWindow
): void {
  stopWatchingServiceFolder(service)

  const watcher = chokidar.watch(folderPath, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 10, // Splice organizes by pack in subdirectories
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 }
  })

  watcher
    .on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase()
      if (AUDIO_EXTENSIONS.has(ext)) {
        handleNewSample(filePath, service, folderPath, win)
      }
    })
    .on('unlink', (filePath) => {
      const ext = path.extname(filePath).toLowerCase()
      if (AUDIO_EXTENSIONS.has(ext)) {
        handleRemovedSample(filePath, service, win)
      }
    })
    .on('error', (err) => console.error(`[ServiceWatcher:${service}] error:`, err))

  watchers.set(service, watcher)
  console.log(`[ServiceWatcher] Watching "${folderPath}" for ${service}`)
}

/** Stop watching a service's folder. */
export function stopWatchingServiceFolder(service: string): void {
  const w = watchers.get(service)
  if (w) { w.close(); watchers.delete(service) }
}

/** Stop all service watchers. */
export function stopAllServiceWatchers(): void {
  for (const w of watchers.values()) w.close()
  watchers.clear()
}

// ── Event handlers ─────────────────────────────────────────────

function handleNewSample(
  filePath: string,
  service: 'splice' | 'tracklib',
  rootFolder: string,
  win: BrowserWindow
): void {
  try {
    const db = getDb()
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()

    // Check if already in DB
    const existing = db.prepare('SELECT id FROM samples WHERE file_path = ?').get(filePath)
    if (existing) return

    // For Splice: check if there's a matching cloud sample we can "fulfill"
    if (service === 'splice') {
      const fulfilled = db.transaction(() => {
        const cloudSample = db.prepare(
          "SELECT id FROM samples WHERE source = 'splice' AND is_cloud = 1 AND file_name = ?"
        ).get(fileName) as { id: number } | undefined
        if (!cloudSample) return false
        // Flip cloud → local (atomic with the SELECT)
        db.prepare('UPDATE samples SET file_path = ?, file_path_fwd = LOWER(REPLACE(?, char(92), \'/\')), is_cloud = 0, file_size = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
          .run(filePath, filePath, getFileSize(filePath), cloudSample.id)
        console.log(`[ServiceWatcher:splice] Cloud sample downloaded: ${fileName}`)
        notify(win, service, { event: 'downloaded', sampleId: cloudSample.id, fileName })
        return true
      })()
      if (fulfilled) return
    }

    // Insert as new sample
    let size = 0
    let mtime = 0
    try {
      const stat = require('fs').statSync(filePath)
      size = stat.size
      mtime = Math.floor(stat.mtimeMs / 1000)
    } catch { /* ignore */ }

    // Derive pack name from subfolder
    const rel = path.relative(rootFolder, filePath)
    const packName = rel.includes(path.sep) ? rel.split(path.sep)[0] : null

    // Parse BPM/key from filename for Tracklib
    let bpm: number | null = null
    let key: string | null = null
    if (service === 'tracklib') {
      const parsed = parseTracklibFilename(fileName)
      bpm = parsed.bpm
      key = parsed.key
    }

    const result = db.prepare(
      `INSERT OR IGNORE INTO samples
       (folder_id, file_path, file_path_fwd, file_name, file_extension, file_size,
        last_modified, source, is_cloud, pack_name, bpm, musical_key)
       VALUES (?, ?, LOWER(REPLACE(?, char(92), '/')), ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(
      null, filePath, filePath, fileName, ext, size, mtime,
      service, packName, bpm, key
    )

    const sampleId = Number(result.lastInsertRowid)
    if (sampleId) {
      console.log(`[ServiceWatcher:${service}] New sample: ${fileName}`)
      notify(win, service, { event: 'add', sampleId, fileName })
    }
  } catch (err) {
    console.error(`[ServiceWatcher:${service}] handleNewSample error:`, err)
  }
}

function handleRemovedSample(filePath: string, service: string, win: BrowserWindow): void {
  try {
    const db = getDb()
    const row = db.prepare('SELECT id FROM samples WHERE file_path = ? AND source = ?')
      .get(filePath, service) as { id: number } | undefined
    if (!row) return

    db.transaction(() => {
      db.prepare('DELETE FROM samples WHERE id = ?').run(row.id)
      db.prepare("DELETE FROM taggables WHERE entity_type = 'sample' AND entity_id = ?").run(row.id)
    })()

    console.log(`[ServiceWatcher:${service}] Removed sample: ${path.basename(filePath)}`)
    notify(win, service, { event: 'unlink', sampleId: row.id, fileName: path.basename(filePath) })
  } catch (err) {
    console.error(`[ServiceWatcher:${service}] handleRemovedSample error:`, err)
  }
}

function notify(win: BrowserWindow, service: string, data: Record<string, any>): void {
  try {
    if (!win.isDestroyed()) {
      win.webContents.send('service:sample-synced', { service, ...data })
    }
  } catch { /* ignore */ }
}

function getFileSize(filePath: string): number {
  try { return require('fs').statSync(filePath).size } catch { return 0 }
}
