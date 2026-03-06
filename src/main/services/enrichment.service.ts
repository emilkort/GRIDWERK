import { getDb } from './database.service'
import { mapVst3Subcategories } from './vst.service'
import { BrowserWindow, net } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import type { VstPlugin } from '../db/schema'
import { lookupPluginVendor } from '../utils/plugin-vendor-lookup'
import { applyReferenceToPlugins } from './plugin-reference.service'

const execFileAsync = promisify(execFile)

// ============================================================
// Shared constants
// ============================================================

/** Vendor names that are too generic or incorrect to use in search queries */
const BAD_VENDOR_NAMES = /^(tools|inc|llc|ltd|corp|corporation|company|audio|music|software|plugin|plugins|vst|instrument|effect|microsoft|windows)$/i

/** Names that are clearly not VST plugins — skip web search entirely */
const NON_PLUGIN_NAMES = /^(libmp3lame|lame_enc|tensorflow|tensorflow_framework|vcruntime|msvcp|ucrtbase|api-ms-|concrt|vcomp)$/i

// ============================================================
// Vendor string cleaning
// ============================================================

/** Clean a vendor string: remove emails, legal suffixes, normalize whitespace */
function cleanVendorString(vendor: string): string {
  return vendor
    .replace(/\s*\/?\s*\S+@\S+\.\S+/g, '')       // Remove email addresses
    .replace(/\s*\(.*?\)\s*/g, '')                  // Remove parenthetical info
    .replace(/\b(GmbH|Inc\.?|LLC|Ltd\.?|Co\.?|Corp\.?|Pty\.?|S\.?A\.?|AG|BV|SL)\b\.?/gi, '') // Legal suffixes
    .replace(/[,;.\s]+$/g, '')                      // Remove trailing punctuation
    .replace(/\s{2,}/g, ' ')                        // Collapse multiple spaces
    .trim()
}

/** Check if a vendor value is usable (not null, not empty, not generic) */
function isGoodVendor(vendor: string | null): boolean {
  if (!vendor || vendor.trim().length < 2) return false
  return !BAD_VENDOR_NAMES.test(vendor.trim())
}

// ============================================================
// Phase A: Local enrichment — VST3 re-parse
// ============================================================

function enrichVst3Locally(plugin: VstPlugin): void {
  const db = getDb()
  const moduleInfoPath = path.join(plugin.file_path, 'Contents', 'moduleinfo.json')

  // 1. Static lookup takes highest priority
  const lookupVendor = lookupPluginVendor(plugin.plugin_name)

  if (!fs.existsSync(moduleInfoPath)) {
    // Even without moduleinfo, apply static lookup
    if (lookupVendor) {
      db.prepare('UPDATE vst_plugins SET vendor = ? WHERE id = ?').run(lookupVendor, plugin.id)
      console.log(`[Enrichment] VST3 lookup: ${plugin.plugin_name} → vendor="${lookupVendor}"`)
    }
    return
  }

  try {
    const info = JSON.parse(fs.readFileSync(moduleInfoPath, 'utf-8'))

    // Extract vendor: static lookup > Factory Info > top-level > existing
    const factoryInfo = info['Factory Info'] || {}
    let rawVendor = factoryInfo.Vendor || info.Vendor || null
    let vendor: string | null = lookupVendor
    if (!vendor && rawVendor) {
      vendor = cleanVendorString(rawVendor)
      if (!isGoodVendor(vendor)) vendor = null
    }
    vendor = vendor || plugin.vendor

    // Also try to get a nicer plugin name from Classes[0].Name
    let displayName: string | null = null
    if (info.Classes && info.Classes.length > 0) {
      const cls = info.Classes[0]
      if (cls.Name && cls.Name.length > 2 && cls.Name.length < 80) {
        displayName = cls.Name
      }
    }

    // Extract vendor website URL from Factory Info
    let website: string | null = null
    const rawUrl = factoryInfo.URL || null
    if (rawUrl && rawUrl !== 'www.yourcompany.com' && rawUrl.length > 3) {
      website = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    }

    let category = plugin.category || 'Unknown'
    let subcategory: string | null = plugin.subcategory

    if (info.Classes && info.Classes.length > 0) {
      const cls = info.Classes[0]
      if (cls.Sub_Categories) {
        const mapped = mapVst3Subcategories(cls.Sub_Categories)
        category = mapped.category
        subcategory = mapped.subcategory
      }
    }

    // Build update — include website if found
    const updates: string[] = ['vendor = ?', 'category = ?', 'subcategory = ?']
    const params: any[] = [vendor, category, subcategory]

    if (website) {
      updates.push('website = COALESCE(website, ?)')
      params.push(website)
    }

    params.push(plugin.id)
    db.prepare(`UPDATE vst_plugins SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    console.log(`[Enrichment] VST3 local: ${plugin.plugin_name} → vendor="${vendor}", website="${website || 'none'}", category="${category}"`)
  } catch {
    // Can't parse moduleinfo — still apply static lookup
    if (lookupVendor) {
      db.prepare('UPDATE vst_plugins SET vendor = ? WHERE id = ?').run(lookupVendor, plugin.id)
    }
  }
}

// ============================================================
// Phase A: Local enrichment — VST2 DLL version info
// ============================================================

interface DllVersionInfo {
  CompanyName: string | null
  ProductName: string | null
  FileDescription: string | null
  LegalCopyright: string | null
  LegalTrademarks: string | null
  FileVersion: string | null
  Comments: string | null
}

async function batchGetDllVersionInfo(
  dllPaths: string[]
): Promise<Map<string, DllVersionInfo>> {
  const result = new Map<string, DllVersionInfo>()
  if (process.platform !== 'win32' || dllPaths.length === 0) return result

  const pathsJson = JSON.stringify(dllPaths).replace(/'/g, "''")
  const psScript = `
$paths = '${pathsJson}' | ConvertFrom-Json
$results = @{}
foreach ($p in $paths) {
  try {
    $info = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($p)
    $results[$p] = @{
      CompanyName = $info.CompanyName
      ProductName = $info.ProductName
      FileDescription = $info.FileDescription
      LegalCopyright = $info.LegalCopyright
      LegalTrademarks = $info.LegalTrademarks
      FileVersion = $info.FileVersion
      Comments = $info.Comments
    }
  } catch {
    $results[$p] = @{ CompanyName = $null; ProductName = $null; FileDescription = $null; LegalCopyright = $null; LegalTrademarks = $null; FileVersion = $null; Comments = $null }
  }
}
$results | ConvertTo-Json -Depth 3 -Compress
`

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 30000 }
    )

    const parsed = JSON.parse(stdout.trim())
    for (const [filePath, info] of Object.entries(parsed)) {
      result.set(filePath, info as DllVersionInfo)
    }
  } catch (err) {
    console.error('[Enrichment] PowerShell DLL batch failed:', err)
  }

  return result
}

/** Extract a company name from a copyright string like "© 2024 Xfer Records" or "Copyright (c) Native Instruments" */
function extractVendorFromCopyright(copyright: string): string | null {
  // Try patterns: "© 2024 CompanyName", "Copyright (c) CompanyName", "(c) CompanyName"
  const match = copyright.match(/(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[-–]?\s*\d{0,4}\s*)?(.+)/i)
  if (match) {
    const name = match[1].replace(/[.,;]+$/, '').replace(/\s*(all rights reserved|inc|llc|ltd|gmbh)\.?$/i, '').trim()
    // Reject if the result is just a year or year range (e.g. "2019", "2013-2015")
    if (/^\d{4}(\s*[-–]\s*\d{4})?$/.test(name)) return null
    if (name.length >= 2 && name.length <= 60) return name
  }
  return null
}

function updatePluginFromDllInfo(plugin: VstPlugin, info: DllVersionInfo): void {
  const db = getDb()

  // 1. Static lookup takes highest priority
  const lookupVendor = lookupPluginVendor(plugin.plugin_name)

  // 2. DLL CompanyName (cleaned)
  let dllVendor = info.CompanyName?.trim() || null
  if (dllVendor) {
    dllVendor = cleanVendorString(dllVendor)
    if (!isGoodVendor(dllVendor)) dllVendor = null
  }

  // 3. Copyright fallback
  let copyrightVendor: string | null = null
  if (!dllVendor && info.LegalCopyright) {
    copyrightVendor = extractVendorFromCopyright(info.LegalCopyright)
    if (copyrightVendor) copyrightVendor = cleanVendorString(copyrightVendor)
    if (copyrightVendor && !isGoodVendor(copyrightVendor)) copyrightVendor = null
  }

  const vendor = lookupVendor || dllVendor || copyrightVendor || plugin.vendor

  // Best description: prefer FileDescription, then Comments
  const description = info.FileDescription?.trim() || info.Comments?.trim() || null

  db.prepare('UPDATE vst_plugins SET vendor = ?, description = COALESCE(description, ?) WHERE id = ?').run(
    vendor,
    description,
    plugin.id
  )

  console.log(`[Enrichment] VST2 DLL: ${plugin.plugin_name} → vendor="${vendor}", desc="${description?.slice(0, 60) || 'none'}"`)
}

// ============================================================
// Phase A.5: Keyword-based category inference
// ============================================================

import { inferCategoryFromName } from '../utils/category-inference'
export { inferCategoryFromName }

// ============================================================
// Phase B: Icon extraction from VST3 bundles and DLLs
// ============================================================

function extractVst3BundleIcon(pluginPath: string): string | null {
  // VST3 bundles may contain icons or snapshots in Contents/Resources/
  const resourcesDir = path.join(pluginPath, 'Contents', 'Resources')
  if (!fs.existsSync(resourcesDir)) return null

  try {
    // Check for snapshot images first (most visually representative)
    const snapshotsDir = path.join(resourcesDir, 'Snapshots')
    if (fs.existsSync(snapshotsDir)) {
      const snapshots = fs.readdirSync(snapshotsDir).filter(
        (f) => /\.(png|jpg|jpeg|bmp)$/i.test(f)
      )
      if (snapshots.length > 0) {
        const imgPath = path.join(snapshotsDir, snapshots[0])
        const data = fs.readFileSync(imgPath)
        const ext = path.extname(snapshots[0]).toLowerCase()
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
        return `data:${mime};base64,${data.toString('base64')}`
      }
    }

    // Check for icon files in Resources/
    const resources = fs.readdirSync(resourcesDir).filter(
      (f) => /\.(png|jpg|jpeg|ico)$/i.test(f)
    )
    if (resources.length > 0) {
      const imgPath = path.join(resourcesDir, resources[0])
      const data = fs.readFileSync(imgPath)
      const ext = path.extname(resources[0]).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.ico' ? 'image/x-icon' : 'image/jpeg'
      return `data:${mime};base64,${data.toString('base64')}`
    }
  } catch {
    // Skip icon extraction errors
  }

  return null
}

async function extractDllIcon(dllPath: string): Promise<string | null> {
  if (process.platform !== 'win32') return null

  const winPath = dllPath.replace(/\//g, '\\').replace(/'/g, "''")
  const psScript = `
Add-Type -AssemblyName System.Drawing
try {
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
} catch {}
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
  } catch {
    return null
  }
}

async function extractPluginIcon(plugin: VstPlugin): Promise<string | null> {
  // VST3: check bundle for images first
  if (plugin.format === 'VST3') {
    const bundleIcon = extractVst3BundleIcon(plugin.file_path)
    if (bundleIcon) return bundleIcon

    // Try extracting icon from the inner DLL
    const innerDll = path.join(
      plugin.file_path,
      'Contents',
      'x86_64-win',
      path.basename(plugin.file_path)
    )
    if (fs.existsSync(innerDll)) {
      return extractDllIcon(innerDll)
    }
  }

  // VST2: extract icon from the DLL directly
  if (plugin.format === 'VST2') {
    return extractDllIcon(plugin.file_path)
  }

  return null
}

// ============================================================
// Phase C: Web enrichment — Plugin Boutique + vendor fallback
// ============================================================

import { guessVendorDomain } from '../utils/vendor-domains'

const domainCache = new Map<string, { valid: boolean; ogImage?: string; ogDescription?: string }>()
const pbResultCache = new Map<string, PluginBoutiqueResult | null>()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractMetaContent(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta\\s+(?:[^>]*?)?(?:property|name)=["']${property}["'][^>]*?content=["']([^"']+)["']` +
      `|<meta\\s+(?:[^>]*?)?content=["']([^"']+)["'][^>]*?(?:property|name)=["']${property}["']`,
    'i'
  )
  const match = html.match(regex)
  return match ? match[1] || match[2] || null : null
}

/** Fetch using Electron's net module (Chromium network stack) for better compatibility */
async function electronFetch(url: string, timeout = 10000): Promise<string | null> {
  try {
    const response = await net.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })

    if (!response.ok) return null

    // Abort if response is too large (>2MB)
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) return null

    const text = await response.text()
    return text
  } catch {
    return null
  }
}

// ---- Plugin Boutique search ----

interface PluginBoutiqueResult {
  description: string | null
  imageUrl: string | null
  productUrl: string | null
  category: string | null
}

/** Clean plugin name: strip version numbers, bit info, parenthetical suffixes */
function cleanPluginName(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, '')       // Remove (64 Bit), (x64), etc.
    .replace(/[._]\d+$/g, '')             // Remove trailing ".32", "_64"
    .replace(/\s+v?\d+(\.\d+)*\s*$/i, '') // Remove trailing version "V5", "3.2.1"
    .replace(/\s+x(64|86)\s*$/i, '')      // Remove x64/x86
    .replace(/\s+FX$/i, '')               // Remove trailing "FX"
    .trim()
}

/** Normalize for comparison: lowercase, remove hyphens/spaces/underscores, strip trailing digits */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.,()]+/g, '').replace(/\d+$/g, '')
}

/** Check if a PB product slug/title is a reasonable match for our plugin name */
function isPBResultRelevant(productSlug: string, pluginName: string): boolean {
  const slug = normalizeForMatch(productSlug)
  const name = normalizeForMatch(cleanPluginName(pluginName))
  if (slug.length < 3 || name.length < 3) return false

  // Require minimum 4 chars for short names to avoid false positives (LABS→Labs, etc.)
  if (name.length < 5) {
    // For very short names, require exact match (ignoring trailing version digits)
    return slug === name
  }

  // The slug must START with the plugin name (not just contain it anywhere)
  // This prevents "Serum-Arcade" matching "Arcade"
  if (slug.startsWith(name)) return true

  // Or the name starts with the slug (slug is a shorter version like "Diva" for "Diva VSTi")
  if (name.startsWith(slug) && slug.length >= 4) return true

  // Check word-level match for multi-word names
  // e.g., "Auto-Tune Pro" should match "AutoTune-Pro-11"
  const nameWords = cleanPluginName(pluginName).toLowerCase().split(/[\s_\-.,]+/).filter(w => w.length >= 3)
  const slugLower = productSlug.toLowerCase().replace(/-/g, ' ')
  if (nameWords.length >= 2) {
    const allWordsMatch = nameWords.every(w => slugLower.includes(w))
    if (allWordsMatch) return true
  }

  return false
}

/** Filter out known false-positive product types from PB results */
function isPBProductType(slug: string): boolean {
  // Skip preset packs, bundles, sample packs, updates, etc. — we want the actual plugin
  return !/preset|midi|sample|bundle|pack|template|course|central|collection|expansion|loop|update|upgrade/i.test(slug)
}

/** Filter out PB URL paths that point to preset/sample categories, not actual plugins */
function isPBPluginCategory(urlPath: string): boolean {
  // Skip Synth Presets, Sample Packs, MIDI Packs, etc.
  return !/Synth-Presets|Sample|MIDI|Preset|Course|Template/i.test(urlPath)
}

async function searchPluginBoutique(pluginName: string, vendor: string | null): Promise<PluginBoutiqueResult | null> {
  const cleaned = cleanPluginName(pluginName)
  if (NON_PLUGIN_NAMES.test(cleaned)) return null
  const cleanedVendor = vendor?.trim() || null
  // Skip generic/incorrect vendor names
  const useVendor = cleanedVendor && !BAD_VENDOR_NAMES.test(cleanedVendor) ? cleanedVendor : null

  // Check cache (avoids duplicate requests for VST2+VST3 versions of same plugin)
  const cacheKey = `${cleaned.toLowerCase()}|${(cleanedVendor || '').toLowerCase()}`
  if (pbResultCache.has(cacheKey)) {
    const cached = pbResultCache.get(cacheKey)!
    if (cached) console.log(`[Enrichment] PB cache hit: "${cleaned}"`)
    return cached
  }

  // Include vendor in search query for better accuracy (e.g. "Arcade Output" instead of just "Arcade")
  const query = useVendor ? `${cleaned} ${useVendor}` : cleaned
  const searchUrl = `https://www.pluginboutique.com/search?q=${encodeURIComponent(query)}`

  console.log(`[Enrichment] PB search: "${query}"`)
  const html = await electronFetch(searchUrl)
  if (!html) {
    console.log(`[Enrichment] PB search: no HTML for "${query}"`)
    return null
  }

  // Find ALL product links in search results
  // PB URL format: /product/{category_id}-{Type}/{subcategory_id}-{SubType}/{id}-{Slug}
  const productLinks = [...html.matchAll(/<a[^>]+href=["'](\/product\/[^"']+)["'][^>]*>/gi)]
  if (productLinks.length === 0) {
    console.log(`[Enrichment] PB search: no product links found for "${query}"`)
    return null
  }

  // Deduplicate paths and find the first result whose slug matches our plugin
  const seen = new Set<string>()
  let matchedPath: string | null = null
  for (const match of productLinks) {
    const fullPath = match[1]
    if (seen.has(fullPath)) continue
    seen.add(fullPath)

    // Extract the last slug segment (the actual product name)
    const segments = fullPath.split('/')
    const lastSegment = segments[segments.length - 1] || ''
    // Remove the leading numeric ID: "1189-Addictive-Keys-Duo-Bundle" → "Addictive-Keys-Duo-Bundle"
    const slug = lastSegment.replace(/^\d+-/, '')

    if (!isPBProductType(slug)) continue
    if (!isPBPluginCategory(fullPath)) continue
    if (isPBResultRelevant(slug, cleaned)) {
      matchedPath = fullPath
      console.log(`[Enrichment] PB matched slug: "${slug}" for "${cleaned}"`)
      break
    }
  }

  if (!matchedPath) {
    console.log(`[Enrichment] PB search: no match for "${cleaned}" (checked ${seen.size} unique products)`)
    pbResultCache.set(cacheKey, null)
    return null
  }

  const productUrl = `https://www.pluginboutique.com${matchedPath}`
  console.log(`[Enrichment] PB match: ${cleaned} → ${productUrl}`)

  // Fetch the product page
  const productHtml = await electronFetch(productUrl)
  if (!productHtml) return null

  // Extract metadata from product page — validate it's about the right plugin
  const ogTitle = extractMetaContent(productHtml, 'og:title') || ''
  if (ogTitle && !isPBResultRelevant(ogTitle, cleaned)) {
    console.log(`[Enrichment] PB page title mismatch: "${ogTitle}" vs "${cleaned}"`)
    return null
  }

  const description =
    extractMetaContent(productHtml, 'og:description') ||
    extractMetaContent(productHtml, 'description')

  const imageUrl = extractMetaContent(productHtml, 'og:image')

  // Try to extract category from breadcrumbs or page content
  const categoryMatch = productHtml.match(/breadcrumb[^>]*>.*?<a[^>]*>[^<]*<\/a>.*?<a[^>]*>([^<]+)<\/a>/is)
  const category = categoryMatch ? categoryMatch[1].trim() : null

  const result: PluginBoutiqueResult = {
    description: description ? description.slice(0, 500) : null,
    imageUrl: imageUrl || null,
    productUrl,
    category
  }
  pbResultCache.set(cacheKey, result)
  return result
}

// ---- Vendor website fallback ----

async function probeVendorWebsite(
  domain: string
): Promise<{ website: string; ogImage: string | null; ogDescription: string | null } | null> {
  const cached = domainCache.get(domain)
  if (cached !== undefined) {
    return cached.valid
      ? {
          website: `https://${domain}`,
          ogImage: cached.ogImage || null,
          ogDescription: cached.ogDescription || null
        }
      : null
  }

  const html = await electronFetch(`https://${domain}`)
  if (!html) {
    domainCache.set(domain, { valid: false })
    return null
  }

  const ogImage = extractMetaContent(html, 'og:image')
  const ogDescription =
    extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description')

  domainCache.set(domain, {
    valid: true,
    ogImage: ogImage || undefined,
    ogDescription: ogDescription || undefined
  })

  return { website: `https://${domain}`, ogImage, ogDescription }
}

// ---- Google search fallback ----

interface GoogleResult {
  description: string | null
  website: string | null
}

const googleResultCache = new Map<string, GoogleResult | null>()

async function searchGoogle(pluginName: string, vendor: string | null): Promise<GoogleResult | null> {
  const cleaned = cleanPluginName(pluginName)
  if (NON_PLUGIN_NAMES.test(cleaned)) return null

  const vendorPart = vendor?.trim() && !BAD_VENDOR_NAMES.test(vendor.trim()) ? ` ${vendor.trim()}` : ''
  const query = `${cleaned}${vendorPart} VST plugin`

  const cacheKey = query.toLowerCase()
  if (googleResultCache.has(cacheKey)) return googleResultCache.get(cacheKey)!

  console.log(`[Enrichment] Google search: "${query}"`)
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=en`
  const html = await electronFetch(searchUrl)
  if (!html) {
    console.log(`[Enrichment] Google: no response`)
    googleResultCache.set(cacheKey, null)
    return null
  }

  // Extract the first organic result URL
  // Google wraps results in <a href="/url?q=ACTUAL_URL&...">
  const urlMatches = [...html.matchAll(/\/url\?q=(https?:\/\/[^&"]+)/gi)]
  let website: string | null = null
  for (const m of urlMatches) {
    const url = decodeURIComponent(m[1])
    // Skip Google's own domains, Wikipedia, YouTube
    if (/google\.|youtube\.|wikipedia\./i.test(url)) continue
    // Skip Plugin Boutique (already tried) and retailer sites
    if (/pluginboutique\.|sweetwater\.|amazon\.|ebay\.|reverb\.com/i.test(url)) continue
    website = url
    break
  }

  // Extract snippet/description from search results
  // Google puts snippets in <span> tags within result divs
  let description: string | null = null
  // Try to find meta description-like content from the results page
  // Google's rendered HTML has snippets in various formats
  const snippetMatch = html.match(/<span[^>]*class="[^"]*"[^>]*>([^<]{50,300})<\/span>/i)
  if (snippetMatch) {
    const text = snippetMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
    // Only use if it seems relevant (contains the plugin name or related terms)
    const lowerText = text.toLowerCase()
    const lowerName = cleaned.toLowerCase()
    if (lowerText.includes(lowerName) || lowerText.includes('plugin') || lowerText.includes('vst') || lowerText.includes('synth') || lowerText.includes('effect')) {
      description = text.slice(0, 500)
    }
  }

  // If we found a website, try to fetch it and get og:description
  if (website && !description) {
    try {
      const pageHtml = await electronFetch(website)
      if (pageHtml) {
        const ogDesc = extractMetaContent(pageHtml, 'og:description') || extractMetaContent(pageHtml, 'description')
        if (ogDesc) description = ogDesc.slice(0, 500)
      }
    } catch { /* skip */ }
  }

  const result: GoogleResult | null = (website || description) ? { description, website } : null
  if (result) {
    console.log(`[Enrichment] Google found: ${cleaned} → ${website || 'no URL'} (${description ? 'has desc' : 'no desc'})`)
  } else {
    console.log(`[Enrichment] Google: nothing useful for "${cleaned}"`)
  }
  googleResultCache.set(cacheKey, result)
  return result
}

function getGoogleFaviconUrl(domain: string): string {
  return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`
}

async function validateFavicon(url: string): Promise<boolean> {
  try {
    const response = await net.fetch(url, { method: 'HEAD' })
    if (!response.ok) return false
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) < 1000) return false
    return true
  } catch {
    return false
  }
}

async function enrichPluginFromWeb(plugin: VstPlugin): Promise<boolean> {
  const db = getDb()
  let updated = false

  // Re-read current state
  const current = db.prepare('SELECT * FROM vst_plugins WHERE id = ?').get(plugin.id) as VstPlugin | undefined
  if (!current) return false

  // A data: icon is a low-res DLL-extracted icon — always prefer a web image over it
  const hasLowResIcon = current.icon_url?.startsWith('data:') ?? false
  const needsBetterIcon = !current.icon_url || hasLowResIcon

  // Strategy 1: Search Plugin Boutique for plugin-specific info
  if (!current.description || needsBetterIcon || !current.website) {
    try {
      const pbResult = await searchPluginBoutique(current.plugin_name, current.vendor)
      if (pbResult) {
        if (!current.description && pbResult.description) {
          db.prepare('UPDATE vst_plugins SET description = ? WHERE id = ?').run(pbResult.description, current.id)
          updated = true
        }
        if (needsBetterIcon && pbResult.imageUrl) {
          db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(pbResult.imageUrl, current.id)
          updated = true
        }
        if (!current.website && pbResult.productUrl) {
          db.prepare('UPDATE vst_plugins SET website = ? WHERE id = ?').run(pbResult.productUrl, current.id)
          updated = true
        }
      }
    } catch {
      // Plugin Boutique search failed, continue to fallback
    }
  }

  // Strategy 1.5: Google search fallback if PB didn't find anything
  {
    const afterPbCheck = db.prepare('SELECT * FROM vst_plugins WHERE id = ?').get(plugin.id) as VstPlugin | undefined
    if (afterPbCheck && (!afterPbCheck.description || !afterPbCheck.website)) {
      try {
        const googleResult = await searchGoogle(afterPbCheck.plugin_name, afterPbCheck.vendor)
        if (googleResult) {
          if (!afterPbCheck.description && googleResult.description) {
            db.prepare('UPDATE vst_plugins SET description = ? WHERE id = ?').run(googleResult.description, afterPbCheck.id)
            updated = true
          }
          if (!afterPbCheck.website && googleResult.website) {
            db.prepare('UPDATE vst_plugins SET website = ? WHERE id = ?').run(googleResult.website, afterPbCheck.id)
            updated = true
          }
        }
      } catch { /* Google search failed */ }
    }
  }

  // Strategy 2: Vendor homepage fallback
  if (!current.vendor) return updated
  const domain = guessVendorDomain(current.vendor)
  if (!domain) return updated

  // Re-read after PB updates
  const afterPb = db.prepare('SELECT * FROM vst_plugins WHERE id = ?').get(plugin.id) as VstPlugin | undefined
  if (!afterPb) return updated

  const afterPbNeedsBetterIcon = !afterPb.icon_url || afterPb.icon_url.startsWith('data:')
  if (!afterPb.website || afterPbNeedsBetterIcon || !afterPb.description) {
    const siteInfo = await probeVendorWebsite(domain)
    if (siteInfo) {
      if (!afterPb.website && siteInfo.website) {
        db.prepare('UPDATE vst_plugins SET website = ? WHERE id = ?').run(siteInfo.website, afterPb.id)
        updated = true
      }
      if (!afterPb.description && siteInfo.ogDescription) {
        db.prepare('UPDATE vst_plugins SET description = ? WHERE id = ?').run(siteInfo.ogDescription.slice(0, 500), afterPb.id)
        updated = true
      }
      if (afterPbNeedsBetterIcon && siteInfo.ogImage) {
        db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(siteInfo.ogImage, afterPb.id)
        updated = true
      }
    }
  }

  // Strategy 3: Google Favicon API as last resort for icon (only if no icon at all)
  const final = db.prepare('SELECT icon_url FROM vst_plugins WHERE id = ?').get(plugin.id) as { icon_url: string | null } | undefined
  if (!final?.icon_url && domain) {
    const faviconUrl = getGoogleFaviconUrl(domain)
    const isValid = await validateFavicon(faviconUrl)
    if (isValid) {
      db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(faviconUrl, plugin.id)
      updated = true
    }
  }

  return updated
}

// ============================================================
// Progress helper
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
    // Frame may have been disposed during navigation
  }
}

// ============================================================
// Public API
// ============================================================

export async function enrichAllPlugins(
  win?: BrowserWindow | null
): Promise<{ enriched: number; total: number }> {
  const db = getDb()

  // Skip plugins that are fully complete: have vendor, category, description,
  // a proper web image (not data: DLL icon), and website
  const fullyComplete = db.prepare(
    `SELECT COUNT(*) as count FROM vst_plugins
     WHERE vendor IS NOT NULL AND vendor != ''
       AND category IS NOT NULL AND category != 'Unknown'
       AND description IS NOT NULL AND description != ''
       AND icon_url IS NOT NULL AND icon_url NOT LIKE 'data:%'
       AND website IS NOT NULL AND website != ''`
  ).get() as { count: number }

  // Reset only INCOMPLETE plugins for re-enrichment
  // Keep locally-extracted icons (data: URIs) but clear web URLs for incomplete ones
  console.log(`[Enrichment] ${fullyComplete.count} plugins already fully complete (skipping). Resetting incomplete plugins...`)
  db.prepare(`UPDATE vst_plugins SET
    enriched = 0,
    description = NULL,
    website = NULL,
    icon_url = CASE WHEN icon_url LIKE 'data:%' THEN icon_url ELSE NULL END
  WHERE NOT (
    vendor IS NOT NULL AND vendor != ''
    AND category IS NOT NULL AND category != 'Unknown'
    AND description IS NOT NULL AND description != ''
    AND icon_url IS NOT NULL AND icon_url NOT LIKE 'data:%'
    AND website IS NOT NULL AND website != ''
  )`).run()

  // Mark fully complete ones as enriched
  db.prepare(`UPDATE vst_plugins SET enriched = 1
  WHERE vendor IS NOT NULL AND vendor != ''
    AND category IS NOT NULL AND category != 'Unknown'
    AND description IS NOT NULL AND description != ''
    AND icon_url IS NOT NULL AND icon_url NOT LIKE 'data:%'
    AND website IS NOT NULL AND website != ''`).run()

  const plugins = db
    .prepare('SELECT * FROM vst_plugins WHERE enriched = 0 AND is_hidden = 0 ORDER BY plugin_name')
    .all() as VstPlugin[]

  const total = plugins.length
  if (total === 0) {
    const allCount = (db.prepare('SELECT COUNT(*) as count FROM vst_plugins').get() as { count: number }).count
    console.log('[Enrichment] All plugins are fully complete!')
    return { enriched: allCount, total: allCount }
  }

  let progress = 0

  // Phase A.0: Match against reference library (fast local lookup)
  console.log('[Enrichment] Phase A.0: Matching against reference library...')
  sendProgress(win, 0, total, 'Matching reference library...')
  const refResult = applyReferenceToPlugins(win)
  console.log(`[Enrichment] Phase A.0: ${refResult.matched} plugins matched from reference library`)

  // Phase A: VST3 local re-parse (subcategory + vendor from moduleinfo.json)
  const vst3Plugins = plugins.filter((p) => p.format === 'VST3')
  for (const plugin of vst3Plugins) {
    enrichVst3Locally(plugin)
    progress++
    sendProgress(win, progress, total, plugin.plugin_name)
  }

  // Phase A: VST2 DLL version info (batch)
  const vst2Plugins = plugins.filter((p) => p.format === 'VST2')
  const BATCH_SIZE = 50
  for (let i = 0; i < vst2Plugins.length; i += BATCH_SIZE) {
    const batch = vst2Plugins.slice(i, i + BATCH_SIZE)
    const paths = batch.map((p) => p.file_path)
    const versionInfoMap = await batchGetDllVersionInfo(paths)

    for (const plugin of batch) {
      const info = versionInfoMap.get(plugin.file_path)
      if (info) {
        updatePluginFromDllInfo(plugin, info)
      }
      progress++
      sendProgress(win, progress, total, plugin.plugin_name)
    }
  }

  // Phase A.5: Keyword-based category inference for ALL plugins (re-check after Phase A updates)
  console.log('[Enrichment] Phase A.5: Running keyword category inference...')
  const allForInference = db.prepare('SELECT * FROM vst_plugins ORDER BY plugin_name').all() as VstPlugin[]
  let inferredCount = 0
  for (const plugin of allForInference) {
    const before = db.prepare('SELECT category FROM vst_plugins WHERE id = ?').get(plugin.id) as { category: string | null }
    if (!before.category || before.category === 'Unknown') {
      const inferred = inferCategoryFromName(plugin.plugin_name, plugin.vendor)
      if (inferred) {
        db.prepare('UPDATE vst_plugins SET category = ?, subcategory = COALESCE(subcategory, ?) WHERE id = ?').run(
          inferred.category, inferred.subcategory, plugin.id
        )
        inferredCount++
      }
    }
  }
  console.log(`[Enrichment] Phase A.5: Inferred category for ${inferredCount} plugins`)

  // Phase A.6: Cross-reference VST2↔VST3 vendor data
  // If a VST2 has a good vendor but its VST3 counterpart doesn't (or vice versa), share the data
  console.log('[Enrichment] Phase A.6: Cross-referencing VST2↔VST3 vendor data...')
  {
    const allPlugins = db.prepare('SELECT * FROM vst_plugins ORDER BY plugin_name').all() as VstPlugin[]
    // Group by normalized plugin name
    const nameGroups = new Map<string, VstPlugin[]>()
    for (const p of allPlugins) {
      const key = p.plugin_name.toLowerCase().replace(/\s+/g, '')
      if (!nameGroups.has(key)) nameGroups.set(key, [])
      nameGroups.get(key)!.push(p)
    }

    let crossRefCount = 0
    for (const [, group] of nameGroups) {
      if (group.length < 2) continue
      // Find the best vendor in the group
      const bestVendor = group.find(p => isGoodVendor(p.vendor))?.vendor
      if (!bestVendor) continue

      // Find the best category in the group
      const bestCategory = group.find(p => p.category && p.category !== 'Unknown')
      const bestSubcategory = group.find(p => p.subcategory)
      // Find the best website
      const bestWebsite = group.find(p => p.website)

      for (const p of group) {
        const updates: string[] = []
        const params: any[] = []

        if (!isGoodVendor(p.vendor)) {
          updates.push('vendor = ?')
          params.push(bestVendor)
        }
        if ((!p.category || p.category === 'Unknown') && bestCategory) {
          updates.push('category = ?')
          params.push(bestCategory.category)
          if (bestSubcategory) {
            updates.push('subcategory = COALESCE(subcategory, ?)')
            params.push(bestSubcategory.subcategory)
          }
        }
        if (!p.website && bestWebsite) {
          updates.push('website = ?')
          params.push(bestWebsite.website)
        }

        if (updates.length > 0) {
          params.push(p.id)
          db.prepare(`UPDATE vst_plugins SET ${updates.join(', ')} WHERE id = ?`).run(...params)
          crossRefCount++
        }
      }
    }
    console.log(`[Enrichment] Phase A.6: Cross-referenced ${crossRefCount} plugins`)
  }

  // Phase A.7: Remove non-VST entries and clean vendor strings
  console.log('[Enrichment] Phase A.7: Cleaning database...')
  {
    // Remove non-VST files
    const nonPluginNames = ['lame_enc', 'libmp3lame', 'tensorflow', 'tensorflow_framework']
    let removedCount = 0
    for (const name of nonPluginNames) {
      const r = db.prepare('DELETE FROM vst_plugins WHERE LOWER(plugin_name) = ?').run(name.toLowerCase())
      removedCount += r.changes
    }
    // Also remove entries matching the NON_PLUGIN_NAMES pattern
    const allPlugins = db.prepare('SELECT id, plugin_name FROM vst_plugins').all() as { id: number; plugin_name: string }[]
    for (const p of allPlugins) {
      if (NON_PLUGIN_NAMES.test(p.plugin_name)) {
        db.prepare('DELETE FROM vst_plugins WHERE id = ?').run(p.id)
        removedCount++
      }
    }
    if (removedCount > 0) console.log(`[Enrichment] Removed ${removedCount} non-VST entries`)

    // Clean all vendor strings in the database
    const withVendor = db.prepare('SELECT id, vendor FROM vst_plugins WHERE vendor IS NOT NULL').all() as { id: number; vendor: string }[]
    let cleanedCount = 0
    for (const p of withVendor) {
      const cleaned = cleanVendorString(p.vendor)
      if (cleaned !== p.vendor) {
        db.prepare('UPDATE vst_plugins SET vendor = ? WHERE id = ?').run(cleaned || null, p.id)
        cleanedCount++
      }
    }
    if (cleanedCount > 0) console.log(`[Enrichment] Cleaned ${cleanedCount} vendor strings`)
  }

  // Phase A.8: Deduplicate plugins (same name + same format + same vendor → keep one)
  console.log('[Enrichment] Phase A.8: Deduplicating plugins...')
  {
    const allPlugins = db.prepare('SELECT * FROM vst_plugins ORDER BY plugin_name, id').all() as VstPlugin[]
    const seen = new Map<string, number>() // key → id to keep
    const toDelete: number[] = []

    for (const p of allPlugins) {
      const key = `${p.plugin_name.toLowerCase()}|${p.format}|${(p.vendor || '').toLowerCase()}`
      if (seen.has(key)) {
        toDelete.push(p.id)
      } else {
        seen.set(key, p.id)
      }
    }

    if (toDelete.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM vst_plugins WHERE id = ?')
      for (const id of toDelete) {
        deleteStmt.run(id)
      }
      console.log(`[Enrichment] Deduplicated: removed ${toDelete.length} duplicate entries`)
    }
  }

  // Phase B: Web enrichment FIRST (gets proper hi-res images from PB/vendor sites)
  // Also replaces low-res data: icons with web images
  domainCache.clear()
  pbResultCache.clear()
  googleResultCache.clear()
  const needsWeb = db
    .prepare(
      `SELECT * FROM vst_plugins
       WHERE (icon_url IS NULL OR icon_url LIKE 'data:%' OR website IS NULL OR description IS NULL)
       ORDER BY plugin_name`
    )
    .all() as VstPlugin[]
  console.log(`[Enrichment] Phase B: ${needsWeb.length} plugins need web enrichment`)

  if (needsWeb.length > 0) {
    const webBase = progress
    for (let i = 0; i < needsWeb.length; i++) {
      const plugin = needsWeb[i]
      sendProgress(win, webBase + i + 1, webBase + needsWeb.length, `Web: ${plugin.plugin_name}`)

      try {
        await enrichPluginFromWeb(plugin)
      } catch {
        // Skip web enrichment failures
      }

      if (i < needsWeb.length - 1) {
        await delay(1000)
      }
    }
  }

  // Phase C: Extract DLL/bundle icons as LAST RESORT for plugins that still have no icon
  const needsIcon = db
    .prepare('SELECT * FROM vst_plugins WHERE icon_url IS NULL AND is_hidden = 0 ORDER BY plugin_name')
    .all() as VstPlugin[]
  console.log(`[Enrichment] Phase C: ${needsIcon.length} plugins still need icon extraction`)

  for (let i = 0; i < needsIcon.length; i++) {
    const plugin = needsIcon[i]
    sendProgress(win, progress + needsWeb.length + i + 1, progress + needsWeb.length + needsIcon.length, `Icon: ${plugin.plugin_name}`)

    try {
      const iconData = await extractPluginIcon(plugin)
      if (iconData) {
        db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(iconData, plugin.id)
      }
    } catch {
      // Skip icon extraction failures
    }
  }

  // Mark all as enriched
  db.prepare('UPDATE vst_plugins SET enriched = 1').run()

  const finalCount = (db.prepare('SELECT COUNT(*) as count FROM vst_plugins').get() as { count: number }).count
  console.log(`[Enrichment] Complete: ${finalCount} plugins in database`)
  return { enriched: finalCount, total: finalCount }
}

export async function enrichSinglePlugin(pluginId: number): Promise<void> {
  const db = getDb()
  const plugin = db
    .prepare('SELECT * FROM vst_plugins WHERE id = ?')
    .get(pluginId) as VstPlugin | undefined
  if (!plugin) return

  // Phase A: metadata
  if (plugin.format === 'VST3') {
    enrichVst3Locally(plugin)
  } else if (plugin.format === 'VST2') {
    const infoMap = await batchGetDllVersionInfo([plugin.file_path])
    const info = infoMap.get(plugin.file_path)
    if (info) updatePluginFromDllInfo(plugin, info)
  }

  // Phase A.5: category inference
  {
    const cur = db.prepare('SELECT category, vendor FROM vst_plugins WHERE id = ?').get(plugin.id) as { category: string | null; vendor: string | null } | undefined
    if (cur && (!cur.category || cur.category === 'Unknown')) {
      const inferred = inferCategoryFromName(plugin.plugin_name, cur.vendor)
      if (inferred) {
        db.prepare('UPDATE vst_plugins SET category = ?, subcategory = COALESCE(subcategory, ?) WHERE id = ?').run(inferred.category, inferred.subcategory, plugin.id)
      }
    }
  }

  // Phase B: web enrichment first (hi-res images)
  const refreshed = db
    .prepare('SELECT * FROM vst_plugins WHERE id = ?')
    .get(pluginId) as VstPlugin | undefined
  if (refreshed && (!refreshed.icon_url || refreshed.icon_url.startsWith('data:') || !refreshed.website || !refreshed.description)) {
    await enrichPluginFromWeb(refreshed)
  }

  // Phase C: DLL/bundle icon as last resort (only if still no icon at all)
  const afterWeb = db.prepare('SELECT icon_url FROM vst_plugins WHERE id = ?').get(pluginId) as { icon_url: string | null } | undefined
  if (!afterWeb?.icon_url) {
    const iconData = await extractPluginIcon(plugin)
    if (iconData) {
      db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(iconData, plugin.id)
    }
  }

  db.prepare('UPDATE vst_plugins SET enriched = 1 WHERE id = ?').run(pluginId)
}

/** Enrich only new/un-enriched plugins (called automatically after scan) */
export async function enrichNewPlugins(
  win?: BrowserWindow | null
): Promise<{ enriched: number; total: number }> {
  const db = getDb()

  const plugins = db
    .prepare('SELECT * FROM vst_plugins WHERE enriched = 0 AND is_hidden = 0 ORDER BY plugin_name')
    .all() as VstPlugin[]

  const total = plugins.length
  if (total === 0) return { enriched: 0, total: 0 }

  let progress = 0

  // Phase A.0: Match against reference library
  console.log('[Enrichment] Phase A.0: Matching new plugins against reference library...')
  applyReferenceToPlugins(win)

  // Phase A: VST3 local re-parse
  const vst3Plugins = plugins.filter((p) => p.format === 'VST3')
  for (const plugin of vst3Plugins) {
    enrichVst3Locally(plugin)
    progress++
    sendProgress(win, progress, total, plugin.plugin_name)
  }

  // Phase A: VST2 DLL version info (batch)
  const vst2Plugins = plugins.filter((p) => p.format === 'VST2')
  const BATCH_SIZE = 50
  for (let i = 0; i < vst2Plugins.length; i += BATCH_SIZE) {
    const batch = vst2Plugins.slice(i, i + BATCH_SIZE)
    const paths = batch.map((p) => p.file_path)
    const versionInfoMap = await batchGetDllVersionInfo(paths)
    for (const plugin of batch) {
      const info = versionInfoMap.get(plugin.file_path)
      if (info) updatePluginFromDllInfo(plugin, info)
      progress++
      sendProgress(win, progress, total, plugin.plugin_name)
    }
  }

  // Phase A.5: keyword category inference
  for (const plugin of plugins) {
    const cur = db.prepare('SELECT category, vendor FROM vst_plugins WHERE id = ?').get(plugin.id) as { category: string | null; vendor: string | null } | undefined
    if (cur && (!cur.category || cur.category === 'Unknown')) {
      const inferred = inferCategoryFromName(plugin.plugin_name, cur.vendor)
      if (inferred) {
        db.prepare('UPDATE vst_plugins SET category = ?, subcategory = COALESCE(subcategory, ?) WHERE id = ?').run(inferred.category, inferred.subcategory, plugin.id)
      }
    }
  }

  // Phase A.6: Cross-reference vendor data between VST2/VST3 variants
  {
    const newPlugins = db.prepare('SELECT * FROM vst_plugins WHERE enriched = 0 AND is_hidden = 0 ORDER BY plugin_name').all() as VstPlugin[]
    const nameGroups = new Map<string, VstPlugin[]>()
    for (const p of newPlugins) {
      const key = p.plugin_name.toLowerCase().replace(/\s+/g, '')
      if (!nameGroups.has(key)) nameGroups.set(key, [])
      nameGroups.get(key)!.push(p)
    }
    for (const [, group] of nameGroups) {
      if (group.length < 2) continue
      const bestVendor = group.find(p => isGoodVendor(p.vendor))?.vendor
      if (!bestVendor) continue
      for (const p of group) {
        if (!isGoodVendor(p.vendor)) {
          db.prepare('UPDATE vst_plugins SET vendor = ? WHERE id = ?').run(bestVendor, p.id)
        }
      }
    }
  }

  // Phase B: web enrichment first (hi-res images from PB/vendor)
  domainCache.clear()
  const needsWeb = db
    .prepare(
      `SELECT * FROM vst_plugins
       WHERE enriched = 0 AND is_hidden = 0
         AND (icon_url IS NULL OR icon_url LIKE 'data:%' OR website IS NULL OR description IS NULL)
       ORDER BY plugin_name`
    )
    .all() as VstPlugin[]

  if (needsWeb.length > 0) {
    const webBase = progress
    for (let i = 0; i < needsWeb.length; i++) {
      const plugin = needsWeb[i]
      sendProgress(win, webBase + i + 1, webBase + needsWeb.length, `Web: ${plugin.plugin_name}`)
      try {
        await enrichPluginFromWeb(plugin)
      } catch { /* skip */ }
      if (i < needsWeb.length - 1) await delay(1000)
    }
  }

  // Phase C: DLL/bundle icon extraction as last resort
  const needsIcon = db
    .prepare('SELECT * FROM vst_plugins WHERE enriched = 0 AND is_hidden = 0 AND icon_url IS NULL ORDER BY plugin_name')
    .all() as VstPlugin[]

  for (let i = 0; i < needsIcon.length; i++) {
    const plugin = needsIcon[i]
    sendProgress(win, progress + needsWeb.length + i + 1, progress + needsWeb.length + needsIcon.length, `Icon: ${plugin.plugin_name}`)
    try {
      const iconData = await extractPluginIcon(plugin)
      if (iconData) {
        db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(iconData, plugin.id)
      }
    } catch { /* skip */ }
  }

  // Mark as enriched
  db.prepare('UPDATE vst_plugins SET enriched = 1 WHERE enriched = 0').run()

  return { enriched: total, total }
}
