/**
 * splice.service.ts
 *
 * Integrates with Splice sample library:
 * - Auto-detects local Splice installation (download folder + sounds.db)
 * - Syncs downloaded samples from Splice's local sounds.db into the app's database
 * - Searches the Splice catalog via their unauthenticated GraphQL API
 */
import Database from 'better-sqlite3'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { net } from 'electron'
import { getDb } from './database.service'
import { AUDIO_EXTENSIONS } from '../utils/paths'

const DEFAULT_SPLICE_FOLDER = path.join(os.homedir(), 'Documents', 'Splice')
const SPLICE_GRAPHQL_URL = 'https://surfaces-graphql.splice.com/graphql'

export interface SpliceDetectResult {
  found: boolean
  folderPath: string | null
  dbPath: string | null
}

export interface SpliceCatalogSample {
  uuid: string
  name: string
  bpm: number | null
  key: string | null
  chordType: string | null
  duration: number | null
  category: string | null
  packName: string | null
  packSlug: string | null
  previewUrl: string | null
  tags: string[]
}

// ── Detection ──────────────────────────────────────────────────────

export function detectSpliceInstall(): SpliceDetectResult {
  // Check multiple possible locations
  const possibleFolders = [
    DEFAULT_SPLICE_FOLDER,
    path.join(os.homedir(), 'Splice'),
    path.join(os.homedir(), 'Music', 'Splice')
  ]

  for (const folder of possibleFolders) {
    if (fs.existsSync(folder)) {
      // Look for sounds.db
      const dbCandidates = [
        path.join(folder, 'sounds.db'),
        path.join(folder, '.splice', 'sounds.db'),
        path.join(os.homedir(), '.splice', 'sounds.db')
      ]
      const dbPath = dbCandidates.find(p => fs.existsSync(p)) ?? null

      return { found: true, folderPath: folder, dbPath }
    }
  }

  return { found: false, folderPath: null, dbPath: null }
}

// ── Local sync from Splice's sounds.db ──────────────────────────

export function syncFromSpliceDb(spliceDbPath: string, spliceFolderPath: string): { synced: number } {
  const appDb = getDb()
  let synced = 0

  if (!fs.existsSync(spliceDbPath)) {
    console.warn('[Splice] sounds.db not found at:', spliceDbPath)
    return { synced: 0 }
  }

  let spliceDb: Database.Database | null = null
  try {
    spliceDb = new Database(spliceDbPath, { readonly: true, fileMustExist: true })

    // Try to read the Splice DB schema — it varies between versions
    // Common tables: sounds, packs, downloaded_sounds
    const tables = spliceDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    const tableNames = new Set(tables.map(t => t.name))

    let rows: any[] = []

    if (tableNames.has('sounds') && tableNames.has('packs')) {
      // Newer Splice schema with sounds + packs
      rows = spliceDb.prepare(`
        SELECT s.*, p.name as pack_name
        FROM sounds s
        LEFT JOIN packs p ON s.pack_id = p.id
        WHERE s.downloaded = 1 OR s.file_path IS NOT NULL
      `).all()
    } else if (tableNames.has('samples')) {
      // Alternative schema
      rows = spliceDb.prepare('SELECT * FROM samples WHERE file_path IS NOT NULL').all()
    }

    if (rows.length === 0) {
      // Fallback: just scan the Splice folder directly for audio files
      return syncFromSpliceFolder(spliceFolderPath)
    }

    const insertStmt = appDb.prepare(
      `INSERT OR IGNORE INTO samples
       (folder_id, file_path, file_path_fwd, file_name, file_extension, file_size,
        last_modified, category, source, source_id, is_cloud, pack_name, source_tags, bpm, musical_key)
       VALUES (?, ?, LOWER(REPLACE(?, char(92), '/')), ?, ?, ?, ?, ?, 'splice', ?, 0, ?, ?, ?, ?)`
    )

    const txn = appDb.transaction(() => {
      for (const row of rows) {
        const filePath = row.file_path || row.path
        if (!filePath || !fs.existsSync(filePath)) continue

        const fileName = path.basename(filePath)
        const ext = path.extname(filePath).toLowerCase()
        if (!AUDIO_EXTENSIONS.has(ext)) continue

        let size = 0
        try { size = fs.statSync(filePath).size } catch { /* ignore */ }

        const tags = row.tags ? JSON.stringify(
          typeof row.tags === 'string' ? row.tags.split(',').map((t: string) => t.trim()) : []
        ) : null

        insertStmt.run(
          null, // folder_id — no folder association for service samples
          filePath,
          filePath,
          fileName,
          ext,
          size,
          Math.floor(Date.now() / 1000),
          row.instrument || row.category || categorizeFromSpliceTags(row.tags),
          row.uuid || row.id?.toString() || null,
          row.pack_name || null,
          tags,
          row.bpm || null,
          row.key ? formatSpliceKey(row.key, row.chord_type) : null
        )
        synced++
      }
    })
    txn()

    // Update last_synced
    appDb.prepare(
      "UPDATE service_connections SET last_synced = strftime('%s','now') WHERE service = 'splice'"
    ).run()

    console.log(`[Splice] Synced ${synced} samples from sounds.db`)
  } catch (err) {
    console.error('[Splice] Failed to sync from sounds.db:', err)
  } finally {
    spliceDb?.close()
  }

  return { synced }
}

/** Fallback: scan the Splice download folder directly */
export function syncFromSpliceFolder(folderPath: string): { synced: number } {
  const appDb = getDb()
  let synced = 0

  if (!fs.existsSync(folderPath)) return { synced: 0 }

  const insertStmt = appDb.prepare(
    `INSERT OR IGNORE INTO samples
     (folder_id, file_path, file_path_fwd, file_name, file_extension, file_size,
      last_modified, category, source, is_cloud, pack_name)
     VALUES (?, ?, LOWER(REPLACE(?, char(92), '/')), ?, ?, ?, ?, ?, 'splice', 0, ?)`
  )

  const txn = appDb.transaction(() => {
    walkAndInsert(folderPath, folderPath, insertStmt, () => synced++)
  })
  txn()

  appDb.prepare(
    "UPDATE service_connections SET last_synced = strftime('%s','now') WHERE service = 'splice'"
  ).run()

  console.log(`[Splice] Synced ${synced} samples from folder`)
  return { synced }
}

function walkAndInsert(
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
      walkAndInsert(full, rootDir, stmt, onInsert)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!AUDIO_EXTENSIONS.has(ext)) continue

      let size = 0
      try { size = fs.statSync(full).size } catch { /* ignore */ }

      // Derive pack name from the first subdirectory under the root
      const rel = path.relative(rootDir, full)
      const packName = rel.includes(path.sep) ? rel.split(path.sep)[0] : null

      stmt.run(
        null, full, full, entry.name, ext, size,
        Math.floor(Date.now() / 1000),
        null, // category — will be auto-categorized later
        packName
      )
      onInsert()
    }
  }
}

// ── Catalog search via GraphQL ──────────────────────────────────

const SAMPLES_SEARCH_QUERY = `
query SamplesSearch(
  $query: String, $order: SortOrder, $sort: AssetSortType,
  $tags: [ID], $key: String, $chord_type: String,
  $min_bpm: Int, $max_bpm: Int, $limit: Int, $page: Int
) {
  assetsSearch(
    filter: {
      legacy: true, published: true, asset_type_slug: sample,
      query: $query, tag_ids: $tags, key: $key, chord_type: $chord_type,
      min_bpm: $min_bpm, max_bpm: $max_bpm
    }
    pagination: { page: $page, limit: $limit }
    sort: { sort: $sort, order: $order }
  ) {
    items {
      uuid
      name
      tags { uuid label }
      files { uuid name asset_file_type_slug url }
      parents {
        items { uuid name permalink_slug }
      }
      bpm
      key
      chord_type
      duration
      asset_category_slug
    }
    pagination_metadata { currentPage totalPages }
    response_metadata { records }
  }
}`

export async function searchCatalog(
  query: string,
  options?: { limit?: number; page?: number; key?: string; minBpm?: number; maxBpm?: number }
): Promise<{ samples: SpliceCatalogSample[]; totalPages: number; totalRecords: number }> {
  const variables = {
    query,
    order: 'DESC',
    sort: 'relevance',
    limit: options?.limit ?? 30,
    page: options?.page ?? 1,
    tags: [],
    key: options?.key ?? null,
    chord_type: null,
    min_bpm: options?.minBpm ?? null,
    max_bpm: options?.maxBpm ?? null
  }

  const body = JSON.stringify({
    operationName: 'SamplesSearch',
    query: SAMPLES_SEARCH_QUERY,
    variables
  })

  // Use Electron's net module to bypass CORS
  const response = await new Promise<string>((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: SPLICE_GRAPHQL_URL,
    })
    request.setHeader('Content-Type', 'application/json')

    let data = ''
    request.on('response', (res) => {
      res.on('data', (chunk) => { data += chunk.toString() })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new Error(`Splice API error: ${res.statusCode}`))
        }
      })
    })
    request.on('error', reject)
    request.write(body)
    request.end()
  })

  const json = JSON.parse(response)
  const search = json?.data?.assetsSearch
  if (!search) return { samples: [], totalPages: 0, totalRecords: 0 }

  const samples: SpliceCatalogSample[] = (search.items || []).map((item: any) => {
    const previewFile = item.files?.find((f: any) => f.asset_file_type_slug === 'preview_mp3')
    const parentPack = item.parents?.items?.[0]

    return {
      uuid: item.uuid,
      name: item.name,
      bpm: item.bpm ?? null,
      key: item.key ?? null,
      chordType: item.chord_type ?? null,
      duration: item.duration ?? null,
      category: item.asset_category_slug ?? null,
      packName: parentPack?.name ?? null,
      packSlug: parentPack?.permalink_slug ?? null,
      previewUrl: previewFile?.url ?? null,
      tags: (item.tags || []).map((t: any) => t.label)
    }
  })

  return {
    samples,
    totalPages: search.pagination_metadata?.totalPages ?? 0,
    totalRecords: search.response_metadata?.records ?? 0
  }
}

/** Insert catalog search results as cloud samples into the app's DB */
export function insertCloudSamples(samples: SpliceCatalogSample[]): number {
  const appDb = getDb()
  let inserted = 0

  const stmt = appDb.prepare(
    `INSERT OR IGNORE INTO samples
     (folder_id, file_path, file_path_fwd, file_name, file_extension, file_size,
      duration_ms, category, source, source_id, is_cloud, cloud_preview_url,
      pack_name, source_tags, bpm, musical_key)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'splice', ?, 1, ?, ?, ?, ?, ?)`
  )

  const txn = appDb.transaction(() => {
    for (const s of samples) {
      // Use a synthetic file_path based on source_id to maintain uniqueness
      const syntheticPath = `splice://${s.uuid}`
      const musicalKey = s.key ? formatSpliceKey(s.key, s.chordType) : null

      stmt.run(
        null,
        syntheticPath,
        syntheticPath.toLowerCase(),
        s.name,
        path.extname(s.name).toLowerCase() || '.wav',
        s.duration ? Math.round(s.duration * 1000) : null,
        s.category === 'oneshot' ? 'one-shot' : s.category,
        s.uuid,
        s.previewUrl,
        s.packName,
        s.tags.length > 0 ? JSON.stringify(s.tags) : null,
        s.bpm,
        musicalKey
      )
      inserted++
    }
  })
  txn()

  return inserted
}

// ── Audio preview descrambling ──────────────────────────────────

/** Descramble a Splice preview audio buffer into valid MP3 data */
export function descramblePreview(data: Buffer): Buffer {
  if (data.length < 28) return data

  // Bytes 2-10: encoded data size (little-endian)
  let dataSize = 0
  for (let i = 0; i < 8; i++) {
    dataSize += data[2 + i] * (256 ** i)
  }

  // Bytes 10-28: 18-byte XOR encoding key
  const encodingBlock = data.subarray(10, 28).toString('latin1')

  // Bytes 28+: scrambled audio
  const audio = Buffer.from(data.subarray(28))

  // Two-pass XOR descramble
  let idx = 0
  let encIdx = 0
  while (idx < dataSize) {
    audio[idx] ^= encodingBlock.charCodeAt(encIdx)
    idx++
    encIdx = (encIdx + 1) % encodingBlock.length
  }

  const secondStart = idx + dataSize
  encIdx = 0
  while (idx < secondStart && idx < audio.length) {
    audio[idx] ^= encodingBlock.charCodeAt(encIdx)
    idx++
    encIdx = (encIdx + 1) % encodingBlock.length
  }

  return audio
}

/** Fetch and descramble a Splice preview URL, returns MP3 buffer */
export async function fetchPreviewAudio(previewUrl: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const request = net.request(previewUrl)
    const chunks: Buffer[] = []

    request.on('response', (res) => {
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      res.on('end', () => {
        const raw = Buffer.concat(chunks)
        resolve(descramblePreview(raw))
      })
    })
    request.on('error', reject)
    request.end()
  })
}

// ── Helpers ─────────────────────────────────────────────────────

function formatSpliceKey(key: string, chordType: string | null): string {
  if (!chordType) return key
  return `${key} ${chordType === 'minor' ? 'min' : 'maj'}`
}

function categorizeFromSpliceTags(tags: string | null): string | null {
  if (!tags) return null
  const lower = tags.toLowerCase()
  if (lower.includes('kick')) return 'kick'
  if (lower.includes('snare')) return 'snare'
  if (lower.includes('hi-hat') || lower.includes('hihat')) return 'hi-hat'
  if (lower.includes('vocal')) return 'vocal'
  if (lower.includes('bass')) return 'bass'
  if (lower.includes('pad')) return 'pad'
  if (lower.includes('synth')) return 'synth'
  if (lower.includes('fx') || lower.includes('effect')) return 'fx'
  return null
}
