import { getDb } from './database.service'
import { mapVst3Subcategories } from './vst.service'
import { BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import type { VstPlugin } from '../db/schema'

const execFileAsync = promisify(execFile)

// ============================================================
// Phase A: Local enrichment — VST3 re-parse
// ============================================================

function enrichVst3Locally(plugin: VstPlugin): void {
  const db = getDb()
  const moduleInfoPath = path.join(plugin.file_path, 'Contents', 'moduleinfo.json')

  if (!fs.existsSync(moduleInfoPath)) {
    return
  }

  try {
    const info = JSON.parse(fs.readFileSync(moduleInfoPath, 'utf-8'))
    const vendor = info.Vendor || plugin.vendor
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

    db.prepare(
      'UPDATE vst_plugins SET vendor = ?, category = ?, subcategory = ? WHERE id = ?'
    ).run(vendor, category, subcategory, plugin.id)
  } catch {
    // Can't parse moduleinfo
  }
}

// ============================================================
// Phase A: Local enrichment — VST2 DLL version info
// ============================================================

interface DllVersionInfo {
  CompanyName: string | null
  ProductName: string | null
  FileDescription: string | null
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
    }
  } catch {
    $results[$p] = @{ CompanyName = $null; ProductName = $null; FileDescription = $null }
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

function updatePluginFromDllInfo(plugin: VstPlugin, info: DllVersionInfo): void {
  const db = getDb()
  const vendor = info.CompanyName?.trim() || plugin.vendor
  const description = info.FileDescription?.trim() || null
  db.prepare('UPDATE vst_plugins SET vendor = ?, description = COALESCE(description, ?) WHERE id = ?').run(
    vendor,
    description,
    plugin.id
  )
}

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
// Phase C: Web enrichment — vendor website + icon from web
// ============================================================

import { guessVendorDomain } from '../utils/vendor-domains'

const domainCache = new Map<string, { valid: boolean; ogImage?: string; ogDescription?: string }>()

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

  try {
    const response = await fetch(`https://${domain}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ProducersManager/1.0 (Desktop App)',
        Accept: 'text/html'
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow'
    })

    if (!response.ok) {
      domainCache.set(domain, { valid: false })
      return null
    }

    const html = await response.text()
    const ogImage = extractMetaContent(html, 'og:image')
    const ogDescription =
      extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description')

    domainCache.set(domain, {
      valid: true,
      ogImage: ogImage || undefined,
      ogDescription: ogDescription || undefined
    })

    return { website: `https://${domain}`, ogImage, ogDescription }
  } catch {
    domainCache.set(domain, { valid: false })
    return null
  }
}

function getGoogleFaviconUrl(domain: string): string {
  return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`
}

async function validateFavicon(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) return false
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) < 1000) return false
    return true
  } catch {
    return false
  }
}

async function enrichPluginFromWeb(plugin: VstPlugin): Promise<boolean> {
  if (!plugin.vendor) return false

  const domain = guessVendorDomain(plugin.vendor)
  if (!domain) return false

  const db = getDb()
  let updated = false

  // Probe vendor website for OG metadata
  if (!plugin.website || !plugin.icon_url || !plugin.description) {
    const siteInfo = await probeVendorWebsite(domain)

    if (siteInfo) {
      if (!plugin.website && siteInfo.website) {
        db.prepare('UPDATE vst_plugins SET website = ? WHERE id = ?').run(
          siteInfo.website,
          plugin.id
        )
        updated = true
      }

      if (!plugin.description && siteInfo.ogDescription) {
        db.prepare('UPDATE vst_plugins SET description = ? WHERE id = ?').run(
          siteInfo.ogDescription.slice(0, 500),
          plugin.id
        )
        updated = true
      }

      if (!plugin.icon_url && siteInfo.ogImage) {
        db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(
          siteInfo.ogImage,
          plugin.id
        )
        updated = true
      }
    }
  }

  // Fallback: Google Favicon API
  if (!plugin.icon_url && domain) {
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

  // Reset enriched flag so all plugins are re-processed with improved mapping
  db.prepare('UPDATE vst_plugins SET enriched = 0').run()

  const plugins = db
    .prepare('SELECT * FROM vst_plugins ORDER BY plugin_name')
    .all() as VstPlugin[]

  const total = plugins.length
  if (total === 0) return { enriched: 0, total: 0 }

  let progress = 0

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

  // Phase B: Extract icons for plugins that don't have one yet
  const needsIcon = db
    .prepare('SELECT * FROM vst_plugins WHERE icon_url IS NULL ORDER BY plugin_name')
    .all() as VstPlugin[]

  for (let i = 0; i < needsIcon.length; i++) {
    const plugin = needsIcon[i]
    sendProgress(win, progress + i + 1, progress + needsIcon.length, `Icon: ${plugin.plugin_name}`)

    try {
      const iconData = await extractPluginIcon(plugin)
      if (iconData) {
        db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(iconData, plugin.id)
      }
    } catch {
      // Skip icon extraction failures
    }
  }

  // Phase C: Web enrichment for plugins still missing icon/website
  domainCache.clear()
  const needsWeb = db
    .prepare(
      `SELECT * FROM vst_plugins
       WHERE (icon_url IS NULL OR website IS NULL)
         AND vendor IS NOT NULL
       ORDER BY plugin_name`
    )
    .all() as VstPlugin[]

  if (needsWeb.length > 0) {
    const webBase = progress + needsIcon.length
    for (let i = 0; i < needsWeb.length; i++) {
      const plugin = needsWeb[i]
      sendProgress(win, webBase + i + 1, webBase + needsWeb.length, `Web: ${plugin.plugin_name}`)

      try {
        await enrichPluginFromWeb(plugin)
      } catch {
        // Skip web enrichment failures
      }

      if (i < needsWeb.length - 1) {
        await delay(500)
      }
    }
  }

  // Mark all as enriched
  db.prepare('UPDATE vst_plugins SET enriched = 1').run()

  return { enriched: total, total }
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

  // Phase B: icon
  if (!plugin.icon_url) {
    const iconData = await extractPluginIcon(plugin)
    if (iconData) {
      db.prepare('UPDATE vst_plugins SET icon_url = ? WHERE id = ?').run(iconData, plugin.id)
    }
  }

  // Phase C: web enrichment
  const refreshed = db
    .prepare('SELECT * FROM vst_plugins WHERE id = ?')
    .get(pluginId) as VstPlugin | undefined
  if (refreshed && (!refreshed.icon_url || !refreshed.website) && refreshed.vendor) {
    await enrichPluginFromWeb(refreshed)
  }

  db.prepare('UPDATE vst_plugins SET enriched = 1 WHERE id = ?').run(pluginId)
}
