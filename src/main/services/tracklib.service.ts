/**
 * tracklib.service.ts
 *
 * Integrates with Tracklib sample library:
 * - Auto-detects the Tracklib download folder on the user's system
 * - Scans and imports downloaded samples into the app's database
 * - Parses metadata from Tracklib filenames (artist, title, BPM, key)
 *
 * Note: Tracklib has no public API. This integration only works with
 * locally downloaded files to respect their Terms of Service.
 */
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { getDb } from './database.service'
import { AUDIO_EXTENSIONS } from '../utils/paths'

const POSSIBLE_TRACKLIB_PATHS = [
  path.join(os.homedir(), 'Documents', 'Tracklib'),
  path.join(os.homedir(), 'Downloads', 'Tracklib'),
  path.join(os.homedir(), 'Music', 'Tracklib'),
  path.join(process.env.APPDATA || '', 'Tracklib'),
  path.join(process.env.LOCALAPPDATA || '', 'Tracklib', 'Downloads'),
  path.join(process.env.LOCALAPPDATA || '', 'Tracklib')
]

export interface TracklibDetectResult {
  found: boolean
  folderPath: string | null
}

export interface ParsedTracklibFilename {
  artist: string | null
  title: string | null
  bpm: number | null
  key: string | null
}

// ── Detection ──────────────────────────────────────────────────────

export function detectTracklibFolder(): TracklibDetectResult {
  for (const p of POSSIBLE_TRACKLIB_PATHS) {
    if (!p) continue
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        // Verify it has audio files (not just an empty folder)
        const entries = fs.readdirSync(p, { withFileTypes: true })
        const hasAudio = entries.some(e =>
          e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase())
        ) || entries.some(e => e.isDirectory()) // subdirectories likely contain audio
        if (hasAudio) {
          return { found: true, folderPath: p }
        }
      }
    } catch { /* permission errors, etc. */ }
  }

  return { found: false, folderPath: null }
}

// ── Filename parsing ──────────────────────────────────────────────

/**
 * Parse metadata from Tracklib-style filenames.
 * Common patterns:
 *   "Artist Name - Track Title - 95BPM - Am.wav"
 *   "Artist - Title (120 BPM).wav"
 *   "Artist_Track_Title.wav"
 */
export function parseTracklibFilename(filename: string): ParsedTracklibFilename {
  const base = path.basename(filename, path.extname(filename))
  const result: ParsedTracklibFilename = { artist: null, title: null, bpm: null, key: null }

  // Try to extract BPM (e.g., "95BPM", "95 BPM", "120bpm")
  const bpmMatch = base.match(/(\d{2,3})\s*bpm/i)
  if (bpmMatch) {
    result.bpm = parseInt(bpmMatch[1], 10)
    if (result.bpm < 40 || result.bpm > 300) result.bpm = null
  }

  // Try to extract musical key (e.g., "Am", "C# minor", "Dm", "F maj")
  const keyMatch = base.match(/\b([A-G][#b]?)\s*(maj(?:or)?|min(?:or)?|m(?!\w))\b/i)
  if (keyMatch) {
    const note = keyMatch[1]
    const quality = keyMatch[2].toLowerCase().startsWith('m') ? 'min' : 'maj'
    result.key = `${note} ${quality}`
  }

  // Split by common delimiters to get artist / title
  // Remove BPM and key portions first
  let cleaned = base
    .replace(/(\d{2,3})\s*bpm/i, '')
    .replace(/\b[A-G][#b]?\s*(?:maj(?:or)?|min(?:or)?|m(?!\w))\b/i, '')
    .replace(/[_]/g, ' ')
    .trim()

  const parts = cleaned.split(/\s*[-–—]\s*/).filter(p => p.trim().length > 0)

  if (parts.length >= 2) {
    result.artist = parts[0].trim()
    result.title = parts[1].trim()
  } else if (parts.length === 1) {
    result.title = parts[0].trim()
  }

  return result
}

// ── Sync from folder ──────────────────────────────────────────────

export function syncFromFolder(folderPath: string): { synced: number } {
  const appDb = getDb()
  let synced = 0

  if (!fs.existsSync(folderPath)) {
    console.warn('[Tracklib] Folder not found:', folderPath)
    return { synced: 0 }
  }

  const insertStmt = appDb.prepare(
    `INSERT OR IGNORE INTO samples
     (folder_id, file_path, file_path_fwd, file_name, file_extension, file_size,
      last_modified, category, source, is_cloud, pack_name, bpm, musical_key)
     VALUES (?, ?, LOWER(REPLACE(?, char(92), '/')), ?, ?, ?, ?, ?, 'tracklib', 0, ?, ?, ?)`
  )

  const txn = appDb.transaction(() => {
    walkTracklibFolder(folderPath, folderPath, insertStmt, () => { synced++ })
  })
  txn()

  // Update last_synced
  appDb.prepare(
    "UPDATE service_connections SET last_synced = strftime('%s','now') WHERE service = 'tracklib'"
  ).run()

  console.log(`[Tracklib] Synced ${synced} samples from folder`)
  return { synced }
}

function walkTracklibFolder(
  dir: string,
  rootDir: string,
  stmt: Database.Statement,
  onInsert: () => void
): void {
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkTracklibFolder(full, rootDir, stmt, onInsert)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!AUDIO_EXTENSIONS.has(ext)) continue

      let size = 0
      let mtime = 0
      try {
        const stat = fs.statSync(full)
        size = stat.size
        mtime = Math.floor(stat.mtimeMs / 1000)
      } catch { /* ignore */ }

      // Parse metadata from filename
      const parsed = parseTracklibFilename(entry.name)

      // Derive pack/collection name from parent folder
      const rel = path.relative(rootDir, full)
      const packName = rel.includes(path.sep) ? rel.split(path.sep)[0] : null

      stmt.run(
        null, // folder_id
        full,
        full,
        entry.name,
        ext,
        size,
        mtime,
        null, // category — auto-categorize later
        packName,
        parsed.bpm,
        parsed.key
      )
      onInsert()
    }
  }
}
