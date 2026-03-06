import { getDb } from './database.service'
import { net } from 'electron'
import type { PluginReference, VstPlugin } from '../db/schema'
import { BrowserWindow } from 'electron'

// ============================================================
// Normalization helpers
// ============================================================

/** Normalize a plugin name for matching: lowercase, strip version/arch suffixes, collapse whitespace */
export function normalizePluginName(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, '')         // Remove (64 Bit), (x64), etc.
    .replace(/[._]\d+$/g, '')               // Remove trailing ".32", "_64"
    .replace(/\s+v?\d+(\.\d+)*\s*$/i, '')   // Remove trailing version "V5", "3.2.1"
    .replace(/\s+x(64|86)\s*$/i, '')        // Remove x64/x86
    .replace(/[\s_\-]+/g, ' ')              // Normalize separators to single space
    .trim()
    .toLowerCase()
}

// ============================================================
// GitHub data fetching
// ============================================================

const GITHUB_RAW = 'https://raw.githubusercontent.com/VolantisDev/vst-guide-api/master'

async function fetchJson(url: string): Promise<any | null> {
  try {
    const response = await net.fetch(url, {
      headers: { 'User-Agent': 'producers-manager/1.0' }
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await net.fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })
    if (!response.ok) return null
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) return null
    return await response.text()
  } catch {
    return null
  }
}

interface VstGuidePlugin {
  id: string
  name: string
  url?: string
  docs?: string
  developer?: string
  types?: string[] // ['instrument'] or ['effect']
  sources?: string[] // ['vst2', 'vst3', 'au']
  tags?: string[] // ['synth', 'eq', 'compressor', etc.]
}

interface VstGuideDeveloper {
  id: string
  name: string
  shortName?: string
  website?: string
}

// Map vst-guide-api developer IDs to full names
const DEVELOPER_NAMES: Record<string, string> = {}

// Map vst-guide-api tags to our category/subcategory system
const TAG_TO_CATEGORY: Record<string, { category: string; subcategory: string }> = {
  synth: { category: 'Instrument', subcategory: 'Synth' },
  sampler: { category: 'Instrument', subcategory: 'Sampler' },
  'drum-machine': { category: 'Instrument', subcategory: 'Drum Machine' },
  drums: { category: 'Instrument', subcategory: 'Drum Machine' },
  piano: { category: 'Instrument', subcategory: 'Piano' },
  keys: { category: 'Instrument', subcategory: 'Piano' },
  organ: { category: 'Instrument', subcategory: 'Keys' },
  guitar: { category: 'Instrument', subcategory: 'Guitar' },
  bass: { category: 'Instrument', subcategory: 'Bass' },
  orchestral: { category: 'Instrument', subcategory: 'Orchestral' },
  strings: { category: 'Instrument', subcategory: 'Orchestral' },
  rompler: { category: 'Instrument', subcategory: 'Sampler' },
  eq: { category: 'Effect', subcategory: 'EQ' },
  equalizer: { category: 'Effect', subcategory: 'EQ' },
  compressor: { category: 'Effect', subcategory: 'Dynamics' },
  limiter: { category: 'Effect', subcategory: 'Dynamics' },
  dynamics: { category: 'Effect', subcategory: 'Dynamics' },
  reverb: { category: 'Effect', subcategory: 'Reverb' },
  delay: { category: 'Effect', subcategory: 'Delay' },
  chorus: { category: 'Effect', subcategory: 'Modulation' },
  flanger: { category: 'Effect', subcategory: 'Modulation' },
  phaser: { category: 'Effect', subcategory: 'Modulation' },
  modulation: { category: 'Effect', subcategory: 'Modulation' },
  distortion: { category: 'Effect', subcategory: 'Distortion' },
  saturation: { category: 'Effect', subcategory: 'Distortion' },
  overdrive: { category: 'Effect', subcategory: 'Distortion' },
  filter: { category: 'Effect', subcategory: 'Filter' },
  gate: { category: 'Effect', subcategory: 'Gate' },
  analyzer: { category: 'Effect', subcategory: 'Analyzer' },
  meter: { category: 'Effect', subcategory: 'Analyzer' },
  mastering: { category: 'Effect', subcategory: 'Mastering' },
  'pitch-correction': { category: 'Effect', subcategory: 'Pitch Correction' },
  'pitch-shift': { category: 'Effect', subcategory: 'Pitch Correction' },
  spatial: { category: 'Effect', subcategory: 'Spatial' },
  stereo: { category: 'Effect', subcategory: 'Spatial' },
  'multi-effect': { category: 'Effect', subcategory: 'Multi-Effect' },
  'channel-strip': { category: 'Effect', subcategory: 'Channel Strip' },
  restoration: { category: 'Effect', subcategory: 'Restoration' },
  'noise-reduction': { category: 'Effect', subcategory: 'Restoration' },
  vocal: { category: 'Effect', subcategory: 'Vocal' },
  vocoder: { category: 'Effect', subcategory: 'Vocal' },
  'amp-sim': { category: 'Effect', subcategory: 'Amp Sim' },
  utility: { category: 'Effect', subcategory: 'Utility' },
  'tape-emulation': { category: 'Effect', subcategory: 'Distortion' },
  'lo-fi': { category: 'Effect', subcategory: 'Multi-Effect' }
}

function mapTagsToCategory(tags: string[]): { category: string; subcategory: string } | null {
  for (const tag of tags) {
    const mapped = TAG_TO_CATEGORY[tag]
    if (mapped) return mapped
  }
  return null
}

function mapTypesToCategory(types: string[]): string | null {
  if (types.includes('instrument')) return 'Instrument'
  if (types.includes('effect')) return 'Effect'
  return null
}

// ============================================================
// Plugin Boutique category scraping
// ============================================================

// PB category IDs for comprehensive scraping
const PB_CATEGORIES = [
  // Instruments
  { url: '/categories/1-Instruments', category: 'Instrument' },
  // Effects
  { url: '/categories/2-Effects', category: 'Effect' },
  // Studio Tools
  { url: '/categories/3-Studio-Tools', category: 'Effect' }
]

// PB subcategory URL → our subcategory mapping
const PB_SUBCATEGORY_MAP: Record<string, string> = {
  Synth: 'Synth',
  Sampler: 'Sampler',
  'Drum-Machine': 'Drum Machine',
  Piano: 'Piano',
  Organ: 'Keys',
  Guitar: 'Guitar',
  Bass: 'Bass',
  Orchestral: 'Orchestral',
  Compressor: 'Dynamics',
  EQ: 'EQ',
  Equaliser: 'EQ',
  Reverb: 'Reverb',
  Delay: 'Delay',
  Chorus: 'Modulation',
  Flanger: 'Modulation',
  Phaser: 'Modulation',
  Distortion: 'Distortion',
  Saturation: 'Distortion',
  Filter: 'Filter',
  Gate: 'Gate',
  Limiter: 'Dynamics',
  'Channel-Strip': 'Channel Strip',
  'Amp-Simulator': 'Amp Sim',
  'Mastering-Suite': 'Mastering',
  'Multi-Effect': 'Multi-Effect',
  'Noise-Reduction': 'Restoration',
  'Pitch-Correction': 'Pitch Correction',
  'Stereo-Imaging': 'Spatial',
  Metering: 'Analyzer',
  'Tape-Emulation': 'Distortion',
  Vocoder: 'Vocal',
  'Vocal-Processing': 'Vocal',
  'Lo-Fi': 'Multi-Effect',
  'Bit-Crusher': 'Distortion',
  Tremolo: 'Modulation',
  'De-Esser': 'Restoration'
}

interface PBProduct {
  name: string
  vendor: string | null
  category: string
  subcategory: string | null
  imageUrl: string | null
  productUrl: string
  description: string | null
}

/** Extract product cards from a Plugin Boutique category/search page */
function extractPBProducts(html: string, defaultCategory: string): PBProduct[] {
  const products: PBProduct[] = []

  // Match product links: /product/{cat-id}-{Cat}/{subcat-id}-{SubCat}/{prod-id}-{Name}
  const productRegex =
    /href=["'](\/product\/(\d+-[^/"']+)\/(\d+-[^/"']+)\/(\d+-[^/"']+))["']/gi
  const matches = [...html.matchAll(productRegex)]
  const seen = new Set<string>()

  for (const m of matches) {
    const fullPath = m[1]
    if (seen.has(fullPath)) continue
    seen.add(fullPath)

    const catSlug = m[2].replace(/^\d+-/, '')
    const subcatSlug = m[3].replace(/^\d+-/, '')
    const prodSlug = m[4].replace(/^\d+-/, '')

    // Determine category
    const isInstrument =
      catSlug.includes('Instrument') || defaultCategory === 'Instrument'
    const category = isInstrument ? 'Instrument' : 'Effect'

    // Map subcategory
    const subcategory = PB_SUBCATEGORY_MAP[subcatSlug] || null

    // Clean product name from slug
    const name = prodSlug.replace(/-/g, ' ')

    products.push({
      name,
      vendor: null, // Will be extracted from product page if needed
      category,
      subcategory,
      imageUrl: null,
      productUrl: `https://www.pluginboutique.com${fullPath}`,
      description: null
    })
  }

  return products
}

// ============================================================
// Sync from vst-guide-api (GitHub)
// ============================================================

function sendProgress(
  win: BrowserWindow | null | undefined,
  current: number,
  total: number,
  currentFile: string
): void {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send('enrich:progress', { current, total, currentFile })
  } catch {
    // Frame may have been disposed
  }
}

export async function syncReferenceLibrary(
  win?: BrowserWindow | null
): Promise<{ added: number; updated: number; total: number }> {
  const db = getDb()
  let added = 0
  let updated = 0

  console.log('[RefLib] Starting reference library sync...')

  // Step 1: Fetch the repo file tree to get all plugin + developer filenames
  sendProgress(win, 0, 1, 'Fetching plugin database index...')
  const tree = await fetchJson(
    'https://api.github.com/repos/VolantisDev/vst-guide-api/git/trees/master?recursive=1'
  )
  if (!tree?.tree) {
    console.log('[RefLib] Failed to fetch repo tree')
    return { added: 0, updated: 0, total: 0 }
  }

  const pluginPaths: string[] = []
  const devPaths: string[] = []
  for (const item of tree.tree) {
    if (item.path.startsWith('plugins/') && item.path.endsWith('.json'))
      pluginPaths.push(item.path)
    if (item.path.startsWith('developers/') && item.path.endsWith('.json'))
      devPaths.push(item.path)
  }

  console.log(`[RefLib] Found ${pluginPaths.length} plugins, ${devPaths.length} developers`)

  // Step 2: Fetch all developer JSONs (small, do in parallel batches)
  sendProgress(win, 0, pluginPaths.length + devPaths.length, 'Loading developer data...')
  const devBatchSize = 10
  for (let i = 0; i < devPaths.length; i += devBatchSize) {
    const batch = devPaths.slice(i, i + devBatchSize)
    const results = await Promise.all(
      batch.map((p) => fetchJson(`${GITHUB_RAW}/${encodeURI(p)}`))
    )
    for (const dev of results) {
      if (dev?.id && dev?.name) {
        DEVELOPER_NAMES[dev.id] = dev.name
      }
    }
  }
  console.log(`[RefLib] Loaded ${Object.keys(DEVELOPER_NAMES).length} developer names`)

  // Step 3: Fetch all plugin JSONs in parallel batches and upsert into DB
  const upsert = db.prepare(`
    INSERT INTO plugin_reference (name, normalized_name, vendor, category, subcategory, website, formats, tags, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vst-guide-api')
    ON CONFLICT(normalized_name, COALESCE(vendor, ''))
    DO UPDATE SET
      name = CASE WHEN excluded.name != '' THEN excluded.name ELSE plugin_reference.name END,
      category = COALESCE(excluded.category, plugin_reference.category),
      subcategory = COALESCE(excluded.subcategory, plugin_reference.subcategory),
      website = COALESCE(excluded.website, plugin_reference.website),
      formats = COALESCE(excluded.formats, plugin_reference.formats),
      tags = COALESCE(excluded.tags, plugin_reference.tags),
      updated_at = strftime('%s','now')
  `)

  const pluginBatchSize = 20
  for (let i = 0; i < pluginPaths.length; i += pluginBatchSize) {
    const batch = pluginPaths.slice(i, i + pluginBatchSize)
    const results = await Promise.all(
      batch.map((p) => fetchJson(`${GITHUB_RAW}/${encodeURI(p)}`))
    )

    for (const plugin of results) {
      if (!plugin?.name) continue

      const p = plugin as VstGuidePlugin
      const normalized = normalizePluginName(p.name)

      // Resolve developer ID to full name
      const vendor = p.developer ? DEVELOPER_NAMES[p.developer] || p.developer : null

      // Map tags → category/subcategory
      const tagCategory = p.tags ? mapTagsToCategory(p.tags) : null
      const typeCategory = p.types ? mapTypesToCategory(p.types) : null
      const category = tagCategory?.category || typeCategory || null
      const subcategory = tagCategory?.subcategory || null

      const formats = p.sources ? JSON.stringify(p.sources) : null
      const tags = p.tags ? JSON.stringify(p.tags) : null

      try {
        const result = upsert.run(
          p.name,
          normalized,
          vendor,
          category,
          subcategory,
          p.url || null,
          formats,
          tags
        )
        if (result.changes > 0) {
          // Check if it was an insert or update
          added++
        }
      } catch {
        // Duplicate or constraint violation — skip
      }
    }

    sendProgress(win, i + batch.length, pluginPaths.length, `Loading plugins... (${i + batch.length}/${pluginPaths.length})`)
  }

  console.log(`[RefLib] vst-guide-api sync complete: ${added} plugins processed`)

  // Step 4: Scrape Plugin Boutique category pages for additional products
  sendProgress(win, 0, PB_CATEGORIES.length, 'Scraping Plugin Boutique...')
  let pbAdded = 0

  for (let ci = 0; ci < PB_CATEGORIES.length; ci++) {
    const cat = PB_CATEGORIES[ci]
    sendProgress(win, ci, PB_CATEGORIES.length, `PB: ${cat.url.split('/').pop()}`)

    const html = await fetchText(`https://www.pluginboutique.com${cat.url}`)
    if (!html) continue

    const products = extractPBProducts(html, cat.category)
    for (const prod of products) {
      const normalized = normalizePluginName(prod.name)
      if (normalized.length < 2) continue

      // Skip preset packs, bundles etc
      if (/preset|bundle|pack|expansion|loop|midi|template|course/i.test(prod.name)) continue

      try {
        const existing = db
          .prepare('SELECT id FROM plugin_reference WHERE normalized_name = ?')
          .get(normalized) as { id: number } | undefined

        if (!existing) {
          db.prepare(
            `INSERT OR IGNORE INTO plugin_reference (name, normalized_name, vendor, category, subcategory, image_url, website, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pluginboutique')`
          ).run(
            prod.name,
            normalized,
            prod.vendor,
            prod.category,
            prod.subcategory,
            prod.imageUrl,
            prod.productUrl
          )
          pbAdded++
        } else {
          // Update existing entry with PB data if it has more info
          if (prod.subcategory || prod.imageUrl) {
            db.prepare(
              `UPDATE plugin_reference SET
                subcategory = COALESCE(subcategory, ?),
                image_url = COALESCE(image_url, ?),
                website = COALESCE(website, ?),
                updated_at = strftime('%s','now')
               WHERE id = ?`
            ).run(prod.subcategory, prod.imageUrl, prod.productUrl, existing.id)
            updated++
          }
        }
      } catch {
        // Skip constraint violations
      }
    }

    // Rate limit PB requests
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log(`[RefLib] PB scrape: ${pbAdded} new, ${updated} updated`)

  const totalCount = (
    db.prepare('SELECT COUNT(*) as count FROM plugin_reference').get() as {
      count: number
    }
  ).count
  console.log(`[RefLib] Reference library total: ${totalCount} plugins`)

  return { added: added + pbAdded, updated, total: totalCount }
}

// ============================================================
// Matching scanned plugins against reference library
// ============================================================

interface MatchResult {
  refId: number
  name: string
  vendor: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  imageUrl: string | null
  website: string | null
}

/** Match a scanned plugin against the reference library */
export function matchPluginToReference(pluginName: string, vendor: string | null): MatchResult | null {
  const db = getDb()
  const normalized = normalizePluginName(pluginName)

  // Strategy 1: Exact normalized name match
  let ref = db
    .prepare('SELECT * FROM plugin_reference WHERE normalized_name = ? LIMIT 1')
    .get(normalized) as PluginReference | undefined

  // Strategy 2: Try without trailing "FX" suffix
  if (!ref && normalized.endsWith(' fx')) {
    ref = db
      .prepare('SELECT * FROM plugin_reference WHERE normalized_name = ? LIMIT 1')
      .get(normalized.replace(/\s+fx$/, '')) as PluginReference | undefined
  }

  // Strategy 3: Try adding "FX" if it doesn't have it
  if (!ref) {
    ref = db
      .prepare('SELECT * FROM plugin_reference WHERE normalized_name = ? LIMIT 1')
      .get(normalized + ' fx') as PluginReference | undefined
  }

  // Strategy 4: Prefix match (for plugins with version suffixes the normalizer didn't catch)
  if (!ref && normalized.length >= 4) {
    ref = db
      .prepare('SELECT * FROM plugin_reference WHERE normalized_name LIKE ? ORDER BY LENGTH(normalized_name) LIMIT 1')
      .get(normalized + '%') as PluginReference | undefined
  }

  // Strategy 5: Reverse prefix (reference name is a prefix of the scanned name)
  if (!ref && normalized.length >= 6) {
    const refs = db
      .prepare(
        `SELECT * FROM plugin_reference
         WHERE ? LIKE normalized_name || '%'
         AND LENGTH(normalized_name) >= 4
         ORDER BY LENGTH(normalized_name) DESC
         LIMIT 1`
      )
      .all(normalized) as PluginReference[]
    if (refs.length > 0) ref = refs[0]
  }

  // Strategy 6: Word-level matching for multi-word names
  if (!ref) {
    const words = normalized.split(/\s+/).filter((w) => w.length >= 3)
    if (words.length >= 2) {
      // Try matching on the first two significant words
      const pattern = `%${words[0]}%${words[1]}%`
      const candidates = db
        .prepare(
          'SELECT * FROM plugin_reference WHERE normalized_name LIKE ? LIMIT 5'
        )
        .all(pattern) as PluginReference[]

      // Score candidates by how close they match
      for (const candidate of candidates) {
        const cWords = candidate.normalized_name.split(/\s+/)
        const matchCount = words.filter((w) => cWords.some((cw) => cw.startsWith(w) || w.startsWith(cw))).length
        if (matchCount >= Math.min(2, words.length)) {
          ref = candidate
          break
        }
      }
    }
  }

  if (!ref) return null

  return {
    refId: ref.id,
    name: ref.name,
    vendor: ref.vendor,
    category: ref.category,
    subcategory: ref.subcategory,
    description: ref.description,
    imageUrl: ref.image_url,
    website: ref.website
  }
}

/** Apply reference library data to all unmatched/unenriched plugins */
export function applyReferenceToPlugins(win?: BrowserWindow | null): {
  matched: number
  total: number
} {
  const db = getDb()

  const refCount = (
    db.prepare('SELECT COUNT(*) as count FROM plugin_reference').get() as {
      count: number
    }
  ).count
  if (refCount === 0) {
    console.log('[RefLib] No reference data available, skipping matching')
    return { matched: 0, total: 0 }
  }

  const plugins = db
    .prepare('SELECT * FROM vst_plugins ORDER BY plugin_name')
    .all() as VstPlugin[]

  let matched = 0
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i]

    if (win && i % 20 === 0) {
      sendProgress(win, i, plugins.length, `Matching: ${plugin.plugin_name}`)
    }

    const ref = matchPluginToReference(plugin.plugin_name, plugin.vendor)
    if (!ref) continue

    const updates: string[] = []
    const params: any[] = []

    // Only fill in missing data — don't overwrite existing good data
    if (!plugin.vendor && ref.vendor) {
      updates.push('vendor = ?')
      params.push(ref.vendor)
    }
    if ((!plugin.category || plugin.category === 'Unknown') && ref.category) {
      updates.push('category = ?')
      params.push(ref.category)
    }
    if (!plugin.subcategory && ref.subcategory) {
      updates.push('subcategory = ?')
      params.push(ref.subcategory)
    }
    if (!plugin.description && ref.description) {
      updates.push('description = ?')
      params.push(ref.description)
    }
    if (!plugin.icon_url && ref.imageUrl) {
      updates.push('icon_url = ?')
      params.push(ref.imageUrl)
    }
    if (!plugin.website && ref.website) {
      updates.push('website = ?')
      params.push(ref.website)
    }

    if (updates.length > 0) {
      params.push(plugin.id)
      db.prepare(`UPDATE vst_plugins SET ${updates.join(', ')} WHERE id = ?`).run(
        ...params
      )
      matched++
    }
  }

  console.log(`[RefLib] Matched ${matched}/${plugins.length} plugins against reference library`)
  return { matched, total: plugins.length }
}

/** Get reference library stats */
export function getReferenceStats(): { total: number; sources: Record<string, number> } {
  const db = getDb()
  const total = (
    db.prepare('SELECT COUNT(*) as count FROM plugin_reference').get() as {
      count: number
    }
  ).count

  const bySource = db
    .prepare('SELECT source, COUNT(*) as count FROM plugin_reference GROUP BY source')
    .all() as { source: string; count: number }[]

  const sources: Record<string, number> = {}
  for (const row of bySource) {
    sources[row.source] = row.count
  }

  return { total, sources }
}
