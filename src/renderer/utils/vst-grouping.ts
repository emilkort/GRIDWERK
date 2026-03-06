import type { VstPlugin } from '@/stores/vst.store'

export interface MergedVstPlugin {
  id: number
  plugin_name: string
  vendor: string | null
  formats: ('VST2' | 'VST3')[]
  pluginIds: number[]
  filePaths: { format: 'VST2' | 'VST3'; path: string; size: number | null }[]
  category: string | null
  subcategory: string | null
  description: string | null
  icon_url: string | null
  website: string | null
  is_favorite: number
  enriched: number
  created_at: number
}

/** Normalize a plugin name for dedup: lowercase, strip spaces, remove
 *  common suffixes like (x64), x64, VST3, 64-bit, version numbers etc. */
function normalizeNameKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\(x64\)|\(64[- ]?bit\)|\bx64\b|\bx86\b/gi, '')
    .replace(/\bvst[23]?\b/gi, '')
    .replace(/[_\-\s.]+/g, '')   // collapse separators
    .replace(/\d+$/, '')          // trailing version numbers e.g. "dune3" → "dune"
    .trim()
}

export function mergePlugins(plugins: VstPlugin[]): MergedVstPlugin[] {
  const map = new Map<string, MergedVstPlugin>()

  for (const p of plugins) {
    // Merge by normalized name — strips arch suffixes (x64), format tags,
    // separators and trailing version numbers so variants are combined
    const key = normalizeNameKey(p.plugin_name)
    const existing = map.get(key)

    if (existing) {
      if (!existing.formats.includes(p.format)) {
        existing.formats.push(p.format)
      }
      existing.pluginIds.push(p.id)
      existing.filePaths.push({ format: p.format, path: p.file_path, size: p.file_size })
      // Prefer the longer/richer display name (e.g. "Dune 3" over "Dune3")
      if (p.plugin_name.length > existing.plugin_name.length) {
        existing.plugin_name = p.plugin_name
      }
      // Prefer richer metadata (non-null / non-empty wins)
      if (!existing.vendor && p.vendor) existing.vendor = p.vendor
      if (!existing.icon_url && p.icon_url) existing.icon_url = p.icon_url
      if (!existing.description && p.description) existing.description = p.description
      if (!existing.website && p.website) existing.website = p.website
      if (!existing.category || existing.category === 'Unknown') {
        if (p.category && p.category !== 'Unknown') {
          existing.category = p.category
          existing.subcategory = p.subcategory
        }
      }
      if (!existing.subcategory && p.subcategory) existing.subcategory = p.subcategory
      if (p.is_favorite) existing.is_favorite = 1
      if (p.enriched) existing.enriched = 1
      if (p.created_at < existing.created_at) existing.created_at = p.created_at
    } else {
      map.set(key, {
        id: p.id,
        plugin_name: p.plugin_name,
        vendor: p.vendor,
        formats: [p.format],
        pluginIds: [p.id],
        filePaths: [{ format: p.format, path: p.file_path, size: p.file_size }],
        category: p.category,
        subcategory: p.subcategory,
        description: p.description,
        icon_url: p.icon_url,
        website: p.website,
        is_favorite: p.is_favorite,
        enriched: p.enriched,
        created_at: p.created_at
      })
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.plugin_name.localeCompare(b.plugin_name)
  )
}
