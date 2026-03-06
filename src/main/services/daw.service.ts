import { getDb } from './database.service'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import { normalizePath } from '../utils/paths'
import { extractPluginsFromAls } from './als-parser.service'
import type { Daw, DawProject } from '../db/schema'

const execFileAsync = promisify(execFile)

export async function registerDaw(data: {
  name: string
  executablePath: string
  projectExtension: string
  projectFolders: string[]
}): Promise<Daw> {
  const db = getDb()
  const normalizedExe = normalizePath(data.executablePath)
  const result = db
    .prepare(
      `INSERT INTO daws (name, executable_path, project_extension, project_folders)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      data.name,
      normalizedExe,
      data.projectExtension,
      JSON.stringify(data.projectFolders.map(normalizePath))
    )

  const daw = db.prepare('SELECT * FROM daws WHERE id = ?').get(result.lastInsertRowid) as Daw

  // Extract icon from executable
  const iconData = await extractDawIcon(normalizedExe)
  if (iconData) {
    db.prepare('UPDATE daws SET icon_data = ? WHERE id = ?').run(iconData, daw.id)
    daw.icon_data = iconData
  }

  return daw
}

export function listDaws(): Daw[] {
  return getDb().prepare('SELECT * FROM daws ORDER BY name').all() as Daw[]
}

export function deleteDaw(dawId: number): void {
  getDb().prepare('DELETE FROM daws WHERE id = ?').run(dawId)
}

export function launchDaw(dawId: number): void {
  const daw = getDb().prepare('SELECT * FROM daws WHERE id = ?').get(dawId) as Daw | undefined
  if (!daw) throw new Error(`DAW not found: ${dawId}`)

  spawn(daw.executable_path, [], {
    detached: true,
    stdio: 'ignore'
  }).unref()
}

export function scanProjects(dawId: number): DawProject[] {
  const db = getDb()
  const daw = db.prepare('SELECT * FROM daws WHERE id = ?').get(dawId) as Daw | undefined
  if (!daw) throw new Error(`DAW not found: ${dawId}`)

  const folders: string[] = JSON.parse(daw.project_folders)
  const ext = daw.project_extension
  const found: DawProject[] = []

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO daw_projects (daw_id, file_path, file_name, file_size, last_modified)
     VALUES (?, ?, ?, ?, ?)`
  )

  const insertMany = db.transaction((files: { filePath: string; fileName: string; size: number; mtime: number }[]) => {
    for (const f of files) {
      insertStmt.run(dawId, f.filePath, f.fileName, f.size, f.mtime)
    }
  })

  const files: { filePath: string; fileName: string; size: number; mtime: number }[] = []

  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue
    walkDirectory(folder, ext, files)
  }

  insertMany(files)

  // Extract plugins from Ableton .als files
  if (ext.toLowerCase() === '.als') {
    const upsert = db.prepare(
      'INSERT OR REPLACE INTO project_plugins (project_id, plugin_name, format, file_name) VALUES (?, ?, ?, ?)'
    )
    const allDawProjects = db.prepare(
      `SELECT dp.id as dpId, dp.file_path, p.id as projectId
       FROM daw_projects dp JOIN projects p ON p.daw_project_id = dp.id
       WHERE dp.daw_id = ?`
    ).all(dawId) as { dpId: number; file_path: string; projectId: number }[]

    for (const dp of allDawProjects) {
      try {
        // Resolve to actual filesystem path (stored paths use forward slashes)
        const fsPath = dp.file_path.replace(/\//g, '\\')
        if (!fs.existsSync(fsPath)) continue
        const plugins = extractPluginsFromAls(fsPath)
        for (const p of plugins) {
          upsert.run(dp.projectId, p.name, p.format, p.fileName ?? null)
        }
      } catch { /* skip unreadable files */ }
    }
  }

  return db.prepare('SELECT * FROM daw_projects WHERE daw_id = ? ORDER BY last_modified DESC').all(dawId) as DawProject[]
}

function walkDirectory(
  dir: string,
  ext: string,
  results: { filePath: string; fileName: string; size: number; mtime: number }[]
): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDirectory(fullPath, ext, results)
    } else if (entry.name.toLowerCase().endsWith(ext.toLowerCase())) {
      try {
        const stat = fs.statSync(fullPath)
        results.push({
          filePath: normalizePath(fullPath),
          fileName: entry.name,
          size: stat.size,
          mtime: Math.floor(stat.mtimeMs / 1000)
        })
      } catch {
        // Skip files we can't stat
      }
    }
  }
}

export function getProjects(dawId: number): DawProject[] {
  return getDb()
    .prepare('SELECT * FROM daw_projects WHERE daw_id = ? ORDER BY last_modified DESC')
    .all(dawId) as DawProject[]
}

export async function extractDawIcon(exePath: string): Promise<string | null> {
  if (process.platform !== 'win32') return null

  // Normalize to backslashes for PowerShell
  const winPath = exePath.replace(/\//g, '\\').replace(/'/g, "''")
  const psScript = `
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${winPath}')
if ($icon) {
  $bmp = $icon.ToBitmap()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Close()
  $bmp.Dispose()
  $icon.Dispose()
  [Convert]::ToBase64String($bytes)
}
`

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 10000 }
    )

    const base64 = stdout.trim()
    if (!base64) return null
    return `data:image/png;base64,${base64}`
  } catch (err) {
    console.error(`[DAW] Failed to extract icon from ${exePath}:`, err)
    return null
  }
}

export async function refreshDawIcon(dawId: number): Promise<string | null> {
  const db = getDb()
  const daw = db.prepare('SELECT * FROM daws WHERE id = ?').get(dawId) as Daw | undefined
  if (!daw) throw new Error(`DAW not found: ${dawId}`)

  const iconData = await extractDawIcon(daw.executable_path)
  if (iconData) {
    db.prepare('UPDATE daws SET icon_data = ? WHERE id = ?').run(iconData, dawId)
  }
  return iconData
}
