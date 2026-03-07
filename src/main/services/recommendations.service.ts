import { getDb } from './database.service'

export interface DiscoverData {
  profile: {
    totalSamples: number
    totalVsts: number
    totalProjects: number
    favoriteSamples: number
    favoriteVsts: number
    topBpmRange: string | null
    topKey: string | null
    topCategory: string | null
    mostProductiveDay: string | null
    completionRate: number
  }
  toolkit: {
    unenrichedVstCount: number
    unanalyzedSampleCount: number
    untaggedSampleCount: number
    untaggedVstCount: number
    duplicateSampleCount: number
    stalledProjects: { id: number; title: string; stage: string; updatedAt: number }[]
  }
  sampleInsights: {
    bpmDistribution: { range: string; count: number }[]
    keyDistribution: { key: string; count: number }[]
    topFormats: { format: string; count: number }[]
    avgDuration: number | null
    recentSamples: { id: number; fileName: string; category: string | null; bpm: number | null }[]
  }
  suggestions: {
    unexploredVstCategories: { category: string; count: number }[]
    similarToFavoriteVsts: { id: number; pluginName: string; vendor: string | null; category: string | null; iconUrl: string | null }[]
    underusedVendors: { vendor: string; totalCount: number; favoriteCount: number }[]
  }
  pluginChains: {
    coUsed: { pluginA: string; pluginB: string; projectCount: number }[]
    suggestedForFavorites: { pluginName: string; reason: string; coUseCount: number }[]
  }
  workflow: {
    avgProjectDuration: number | null
    projectsPerMonth: { month: string; count: number }[]
    productiveStreak: number
    weekdayDistribution: { day: string; count: number }[]
    daysSinceLastProject: number | null
  }
  activity: {
    recentProjects: { id: number; title: string; stage: string; createdAt: number }[]
    recentVsts: { id: number; pluginName: string; vendor: string | null; iconUrl: string | null; createdAt: number }[]
  }
  projectInsights: {
    avgBpm: number | null
    topKey: string | null
    avgTrackCount: number | null
    topPlugins: { name: string; count: number }[]
    bpmRange: { min: number; max: number } | null
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function getDiscoverData(): DiscoverData {
  const db = getDb()

  // ── Profile ──────────────────────────────────────────────
  const totalSamples = (db.prepare('SELECT COUNT(*) as c FROM samples').get() as { c: number }).c
  const totalVsts = (db.prepare('SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0').get() as { c: number }).c
  const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c
  const favoriteSamples = (db.prepare('SELECT COUNT(*) as c FROM samples WHERE is_favorite = 1').get() as { c: number }).c
  const favoriteVsts = (db.prepare('SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0 AND is_favorite = 1').get() as { c: number }).c

  // Top BPM range
  const topBpmRow = db.prepare(
    `SELECT
       CASE
         WHEN bpm < 80 THEN '< 80'
         WHEN bpm BETWEEN 80 AND 99 THEN '80-99'
         WHEN bpm BETWEEN 100 AND 119 THEN '100-119'
         WHEN bpm BETWEEN 120 AND 139 THEN '120-139'
         WHEN bpm BETWEEN 140 AND 159 THEN '140-159'
         WHEN bpm >= 160 THEN '160+'
       END as range,
       COUNT(*) as count
     FROM samples WHERE bpm IS NOT NULL
     GROUP BY range ORDER BY count DESC LIMIT 1`
  ).get() as { range: string; count: number } | undefined
  const topBpmRange = topBpmRow?.range ?? null

  // Top key
  const topKeyRow = db.prepare(
    'SELECT musical_key as key, COUNT(*) as count FROM samples WHERE musical_key IS NOT NULL GROUP BY musical_key ORDER BY count DESC LIMIT 1'
  ).get() as { key: string; count: number } | undefined
  const topKey = topKeyRow?.key ?? null

  // Top sample category
  const topCatRow = db.prepare(
    "SELECT category, COUNT(*) as count FROM samples WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC LIMIT 1"
  ).get() as { category: string; count: number } | undefined
  const topCategory = topCatRow?.category ?? null

  // Most productive day
  let mostProductiveDay: string | null = null
  try {
    const dayRow = db.prepare(
      `SELECT CAST(strftime('%w', created_at, 'unixepoch') AS INTEGER) as dow, COUNT(*) as count
       FROM projects GROUP BY dow ORDER BY count DESC LIMIT 1`
    ).get() as { dow: number; count: number } | undefined
    if (dayRow) mostProductiveDay = DAY_NAMES[dayRow.dow]
  } catch { /* ignore */ }

  // Completion rate (bounded query — uses SQL aggregation instead of loading all rows)
  let completionRate = 0
  try {
    const crRow = db.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) as done
       FROM projects`
    ).get() as { total: number; done: number }
    completionRate = crRow.total > 0 ? Math.round((crRow.done / crRow.total) * 100) : 0
  } catch { /* ignore */ }

  // ── Toolkit Health ───────────────────────────────────────
  const unenrichedVstCount = (db.prepare(
    'SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0 AND (enriched = 0 OR enriched IS NULL)'
  ).get() as { c: number }).c

  const unanalyzedSampleCount = (db.prepare(
    'SELECT COUNT(*) as c FROM samples WHERE waveform_data IS NULL'
  ).get() as { c: number }).c

  const untaggedSampleCount = (db.prepare(
    "SELECT COUNT(*) as c FROM samples WHERE id NOT IN (SELECT entity_id FROM taggables WHERE entity_type = 'sample')"
  ).get() as { c: number }).c

  const untaggedVstCount = (db.prepare(
    "SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0 AND id NOT IN (SELECT entity_id FROM taggables WHERE entity_type = 'vst')"
  ).get() as { c: number }).c

  // Duplicate samples (sharing waveform_hash)
  const duplicateSampleCount = (db.prepare(
    'SELECT COUNT(*) as c FROM (SELECT waveform_hash FROM samples WHERE waveform_hash IS NOT NULL GROUP BY waveform_hash HAVING COUNT(*) > 1)'
  ).get() as { c: number }).c

  // Stalled projects (not done, not updated in 30+ days)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400
  const stalledProjects = db.prepare(
    `SELECT id, title, stage, updated_at as updatedAt FROM projects
     WHERE stage != 'done' AND updated_at < ?
     ORDER BY updated_at ASC LIMIT 5`
  ).all(thirtyDaysAgo) as { id: number; title: string; stage: string; updatedAt: number }[]

  // ── Sample Insights ──────────────────────────────────────
  const bpmDistribution = db.prepare(
    `SELECT
       CASE
         WHEN bpm < 80 THEN '< 80'
         WHEN bpm BETWEEN 80 AND 99 THEN '80-99'
         WHEN bpm BETWEEN 100 AND 119 THEN '100-119'
         WHEN bpm BETWEEN 120 AND 139 THEN '120-139'
         WHEN bpm BETWEEN 140 AND 159 THEN '140-159'
         WHEN bpm >= 160 THEN '160+'
       END as range,
       COUNT(*) as count
     FROM samples WHERE bpm IS NOT NULL
     GROUP BY range ORDER BY MIN(bpm)`
  ).all() as { range: string; count: number }[]

  const keyDistribution = db.prepare(
    'SELECT musical_key as key, COUNT(*) as count FROM samples WHERE musical_key IS NOT NULL GROUP BY musical_key ORDER BY count DESC LIMIT 12'
  ).all() as { key: string; count: number }[]

  const topFormats = db.prepare(
    `SELECT LOWER(file_extension) as format, COUNT(*) as count
     FROM samples WHERE file_extension IS NOT NULL AND file_extension != ''
     GROUP BY format ORDER BY count DESC LIMIT 6`
  ).all() as { format: string; count: number }[]

  const avgDurRow = db.prepare(
    'SELECT AVG(duration_ms) as avg FROM samples WHERE duration_ms IS NOT NULL'
  ).get() as { avg: number | null }
  const avgDuration = avgDurRow?.avg ? Math.round(avgDurRow.avg) : null

  const recentSamples = db.prepare(
    'SELECT id, file_name as fileName, category, bpm FROM samples ORDER BY created_at DESC LIMIT 5'
  ).all() as { id: number; fileName: string; category: string | null; bpm: number | null }[]

  // ── Suggestions ──────────────────────────────────────────
  const unexploredVstCategories = db.prepare(
    `SELECT category, COUNT(*) as count FROM vst_plugins
     WHERE is_hidden = 0 AND category IS NOT NULL AND category != 'Unknown'
     AND category NOT IN (
       SELECT DISTINCT category FROM vst_plugins WHERE is_hidden = 0 AND is_favorite = 1 AND category IS NOT NULL
     )
     GROUP BY category ORDER BY count DESC`
  ).all() as { category: string; count: number }[]

  const similarToFavoriteVsts = db.prepare(
    `SELECT DISTINCT v.id, v.plugin_name as pluginName, v.vendor, v.category, v.icon_url as iconUrl
     FROM vst_plugins v
     WHERE v.is_hidden = 0 AND v.is_favorite = 0 AND (
       v.vendor IN (SELECT vendor FROM vst_plugins WHERE is_hidden = 0 AND is_favorite = 1 AND vendor IS NOT NULL)
       OR v.category IN (SELECT category FROM vst_plugins WHERE is_hidden = 0 AND is_favorite = 1 AND category IS NOT NULL)
     )
     ORDER BY RANDOM() LIMIT 8`
  ).all() as { id: number; pluginName: string; vendor: string | null; category: string | null; iconUrl: string | null }[]

  const underusedVendors = db.prepare(
    `SELECT vendor, COUNT(*) as totalCount,
       SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) as favoriteCount
     FROM vst_plugins
     WHERE is_hidden = 0 AND vendor IS NOT NULL AND vendor != ''
     GROUP BY vendor
     HAVING totalCount >= 3 AND favoriteCount = 0
     ORDER BY totalCount DESC LIMIT 8`
  ).all() as { vendor: string; totalCount: number; favoriteCount: number }[]

  // ── Recent Activity ──────────────────────────────────────
  const recentProjects = db.prepare(
    'SELECT id, title, stage, created_at as createdAt FROM projects ORDER BY created_at DESC LIMIT 5'
  ).all() as { id: number; title: string; stage: string; createdAt: number }[]

  const recentVsts = db.prepare(
    `SELECT id, plugin_name as pluginName, vendor, icon_url as iconUrl, created_at as createdAt
     FROM vst_plugins WHERE is_hidden = 0 ORDER BY created_at DESC LIMIT 5`
  ).all() as { id: number; pluginName: string; vendor: string | null; iconUrl: string | null; createdAt: number }[]

  // ── Plugin Chains ───────────────────────────────────────
  const coUsed = db.prepare(
    `SELECT a.plugin_name as pluginA, b.plugin_name as pluginB, COUNT(DISTINCT a.project_id) as projectCount
     FROM project_plugins a
     JOIN project_plugins b ON a.project_id = b.project_id AND a.plugin_name < b.plugin_name
     GROUP BY a.plugin_name, b.plugin_name
     ORDER BY projectCount DESC
     LIMIT 10`
  ).all() as { pluginA: string; pluginB: string; projectCount: number }[]

  // Suggest plugins co-used with favorites but not themselves favorited
  const suggestedForFavorites = db.prepare(
    `SELECT pp.plugin_name as pluginName,
       fav.plugin_name as reason,
       COUNT(DISTINCT pp.project_id) as coUseCount
     FROM project_plugins pp
     JOIN project_plugins fav ON pp.project_id = fav.project_id AND pp.plugin_name != fav.plugin_name
     JOIN vst_plugins v ON LOWER(fav.plugin_name) = LOWER(v.plugin_name) AND v.is_favorite = 1 AND v.is_hidden = 0
     WHERE pp.plugin_name NOT IN (SELECT plugin_name FROM vst_plugins WHERE is_favorite = 1 AND is_hidden = 0)
     GROUP BY pp.plugin_name, fav.plugin_name
     ORDER BY coUseCount DESC
     LIMIT 6`
  ).all() as { pluginName: string; reason: string; coUseCount: number }[]

  // ── Workflow Patterns ──────────────────────────────────
  // Avg project duration (created_at to updated_at for done projects)
  const avgDurProjectRow = db.prepare(
    "SELECT AVG(updated_at - created_at) as avg FROM projects WHERE stage = 'done'"
  ).get() as { avg: number | null }
  const avgProjectDuration = avgDurProjectRow?.avg ? Math.round(avgDurProjectRow.avg / 86400) : null

  // Projects per month (last 6 months)
  const projectsPerMonth = db.prepare(
    `SELECT strftime('%Y-%m', created_at, 'unixepoch') as month, COUNT(*) as count
     FROM projects
     WHERE created_at > strftime('%s', 'now', '-6 months')
     GROUP BY month ORDER BY month`
  ).all() as { month: string; count: number }[]

  // Weekday distribution
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayRaw = db.prepare(
    `SELECT CAST(strftime('%w', created_at, 'unixepoch') AS INTEGER) as dow, COUNT(*) as count
     FROM projects GROUP BY dow ORDER BY dow`
  ).all() as { dow: number; count: number }[]
  const weekdayMap = new Map(weekdayRaw.map(r => [r.dow, r.count]))
  const weekdayDistribution = dayNames.map((day, i) => ({
    day,
    count: weekdayMap.get(i) ?? 0
  }))

  // Productive streak (consecutive weeks with at least 1 project)
  let productiveStreak = 0
  try {
    const weekRows = db.prepare(
      `SELECT DISTINCT strftime('%Y-%W', created_at, 'unixepoch') as week
       FROM projects ORDER BY week DESC`
    ).all() as { week: string }[]

    if (weekRows.length > 0) {
      // Check if latest week is current or last week
      const now = new Date()
      const currentWeek = `${now.getFullYear()}-${String(getISOWeek(now)).padStart(2, '0')}`
      const lastWeek = weekRows[0].week

      // Only count streak if most recent project was this week or last week
      if (lastWeek === currentWeek || weekDiff(lastWeek, currentWeek) <= 1) {
        productiveStreak = 1
        for (let i = 1; i < weekRows.length; i++) {
          if (weekDiff(weekRows[i].week, weekRows[i - 1].week) <= 1) {
            productiveStreak++
          } else break
        }
      }
    }
  } catch { /* ignore */ }

  // Days since last project created
  const lastProjectRow = db.prepare(
    'SELECT created_at FROM projects ORDER BY created_at DESC LIMIT 1'
  ).get() as { created_at: number } | undefined
  const daysSinceLastProject = lastProjectRow
    ? Math.floor((Date.now() / 1000 - lastProjectRow.created_at) / 86400)
    : null

  // ── Project Insights (from .als parsing) ────────────────
  const projAvgBpmRow = db.prepare(
    'SELECT AVG(bpm) as avg FROM projects WHERE bpm IS NOT NULL'
  ).get() as { avg: number | null }
  const projAvgBpm = projAvgBpmRow?.avg ? Math.round(projAvgBpmRow.avg * 10) / 10 : null

  const projTopKeyRow = db.prepare(
    'SELECT musical_key as key, COUNT(*) as count FROM projects WHERE musical_key IS NOT NULL GROUP BY musical_key ORDER BY count DESC LIMIT 1'
  ).get() as { key: string; count: number } | undefined
  const projTopKey = projTopKeyRow?.key ?? null

  const projAvgTrackRow = db.prepare(
    'SELECT AVG(track_count) as avg FROM projects WHERE track_count IS NOT NULL AND track_count > 0'
  ).get() as { avg: number | null }
  const projAvgTrackCount = projAvgTrackRow?.avg ? Math.round(projAvgTrackRow.avg * 10) / 10 : null

  const projTopPlugins = db.prepare(
    `SELECT plugin_name as name, COUNT(DISTINCT project_id) as count
     FROM project_plugins GROUP BY plugin_name ORDER BY count DESC LIMIT 10`
  ).all() as { name: string; count: number }[]

  const projBpmRangeRow = db.prepare(
    'SELECT MIN(bpm) as min, MAX(bpm) as max FROM projects WHERE bpm IS NOT NULL'
  ).get() as { min: number | null; max: number | null }
  const projBpmRange = projBpmRangeRow?.min != null && projBpmRangeRow?.max != null
    ? { min: Math.round(projBpmRangeRow.min), max: Math.round(projBpmRangeRow.max) }
    : null

  return {
    profile: {
      totalSamples, totalVsts, totalProjects,
      favoriteSamples, favoriteVsts,
      topBpmRange, topKey, topCategory,
      mostProductiveDay, completionRate
    },
    toolkit: {
      unenrichedVstCount, unanalyzedSampleCount,
      untaggedSampleCount, untaggedVstCount,
      duplicateSampleCount, stalledProjects
    },
    sampleInsights: {
      bpmDistribution, keyDistribution, topFormats,
      avgDuration, recentSamples
    },
    suggestions: {
      unexploredVstCategories, similarToFavoriteVsts, underusedVendors
    },
    pluginChains: {
      coUsed, suggestedForFavorites
    },
    workflow: {
      avgProjectDuration, projectsPerMonth, productiveStreak,
      weekdayDistribution, daysSinceLastProject
    },
    activity: {
      recentProjects, recentVsts
    },
    projectInsights: {
      avgBpm: projAvgBpm,
      topKey: projTopKey,
      avgTrackCount: projAvgTrackCount,
      topPlugins: projTopPlugins,
      bpmRange: projBpmRange
    }
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function weekDiff(a: string, b: string): number {
  const [ya, wa] = a.split('-').map(Number)
  const [yb, wb] = b.split('-').map(Number)
  return Math.abs((yb * 52 + wb) - (ya * 52 + wa))
}
