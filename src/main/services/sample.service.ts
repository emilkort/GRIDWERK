import { getDb } from './database.service'
import * as path from 'path'
import * as fs from 'fs'
import { normalizePath, AUDIO_EXTENSIONS } from '../utils/paths'
import type { SampleFolder, Sample } from '../db/schema'
import { BrowserWindow } from 'electron'
import { rebuildSearchIndex } from './search.service'
import { parseNaturalLanguageQuery } from './nlp-search.service'

export function addFolder(data: { folderPath: string; label?: string }): SampleFolder {
  const db = getDb()
  const normalized = normalizePath(data.folderPath)
  const label = data.label || path.basename(normalized)
  const result = db
    .prepare('INSERT INTO sample_folders (folder_path, label) VALUES (?, ?)')
    .run(normalized, label)
  return db.prepare('SELECT * FROM sample_folders WHERE id = ?').get(result.lastInsertRowid) as SampleFolder
}

export function listFolders(): SampleFolder[] {
  return getDb().prepare('SELECT * FROM sample_folders ORDER BY label').all() as SampleFolder[]
}

export function deleteFolder(folderId: number): void {
  getDb().prepare('DELETE FROM sample_folders WHERE id = ?').run(folderId)
}

export async function scanFolder(folderId: number, win?: BrowserWindow | null): Promise<Sample[]> {
  const db = getDb()
  const folder = db.prepare('SELECT * FROM sample_folders WHERE id = ?').get(folderId) as SampleFolder | undefined
  if (!folder) throw new Error(`Sample folder not found: ${folderId}`)

  const files: { filePath: string; fileName: string; ext: string; size: number; mtime: number }[] = []
  walkAudioFiles(folder.folder_path, files)

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO samples (folder_id, file_path, file_path_fwd, file_name, file_extension, file_size, last_modified, category)
     VALUES (?, ?, LOWER(REPLACE(?, char(92), '/')), ?, ?, ?, ?, ?)`
  )

  const insertAll = db.transaction(() => {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const category = categorizeByFilename(f.filePath)
      insertStmt.run(folderId, f.filePath, f.filePath, f.fileName, f.ext, f.size, f.mtime, category)

      if (win && i % 20 === 0) {
        win.webContents.send('scan:progress', {
          scanType: 'sample',
          current: i + 1,
          total: files.length,
          currentFile: f.fileName
        })
      }
    }
  })

  insertAll()

  // Quick metadata pass: extract duration/sample_rate/channels/bit_depth from headers
  const { extractQuickMetadata } = await import('./audio-analysis.service')
  const unprocessed = db
    .prepare('SELECT * FROM samples WHERE folder_id = ? AND duration_ms IS NULL')
    .all(folderId) as Sample[]

  const updateStmt = db.prepare(
    `UPDATE samples SET duration_ms = ?, sample_rate = ?, channels = ?, bit_depth = ?, updated_at = strftime('%s','now') WHERE id = ?`
  )

  const BATCH_SIZE = 5
  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    const chunk = unprocessed.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      chunk.map(async (s) => {
        try {
          return { sample: s, meta: await extractQuickMetadata(s.file_path) }
        } catch {
          return { sample: s, meta: null }
        }
      })
    )

    for (const { sample: s, meta } of results) {
      if (meta && meta.duration_ms !== null) {
        updateStmt.run(meta.duration_ms, meta.sample_rate, meta.channels, meta.bit_depth, s.id)
      }
    }

    if (win) {
      const progress = Math.min(i + BATCH_SIZE, unprocessed.length)
      win.webContents.send('scan:progress', {
        scanType: 'metadata',
        current: progress,
        total: unprocessed.length,
        currentFile: chunk[chunk.length - 1].file_name
      })
    }
  }

  // Rebuild FTS5 search index after scan
  rebuildSearchIndex()

  return db.prepare('SELECT * FROM samples WHERE folder_id = ? ORDER BY file_name').all(folderId) as Sample[]
}

function walkAudioFiles(
  dir: string,
  results: { filePath: string; fileName: string; ext: string; size: number; mtime: number }[]
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
      walkAudioFiles(fullPath, results)
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (AUDIO_EXTENSIONS.has(ext)) {
        try {
          const stat = fs.statSync(fullPath)
          results.push({
            filePath: normalizePath(fullPath),
            fileName: entry.name,
            ext,
            size: stat.size,
            mtime: Math.floor(stat.mtimeMs / 1000)
          })
        } catch { /* skip */ }
      }
    }
  }
}

// Comprehensive category patterns — covers Splice, Cymatics, Loopmasters, NI conventions
const CATEGORY_PATTERNS: [string, RegExp][] = [
  ['kick',       /\b(kick|kik|kck|bd|bass[\s_-]?drum|boom)\b/i],
  ['snare',      /\b(snare|snr|sn|sd|rimshot|rim)\b/i],
  ['hi-hat',     /\b(hi[\s_-]?hat|hh|hat|hihat|high[\s_-]?hat)\b/i],
  ['clap',       /\b(clap|clp|cp|handclap|snap)\b/i],
  ['percussion', /\b(perc|percussion|conga|bongo|shaker|tambourine|tamb|cowbell|clave|woodblock|timbale|tabla|djembe|cajon|tom)\b/i],
  ['bass',       /\b(bass|sub|808[\s_-]?bass|low[\s_-]?end)\b/i],
  ['vocal',      /\b(vocal|vox|voice|sing|choir|chant|adlib|acapella)\b/i],
  ['fx',         /\b(fx|sfx|effect|riser|uplifter|downlifter|impact|sweep|transition|whoosh|swell|noise|glitch|reverse|foley)\b/i],
  ['pad',        /\b(pad|ambient|atmo|atmosphere|drone|texture|evolving)\b/i],
  ['synth',      /\b(synth|lead|pluck|arp|stab|bell|mallet)\b/i],
  ['keys',       /\b(keys|piano|organ|rhodes|keyboard|clavinet|electric[\s_-]?piano)\b/i],
  ['guitar',     /\b(guitar|gtr|string|strum)\b/i],
  ['loop',       /\b(loop|break|groove|pattern|phrase|beat)\b/i],
  ['one-shot',   /\b(one[\s_-]?shot|oneshot|hit)\b/i],
]

function categorizeByFilename(filePath: string): string {
  const fileName = path.basename(filePath, path.extname(filePath))

  // Check filename first (highest priority)
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    // Skip "bass" if "bass drum" is in the text (that's a kick)
    if (category === 'bass' && /\bbass[\s_-]?drum\b/i.test(fileName)) continue
    if (pattern.test(fileName)) return category
  }

  // Check each path segment from right to left (immediate parent > grandparent)
  const segments = filePath.replace(/\\/g, '/').split('/')
  // Skip the last segment (filename) — already checked above
  for (let i = segments.length - 2; i >= 0; i--) {
    const segment = segments[i]
    for (const [category, pattern] of CATEGORY_PATTERNS) {
      if (category === 'bass' && /\bbass[\s_-]?drum\b/i.test(segment)) continue
      if (pattern.test(segment)) return category
    }
  }

  return 'other'
}

export function toggleFavorite(sampleId: number): number {
  const db = getDb()
  db.prepare(
    "UPDATE samples SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = strftime('%s','now') WHERE id = ?"
  ).run(sampleId)
  const row = db.prepare('SELECT is_favorite FROM samples WHERE id = ?').get(sampleId) as { is_favorite: number } | undefined
  return row?.is_favorite ?? 0
}

export function listSamples(filters?: {
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
  analyzedFilter?: 'all' | 'analyzed' | 'unanalyzed'
  limit?: number
  offset?: number
  skipCount?: boolean
}): { samples: Sample[]; total: number } {
  const db = getDb()
  // Exclude waveform_data BLOB from list — loaded on-demand via IPC
  const hasTagFilter = (filters?.tagIds?.length ?? 0) > 0
  // Only DISTINCT when the tag JOIN could produce duplicate rows
  let sql = `SELECT ${hasTagFilter ? 'DISTINCT ' : ''}s.id, s.folder_id, s.file_path, s.file_name, s.file_extension, s.file_size,
    s.duration_ms, s.sample_rate, s.channels, s.bit_depth, s.bpm, s.bpm_confidence, s.musical_key, s.key_confidence, s.category,
    NULL AS waveform_data,
    CASE WHEN s.waveform_data IS NOT NULL THEN 1 ELSE 0 END AS has_waveform,
    s.is_favorite,
    s.spectral_centroid, s.spectral_flatness, s.zero_crossing_rate, s.attack_time_ms, s.onset_count,
    s.last_modified, s.created_at, s.updated_at
    FROM samples s`
  const params: any[] = []

  // Tag filter via JOIN
  if (hasTagFilter) {
    const placeholders = filters!.tagIds!.map(() => '?').join(',')
    sql += ` JOIN taggables tg ON tg.entity_id = s.id AND tg.entity_type = 'sample' AND tg.tag_id IN (${placeholders})`
    params.push(...filters!.tagIds!)
  }

  sql += ' WHERE 1=1'

  if (filters?.folderId) {
    sql += ' AND s.folder_id = ?'
    params.push(filters.folderId)
  }
  if (filters?.subfolderPath) {
    // Escape LIKE wildcards (% and _) in the path, then match as prefix
    const normalizedSub = filters.subfolderPath
      .replace(/\\/g, '/')
      .toLowerCase()
      .replace(/[%_]/g, '\\$&')
    sql += " AND s.file_path_fwd LIKE ? ESCAPE '\\'"
    params.push(normalizedSub + '/%')
  }
  if (filters?.category && filters.category !== 'All') {
    sql += ' AND s.category = ?'
    params.push(filters.category)
  }
  if (filters?.bpmMin) {
    sql += ' AND s.bpm >= ?'
    params.push(filters.bpmMin)
  }
  if (filters?.bpmMax) {
    sql += ' AND s.bpm <= ?'
    params.push(filters.bpmMax)
  }
  if (filters?.key) {
    sql += ' AND s.musical_key = ?'
    params.push(filters.key)
  }
  if (filters?.search) {
    const nlp = parseNaturalLanguageQuery(filters.search)
    for (let i = 0; i < nlp.conditions.length; i++) {
      sql += ` AND ${nlp.conditions[i]}`
    }
    params.push(...nlp.params)
    // Any remaining text after NLP extraction → filename search
    if (nlp.remainingSearch) {
      sql += ' AND s.file_name LIKE ?'
      params.push(`%${nlp.remainingSearch}%`)
    }
  }
  if (filters?.isFavorites) {
    sql += ' AND s.is_favorite = 1'
  }
  if (filters?.analyzedFilter === 'analyzed') {
    sql += ' AND s.waveform_data IS NOT NULL'
  } else if (filters?.analyzedFilter === 'unanalyzed') {
    sql += ' AND s.waveform_data IS NULL'
  }

  // Count total matching rows (for pagination) — skip when caller already knows the total
  let total = -1
  if (!filters?.skipCount) {
    const fromIdx = sql.indexOf('FROM samples')
    const countSql = `SELECT COUNT(${hasTagFilter ? 'DISTINCT s.id' : '*'}) as total ` + sql.slice(fromIdx)
    total = (db.prepare(countSql).get(...params) as { total: number }).total
  }

  const sortColMap: Record<string, string> = {
    name: 's.file_name',
    bpm: 's.bpm',
    key: 's.musical_key',
    duration: 's.duration_ms'
  }
  const sortCol = filters?.sortBy ? (sortColMap[filters.sortBy] ?? 's.file_name') : 's.file_name'
  const sortDir = filters?.sortDir === 'desc' ? 'DESC' : 'ASC'
  sql += ` ORDER BY ${sortCol} ${sortDir} NULLS LAST`

  const selectParams = [...params]
  if (filters?.limit != null) {
    sql += ` LIMIT ? OFFSET ?`
    selectParams.push(filters.limit, filters.offset ?? 0)
  }

  const samples = db.prepare(sql).all(...selectParams) as Sample[]
  return { samples, total }
}

export function getSubfolderTree(folderId: number): { subPath: string; count: number }[] {
  const db = getDb()
  const folder = db
    .prepare('SELECT folder_path FROM sample_folders WHERE id = ?')
    .get(folderId) as { folder_path: string } | undefined
  if (!folder) return []

  const prefix = folder.folder_path.replace(/\\/g, '/') + '/'
  const rows = db
    .prepare('SELECT file_path FROM samples WHERE folder_id = ?')
    .all(folderId) as { file_path: string }[]

  const folderCounts = new Map<string, number>()
  for (const row of rows) {
    const normalized = row.file_path.replace(/\\/g, '/')
    if (!normalized.startsWith(prefix)) continue
    const relative = normalized.slice(prefix.length)
    const parts = relative.split('/')
    let current = ''
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? current + '/' + parts[i] : parts[i]
      folderCounts.set(current, (folderCounts.get(current) || 0) + 1)
    }
  }

  return Array.from(folderCounts.entries())
    .map(([subPath, count]) => ({ subPath, count }))
    .sort((a, b) => a.subPath.localeCompare(b.subPath))
}

export function getTotalSampleCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM samples').get() as { count: number }
  return row.count
}

export function getSample(sampleId: number): Sample | undefined {
  return getDb().prepare('SELECT * FROM samples WHERE id = ?').get(sampleId) as Sample | undefined
}

export function updateSample(
  sampleId: number,
  data: Partial<Pick<Sample, 'bpm' | 'musical_key' | 'category' | 'duration_ms' | 'sample_rate' | 'channels' | 'bit_depth' | 'waveform_data' | 'embedding' | 'bpm_confidence' | 'key_confidence' | 'waveform_hash' | 'spectral_centroid' | 'spectral_flatness' | 'zero_crossing_rate' | 'attack_time_ms' | 'onset_count'>>
): void {
  const db = getDb()
  const sets: string[] = []
  const params: any[] = []

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`)
    params.push(value)
  }

  if (sets.length === 0) return

  sets.push("updated_at = strftime('%s','now')")
  params.push(sampleId)

  db.prepare(`UPDATE samples SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

// Camelot wheel for key compatibility
const CAMELOT_MAP: Record<string, string> = {
  'C maj': '8B', 'G maj': '9B', 'D maj': '10B', 'A maj': '11B',
  'E maj': '12B', 'B maj': '1B', 'F# maj': '2B', 'Db maj': '3B',
  'Ab maj': '4B', 'Eb maj': '5B', 'Bb maj': '6B', 'F maj': '7B',
  'A min': '8A', 'E min': '9A', 'B min': '10A', 'F# min': '11A',
  'C# min': '12A', 'G# min': '1A', 'Eb min': '2A', 'Bb min': '3A',
  'F min': '4A', 'C min': '5A', 'G min': '6A', 'D min': '7A',
}

function getCompatibleKeys(key: string): string[] {
  const camelot = CAMELOT_MAP[key]
  if (!camelot) return [key]

  const num = parseInt(camelot)
  const letter = camelot.slice(-1)
  const otherLetter = letter === 'A' ? 'B' : 'A'

  const compatible = new Set<string>()
  compatible.add(key) // exact match

  // Same position (relative major/minor)
  // +1 and -1 on the wheel
  const nums = [num, ((num - 2 + 12) % 12) + 1, (num % 12) + 1]
  for (const n of nums) {
    const codeA = `${n}A`
    const codeB = `${n}B`
    for (const [k, c] of Object.entries(CAMELOT_MAP)) {
      if (c === codeA || c === codeB) compatible.add(k)
    }
  }
  // Also add same number opposite ring
  const opposite = `${num}${otherLetter}`
  for (const [k, c] of Object.entries(CAMELOT_MAP)) {
    if (c === opposite) compatible.add(k)
  }

  return [...compatible]
}

export function findMatchingSamples(
  bpm: number | null,
  key: string | null,
  limit = 20
): Sample[] {
  const db = getDb()
  const conditions: string[] = []
  const params: any[] = []

  if (bpm != null) {
    const bpmLow = Math.round(bpm * 0.95)
    const bpmHigh = Math.round(bpm * 1.05)
    conditions.push('s.bpm BETWEEN ? AND ?')
    params.push(bpmLow, bpmHigh)
  }

  if (key != null) {
    const compatibleKeys = getCompatibleKeys(key)
    conditions.push(`s.musical_key IN (${compatibleKeys.map(() => '?').join(',')})`)
    params.push(...compatibleKeys)
  }

  if (conditions.length === 0) return []

  params.push(limit)

  return db.prepare(
    `SELECT s.id, s.file_name, s.file_path, s.category, s.bpm, s.musical_key, s.duration_ms,
       s.is_favorite, s.file_extension
     FROM samples s
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE WHEN s.bpm IS NOT NULL AND s.musical_key IS NOT NULL THEN 0
            WHEN s.musical_key IS NOT NULL THEN 1
            ELSE 2 END,
       RANDOM()
     LIMIT ?`
  ).all(...params) as Sample[]
}

export function deleteSample(sampleId: number, deleteFromDisk: boolean): { deleted: boolean; filePath?: string } {
  const db = getDb()
  const sample = db.prepare('SELECT id, file_path FROM samples WHERE id = ?').get(sampleId) as { id: number; file_path: string } | undefined
  if (!sample) return { deleted: false }

  // Remove from DB (cascades to taggables, search_index entries)
  db.prepare('DELETE FROM taggables WHERE entity_type = ? AND entity_id = ?').run('sample', sampleId)
  db.prepare('DELETE FROM samples WHERE id = ?').run(sampleId)

  if (deleteFromDisk) {
    try {
      const fsPath = sample.file_path.replace(/\//g, '\\')
      fs.unlinkSync(fsPath)
    } catch (err) {
      console.error(`[Sample] Failed to delete file: ${sample.file_path}`, err)
    }
  }

  return { deleted: true, filePath: sample.file_path }
}
