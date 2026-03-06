import { getDb } from './database.service'
import * as path from 'path'
import * as fs from 'fs'
import { normalizePath, resolveLnkTarget } from '../utils/paths'
import type { VstScanPath, VstPlugin } from '../db/schema'
import { BrowserWindow } from 'electron'
import { inferCategoryFromName } from '../utils/category-inference'
import { lookupPluginVendor } from '../utils/plugin-vendor-lookup'

// VST3 SDK Sub_Categories → human-readable subcategory
// Handles both compound ("Fx|EQ") and individual ("EQ") entries
const VST3_SUBCATEGORY_MAP: Record<string, string> = {
  // Compound strings (Fx|X and Instrument|X)
  'Fx|EQ': 'EQ',
  'Fx|Filter': 'Filter',
  'Fx|Dynamics': 'Dynamics',
  'Fx|Compressor': 'Compressor',
  'Fx|Limiter': 'Limiter',
  'Fx|Gate': 'Gate',
  'Fx|Expander': 'Expander',
  'Fx|Reverb': 'Reverb',
  'Fx|Delay': 'Delay',
  'Fx|Chorus': 'Chorus',
  'Fx|Flanger': 'Flanger',
  'Fx|Phaser': 'Phaser',
  'Fx|Distortion': 'Distortion',
  'Fx|Saturation': 'Saturation',
  'Fx|Modulation': 'Modulation',
  'Fx|Pitch Shift': 'Pitch Shift',
  'Fx|Restoration': 'Restoration',
  'Fx|Analyzer': 'Analyzer',
  'Fx|Spatial': 'Spatial',
  'Fx|Surround': 'Surround',
  'Fx|Mastering': 'Mastering',
  'Fx|Up-Downmix': 'Up-Downmix',
  'Fx|Tools': 'Tool',
  'Fx|Network': 'Network',
  'Instrument|Synth': 'Synth',
  'Instrument|Sampler': 'Sampler',
  'Instrument|Drum': 'Drum Machine',
  'Instrument|Piano': 'Piano',
  'Instrument|External': 'External',
  // Individual keywords (many plugins list sub-categories as separate strings)
  EQ: 'EQ',
  Filter: 'Filter',
  Dynamics: 'Dynamics',
  Compressor: 'Compressor',
  Limiter: 'Limiter',
  Gate: 'Gate',
  Expander: 'Expander',
  Reverb: 'Reverb',
  Delay: 'Delay',
  Chorus: 'Chorus',
  Flanger: 'Flanger',
  Phaser: 'Phaser',
  Distortion: 'Distortion',
  Saturation: 'Saturation',
  Modulation: 'Modulation',
  'Pitch Shift': 'Pitch Shift',
  Restoration: 'Restoration',
  Analyzer: 'Analyzer',
  Spatial: 'Spatial',
  Surround: 'Surround',
  Mastering: 'Mastering',
  'Up-Downmix': 'Up-Downmix',
  Synth: 'Synth',
  Sampler: 'Sampler',
  Drum: 'Drum Machine',
  Piano: 'Piano',
  External: 'External',
  Generator: 'Generator',
  Tools: 'Tool',
  Network: 'Network'
}

// Low-priority subcategories: only used when nothing more specific is available
const LOW_PRIORITY_SUBCATEGORIES = new Set(['Tool', 'Generator', 'Network'])

export function mapVst3Subcategories(
  subCategories: string[]
): { category: string; subcategory: string | null } {
  let category = 'Unknown'
  let subcategory: string | null = null
  let hasSpecific = false

  for (const sub of subCategories) {
    // Detect category
    if (sub.startsWith('Instrument') || sub === 'Instrument') {
      category = 'Instrument'
    } else if (sub.startsWith('Fx') || sub === 'Fx') {
      category = 'Effect'
    }

    // Try direct map lookup
    const mapped = VST3_SUBCATEGORY_MAP[sub]
    if (mapped) {
      if (!LOW_PRIORITY_SUBCATEGORIES.has(mapped)) {
        subcategory = mapped
        hasSpecific = true
      } else if (!hasSpecific) {
        subcategory = mapped
      }
    }

    // Try splitting compound entries and matching parts
    if (!hasSpecific && sub.includes('|')) {
      const parts = sub.split('|')
      for (let i = parts.length - 1; i >= 0; i--) {
        const partMapped = VST3_SUBCATEGORY_MAP[parts[i]]
        if (partMapped && !LOW_PRIORITY_SUBCATEGORIES.has(partMapped)) {
          subcategory = partMapped
          hasSpecific = true
          break
        }
      }
    }
  }

  return { category, subcategory }
}

/** Parse a single VST file/bundle and return metadata. Returns null if stat fails. */
export function parseVstFile(
  fullPath: string,
  format: 'VST2' | 'VST3'
): { filePath: string; name: string; size: number; mtime: number; vendor: string | null; category: string; subcategory: string | null } | null {
  if (format === 'VST3') {
    const pluginName = path.basename(fullPath, '.vst3')
    let vendor: string | null = lookupPluginVendor(pluginName)
    let category = 'Unknown'
    let subcategory: string | null = null

    const moduleInfoPath = path.join(fullPath, 'Contents', 'moduleinfo.json')
    if (fs.existsSync(moduleInfoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(moduleInfoPath, 'utf-8'))
        const factoryInfo = info['Factory Info'] || {}
        if (!vendor) vendor = factoryInfo.Vendor || info.Vendor || null
        if (info.Classes && info.Classes.length > 0) {
          const cls = info.Classes[0]
          if (cls.Sub_Categories) {
            const mapped = mapVst3Subcategories(cls.Sub_Categories)
            category = mapped.category
            subcategory = mapped.subcategory
          }
        }
      } catch { /* Can't parse moduleinfo */ }
    }

    try {
      const stat = fs.statSync(fullPath)
      return { filePath: normalizePath(fullPath), name: pluginName, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000), vendor, category, subcategory }
    } catch { return null }
  } else {
    // VST2 DLL
    const pluginName = path.basename(fullPath, '.dll')
    const vendor = lookupPluginVendor(pluginName)
    try {
      const stat = fs.statSync(fullPath)
      return { filePath: normalizePath(fullPath), name: pluginName, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000), vendor, category: 'Unknown', subcategory: null }
    } catch { return null }
  }
}

export function addScanPath(data: { folderPath: string; format: 'VST2' | 'VST3' }): VstScanPath {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO vst_scan_paths (folder_path, format) VALUES (?, ?)')
    .run(normalizePath(data.folderPath), data.format)
  return db.prepare('SELECT * FROM vst_scan_paths WHERE id = ?').get(result.lastInsertRowid) as VstScanPath
}

export function listScanPaths(): VstScanPath[] {
  return getDb().prepare('SELECT * FROM vst_scan_paths ORDER BY folder_path').all() as VstScanPath[]
}

export function deleteScanPath(scanPathId: number): void {
  getDb().prepare('DELETE FROM vst_scan_paths WHERE id = ?').run(scanPathId)
}

export function scanVstPath(scanPathId: number, win?: BrowserWindow | null): VstPlugin[] {
  const db = getDb()
  const scanPath = db.prepare('SELECT * FROM vst_scan_paths WHERE id = ?').get(scanPathId) as VstScanPath | undefined
  if (!scanPath) throw new Error(`Scan path not found: ${scanPathId}`)

  const ext = scanPath.format === 'VST3' ? '.vst3' : '.dll'
  const files: { filePath: string; name: string; size: number; mtime: number; vendor: string | null; category: string; subcategory: string | null }[] = []

  walkVstDirectory(scanPath.folder_path, ext, scanPath.format, files)

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO vst_plugins (scan_path_id, file_path, plugin_name, format, vendor, category, subcategory, file_size, last_modified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const insertAll = db.transaction(() => {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      insertStmt.run(scanPathId, f.filePath, f.name, scanPath.format, f.vendor, f.category, f.subcategory, f.size, f.mtime)

      if (win && i % 10 === 0) {
        win.webContents.send('scan:progress', {
          scanType: 'vst',
          current: i + 1,
          total: files.length,
          currentFile: f.name
        })
      }
    }
  })

  insertAll()

  // Apply keyword-based category inference for plugins still showing Unknown
  const unknownPlugins = db.prepare(
    'SELECT * FROM vst_plugins WHERE scan_path_id = ? AND (category IS NULL OR category = ?)'
  ).all(scanPathId, 'Unknown') as VstPlugin[]

  const updateCat = db.prepare('UPDATE vst_plugins SET category = ?, subcategory = COALESCE(subcategory, ?) WHERE id = ?')
  for (const p of unknownPlugins) {
    const inferred = inferCategoryFromName(p.plugin_name, p.vendor)
    if (inferred) {
      updateCat.run(inferred.category, inferred.subcategory, p.id)
    }
  }

  return db.prepare('SELECT * FROM vst_plugins WHERE scan_path_id = ? ORDER BY plugin_name').all(scanPathId) as VstPlugin[]
}

function walkVstDirectory(
  dir: string,
  ext: string,
  format: string,
  results: { filePath: string; name: string; size: number; mtime: number; vendor: string | null; category: string; subcategory: string | null }[],
  visited: Set<string> = new Set()
): void {
  // Cycle detection: resolve to real path and track visited directories
  let realDir: string
  try {
    realDir = fs.realpathSync(dir).toLowerCase()
  } catch {
    return
  }
  if (visited.has(realDir)) return
  visited.add(realDir)

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.name.toLowerCase().endsWith('.vst3')) {
      const parsed = parseVstFile(fullPath, 'VST3')
      if (parsed) results.push(parsed)
    } else if (entry.isDirectory() || entry.isSymbolicLink()) {
      // Follow real directories, symlinks, and junction points
      if (entry.isSymbolicLink()) {
        try {
          const stat = fs.statSync(fullPath)
          if (!stat.isDirectory()) continue
        } catch {
          continue // Broken symlink
        }
      }
      walkVstDirectory(fullPath, ext, format, results, visited)
    } else if (format === 'VST2' && entry.name.toLowerCase().endsWith('.dll')) {
      const parsed = parseVstFile(fullPath, 'VST2')
      if (parsed) results.push(parsed)
    } else if (entry.name.toLowerCase().endsWith('.lnk')) {
      // Windows .lnk shortcuts — resolve and recurse if target is a directory
      const target = resolveLnkTarget(fullPath)
      if (target) {
        try {
          const stat = fs.statSync(target)
          if (stat.isDirectory()) {
            walkVstDirectory(target, ext, format, results, visited)
          }
        } catch {
          // Target inaccessible
        }
      }
    }
  }
}

export function listPlugins(filters?: {
  category?: string
  subcategory?: string
  favorite?: boolean
  search?: string
}): VstPlugin[] {
  const db = getDb()
  let sql = 'SELECT * FROM vst_plugins WHERE is_hidden = 0'
  const params: any[] = []

  if (filters?.category && filters.category !== 'All') {
    sql += ' AND category = ?'
    params.push(filters.category)
  }
  if (filters?.subcategory && filters.subcategory !== 'All') {
    sql += ' AND subcategory = ?'
    params.push(filters.subcategory)
  }
  if (filters?.favorite) {
    sql += ' AND is_favorite = 1'
  }
  if (filters?.search) {
    sql += ' AND plugin_name LIKE ?'
    params.push(`%${filters.search}%`)
  }

  sql += ' ORDER BY plugin_name'
  return db.prepare(sql).all(...params) as VstPlugin[]
}

export function toggleFavorite(pluginId: number): void {
  getDb().prepare('UPDATE vst_plugins SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?').run(pluginId)
}

export function updateCategory(pluginId: number, category: string): void {
  getDb().prepare('UPDATE vst_plugins SET category = ? WHERE id = ?').run(category, pluginId)
}

export function setHidden(pluginId: number, hidden: boolean): void {
  getDb().prepare('UPDATE vst_plugins SET is_hidden = ? WHERE id = ?').run(hidden ? 1 : 0, pluginId)
}

export function listHiddenPlugins(): VstPlugin[] {
  return getDb().prepare('SELECT * FROM vst_plugins WHERE is_hidden = 1 ORDER BY plugin_name').all() as VstPlugin[]
}
