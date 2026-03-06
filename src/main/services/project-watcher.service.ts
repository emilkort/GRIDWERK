/**
 * project-watcher.service.ts
 *
 * Watches configured DAW project folders with chokidar.
 * STRICTLY READ-ONLY: we observe filesystem events and write only to our
 * own SQLite database. We never rename, move, or modify actual DAW files.
 */
import chokidar from 'chokidar'
import * as path from 'path'
import * as fs from 'fs'
import { BrowserWindow } from 'electron'
import { getDb } from './database.service'
import { createProject, generateGroupKey } from './project.service'
import { normalizePath } from '../utils/paths'
import { extractPluginsFromAls } from './als-parser.service'
import type { Daw } from '../db/schema'

const watchers = new Map<number, chokidar.FSWatcher>()

/** Start watchers for every registered DAW on app startup. */
export function startWatchingAllDaws(win: BrowserWindow): void {
  try {
    const daws = getDb().prepare('SELECT * FROM daws').all() as Daw[]
    for (const daw of daws) {
      startWatchingDaw(daw, win)
    }
    importUnlinkedDawProjects(win)
  } catch (err) {
    console.error('[Watcher] Failed to start watchers:', err)
  }
}

/**
 * Auto-import any daw_projects rows that don't yet have a linked project card.
 * Runs on every app startup so existing DAW files get cards immediately.
 */
export function importUnlinkedDawProjects(win: BrowserWindow): void {
  const db = getDb()
  const unlinked = db.prepare(`
    SELECT dp.id, dp.file_name
    FROM daw_projects dp
    WHERE NOT EXISTS (
      SELECT 1 FROM projects p WHERE p.daw_project_id = dp.id
    )
  `).all() as { id: number; file_name: string }[]

  if (unlinked.length === 0) return

  for (const dp of unlinked) {
    try {
      const title = dp.file_name.replace(/\.[^.]+$/, '')
      const groupKey = generateGroupKey(title)
      const allProjects = db.prepare('SELECT title, stage FROM projects').all() as { title: string; stage: string }[]
      const siblingStage = allProjects.find(p => generateGroupKey(p.title) === groupKey)?.stage
      const project = createProject({ title, dawProjectId: dp.id, stage: siblingStage })
      notify(win, { event: 'add', dawProjectId: dp.id, projectId: project.id, fileName: dp.file_name })
    } catch (err) {
      console.error('[Watcher] importUnlinkedDawProjects error:', err)
    }
  }

  console.log(`[Watcher] Auto-imported ${unlinked.length} DAW project(s) into tracker`)
}

/** Start (or restart) the watcher for a single DAW. Called after register/edit. */
export function startWatchingDaw(daw: Daw, win: BrowserWindow): void {
  stopWatchingDaw(daw.id)

  let folders: string[]
  try {
    folders = (JSON.parse(daw.project_folders) as string[]).filter((f) => fs.existsSync(f))
  } catch {
    return
  }
  if (folders.length === 0) return

  const ext = daw.project_extension.toLowerCase()

  const watcher = chokidar.watch(folders, {
    ignored: /(^|[/\\])\../, // ignore dot-files / hidden dirs
    persistent: true,
    ignoreInitial: true,     // existing files handled by on-demand scan
    depth: 8,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 }
  })

  watcher
    .on('add', (filePath) => {
      if (!filePath.toLowerCase().endsWith(ext)) return
      handleAdd(daw.id, filePath, win)
    })
    .on('change', (filePath) => {
      if (!filePath.toLowerCase().endsWith(ext)) return
      handleChange(filePath, win)
    })
    .on('unlink', (filePath) => {
      if (!filePath.toLowerCase().endsWith(ext)) return
      handleUnlink(filePath, win)
    })
    .on('error', (err) => console.error('[Watcher] error:', err))

  watchers.set(daw.id, watcher)
  console.log(`[Watcher] Watching ${folders.length} folder(s) for DAW "${daw.name}"`)
}

export function stopWatchingDaw(dawId: number): void {
  const w = watchers.get(dawId)
  if (w) { w.close(); watchers.delete(dawId) }
}

export function stopAllWatchers(): void {
  for (const w of watchers.values()) w.close()
  watchers.clear()
}

// ── Event handlers (read-only on the filesystem) ─────────────────────────────

function handleAdd(dawId: number, filePath: string, win: BrowserWindow): void {
  const db = getDb()
  const normalized = normalizePath(filePath)
  const fileName = path.basename(filePath)

  try {
    const stat = fs.statSync(filePath)

    // Upsert daw_project row (DB write only — file is untouched)
    const insert = db.prepare(
      'INSERT OR IGNORE INTO daw_projects (daw_id, file_path, file_name, file_size, last_modified) VALUES (?, ?, ?, ?, ?)'
    )
    const insertResult = insert.run(dawId, normalized, fileName, stat.size, Math.floor(stat.mtimeMs / 1000))

    let dawProjectId = Number(insertResult.lastInsertRowid)
    if (!dawProjectId) {
      const existing = db
        .prepare('SELECT id FROM daw_projects WHERE file_path = ?')
        .get(normalized) as { id: number } | undefined
      dawProjectId = existing?.id ?? 0
    }
    if (!dawProjectId) return

    // Skip auto-create if a project already links to this daw_project
    const linked = db
      .prepare('SELECT id FROM projects WHERE daw_project_id = ?')
      .get(dawProjectId) as { id: number } | undefined
    if (linked) {
      notify(win, { event: 'change', dawProjectId, fileName })
      return
    }

    // Auto-create a project card — title derived from filename (no extension)
    const title = path.basename(filePath, path.extname(filePath))

    // If a sibling project with the same group key already exists, inherit its stage
    // so new versions stay in the same Kanban column (e.g. "In Progress")
    const groupKey = generateGroupKey(title)
    const allProjects = db.prepare('SELECT title, stage FROM projects').all() as { title: string; stage: string }[]
    const siblingStage = allProjects.find(p => generateGroupKey(p.title) === groupKey)?.stage

    const project = createProject({ title, dawProjectId, stage: siblingStage })

    // Extract plugins from Ableton .als files
    if (filePath.toLowerCase().endsWith('.als')) {
      try { saveProjectPlugins(project.id, filePath) } catch { /* best-effort */ }
    }

    notify(win, { event: 'add', dawProjectId, projectId: project.id, fileName })
  } catch (err) {
    console.error('[Watcher] handleAdd error:', err)
  }
}

function handleChange(filePath: string, win: BrowserWindow): void {
  const db = getDb()
  const normalized = normalizePath(filePath)

  try {
    const stat = fs.statSync(filePath)

    // Update file metadata in our DB (DB write only — file is untouched)
    db.prepare(
      'UPDATE daw_projects SET file_size = ?, last_modified = ? WHERE file_path = ?'
    ).run(stat.size, Math.floor(stat.mtimeMs / 1000), normalized)

    // Touch the linked project's updated_at so the card shows the new time
    db.prepare(
      "UPDATE projects SET updated_at = strftime('%s','now') WHERE daw_project_id = (SELECT id FROM daw_projects WHERE file_path = ?)"
    ).run(normalized)

    const row = db
      .prepare('SELECT id FROM daw_projects WHERE file_path = ?')
      .get(normalized) as { id: number } | undefined

    // Re-extract plugins on change (user may have added/removed plugins)
    if (filePath.toLowerCase().endsWith('.als') && row?.id) {
      const project = db.prepare('SELECT id FROM projects WHERE daw_project_id = ?').get(row.id) as { id: number } | undefined
      if (project) {
        try { saveProjectPlugins(project.id, filePath) } catch { /* best-effort */ }
      }
    }

    notify(win, { event: 'change', dawProjectId: row?.id ?? 0, fileName: path.basename(filePath) })
  } catch (err) {
    console.error('[Watcher] handleChange error:', err)
  }
}

function handleUnlink(filePath: string, win: BrowserWindow): void {
  const db = getDb()
  const normalized = normalizePath(filePath)

  try {
    const row = db
      .prepare('SELECT id FROM daw_projects WHERE file_path = ?')
      .get(normalized) as { id: number } | undefined
    if (!row) return

    // Unlink project (keep the card so user doesn't lose their notes/todos)
    db.prepare('UPDATE projects SET daw_project_id = NULL WHERE daw_project_id = ?').run(row.id)
    db.prepare('DELETE FROM daw_projects WHERE id = ?').run(row.id)

    notify(win, { event: 'unlink', dawProjectId: row.id, fileName: path.basename(filePath) })
  } catch (err) {
    console.error('[Watcher] handleUnlink error:', err)
  }
}

/** Extract plugins from an .als file and save to project_plugins table */
function saveProjectPlugins(projectId: number, alsPath: string): void {
  const plugins = extractPluginsFromAls(alsPath)
  if (plugins.length === 0) return

  const db = getDb()
  const upsert = db.prepare(
    'INSERT OR REPLACE INTO project_plugins (project_id, plugin_name, format, file_name) VALUES (?, ?, ?, ?)'
  )
  const tx = db.transaction(() => {
    for (const p of plugins) {
      upsert.run(projectId, p.name, p.format, p.fileName ?? null)
    }
  })
  tx()
  console.log(`[Watcher] Extracted ${plugins.length} plugins from project ${projectId}`)
}

function notify(
  win: BrowserWindow,
  data: { event: string; dawProjectId: number; fileName: string; projectId?: number }
): void {
  try {
    if (!win.isDestroyed()) win.webContents.send('project:daw-changed', data)
  } catch {}
}
