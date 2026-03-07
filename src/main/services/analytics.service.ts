import { getDb } from './database.service'
import { generateGroupKey } from './project.service'

export interface AnalyticsData {
  totals: {
    samples: number
    projects: number
    songs: number
    vsts: number
    analyzedPercent: number
    vstEnrichedPercent: number
    favoriteSamples: number
    favoriteVsts: number
    totalDiskMb: number
  }
  projectsByStage: { stage: string; count: number }[]
  projectsPerMonth: { month: string; count: number }[]
  dawUsage: { name: string; count: number }[]
  samplesByCategory: { category: string; count: number }[]
  samplesByKey: { key: string; count: number }[]
  samplesByBpmRange: { range: string; count: number }[]
  topTags: { name: string; color: string; count: number }[]
  vstsByFormat: { format: string; count: number }[]
  vstsByVendor: { vendor: string; count: number }[]
  vstsByCategory: { category: string; count: number }[]
  recentVsts: { plugin_name: string; vendor: string | null; category: string | null; icon_url: string | null }[]
  projectBpmDistribution: { range: string; count: number }[]
  projectKeyDistribution: { key: string; count: number }[]
  topProjectPlugins: { plugin_name: string; project_count: number }[]
  avgTrackCount: number | null
  collectionCount: number
  completionRate: number
  avgVersionsPerSong: number
  mostProductiveDay: { day: string; count: number } | null
  topSampleFormats: { format: string; count: number }[]
  recentProjects: { title: string; stage: string; created_at: number }[]
}

export function getAnalyticsData(): AnalyticsData {
  const db = getDb()

  // Totals
  const totalSamples = (db.prepare('SELECT COUNT(*) as c FROM samples').get() as { c: number }).c
  const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c
  const totalVsts = (db.prepare('SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0').get() as { c: number }).c
  const analyzedCount = (db.prepare('SELECT COUNT(*) as c FROM samples WHERE waveform_data IS NOT NULL').get() as { c: number }).c
  const analyzedPercent = totalSamples > 0 ? Math.round((analyzedCount / totalSamples) * 100) : 0

  // Songs = unique group keys (distinct songs across all project versions)
  let totalSongs = 0
  try {
    const allTitles = db.prepare('SELECT title FROM projects').all() as { title: string }[]
    const uniqueGroupKeys = new Set(allTitles.map(r => generateGroupKey(r.title)))
    totalSongs = uniqueGroupKeys.size
  } catch (err) {
    console.error('[Analytics] Failed to compute song count:', err)
    totalSongs = totalProjects // fallback to project count
  }

  // Projects by stage
  const projectsByStage = db.prepare(
    `SELECT stage, COUNT(*) as count FROM projects GROUP BY stage ORDER BY
     CASE stage WHEN 'idea' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'mixing' THEN 3 WHEN 'done' THEN 4 END`
  ).all() as { stage: string; count: number }[]

  // Projects per month (last 12 months)
  const projectsPerMonth = db.prepare(
    `SELECT strftime('%Y-%m', created_at, 'unixepoch') as month, COUNT(*) as count
     FROM projects
     WHERE created_at > strftime('%s', 'now', '-12 months')
     GROUP BY month ORDER BY month`
  ).all() as { month: string; count: number }[]

  // DAW usage
  const dawUsage = db.prepare(
    `SELECT d.name, COUNT(dp.id) as count FROM daws d
     LEFT JOIN daw_projects dp ON dp.daw_id = d.id
     GROUP BY d.id ORDER BY count DESC`
  ).all() as { name: string; count: number }[]

  // Samples by category
  const samplesByCategory = db.prepare(
    `SELECT COALESCE(category, 'other') as category, COUNT(*) as count
     FROM samples GROUP BY category ORDER BY count DESC`
  ).all() as { category: string; count: number }[]

  // Samples by key
  const samplesByKey = db.prepare(
    `SELECT musical_key as key, COUNT(*) as count FROM samples
     WHERE musical_key IS NOT NULL GROUP BY musical_key ORDER BY count DESC`
  ).all() as { key: string; count: number }[]

  // Samples by BPM range
  const samplesByBpmRange = db.prepare(
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

  // Top tags
  const topTags = db.prepare(
    `SELECT t.name, t.color, COUNT(tg.id) as count
     FROM tags t JOIN taggables tg ON tg.tag_id = t.id
     GROUP BY t.id ORDER BY count DESC LIMIT 20`
  ).all() as { name: string; color: string; count: number }[]

  // VSTs by format (VST2 vs VST3)
  const vstsByFormat = db.prepare(
    `SELECT format, COUNT(*) as count FROM vst_plugins WHERE is_hidden = 0 GROUP BY format ORDER BY count DESC`
  ).all() as { format: string; count: number }[]

  // VSTs by vendor (top 15)
  const vstsByVendor = db.prepare(
    `SELECT COALESCE(vendor, 'Unknown') as vendor, COUNT(*) as count
     FROM vst_plugins WHERE is_hidden = 0 GROUP BY vendor ORDER BY count DESC LIMIT 15`
  ).all() as { vendor: string; count: number }[]

  // VSTs by category
  const vstsByCategory = db.prepare(
    `SELECT COALESCE(category, 'Unknown') as category, COUNT(*) as count
     FROM vst_plugins WHERE is_hidden = 0 GROUP BY category ORDER BY count DESC`
  ).all() as { category: string; count: number }[]

  // Extra totals
  const enrichedVsts = (db.prepare('SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0 AND enriched = 1').get() as { c: number }).c
  const vstEnrichedPercent = totalVsts > 0 ? Math.round((enrichedVsts / totalVsts) * 100) : 0
  const favoriteSamples = (db.prepare('SELECT COUNT(*) as c FROM samples WHERE is_favorite = 1').get() as { c: number }).c
  const favoriteVsts = (db.prepare('SELECT COUNT(*) as c FROM vst_plugins WHERE is_hidden = 0 AND is_favorite = 1').get() as { c: number }).c
  const totalDiskBytes = (db.prepare('SELECT COALESCE(SUM(file_size), 0) as s FROM samples').get() as { s: number }).s
    + (db.prepare('SELECT COALESCE(SUM(file_size), 0) as s FROM vst_plugins WHERE is_hidden = 0').get() as { s: number }).s
  const totalDiskMb = Math.round(totalDiskBytes / (1024 * 1024))

  // Recently added VSTs (last 10)
  const recentVsts = db.prepare(
    `SELECT plugin_name, vendor, category, icon_url FROM vst_plugins
     WHERE is_hidden = 0 ORDER BY created_at DESC LIMIT 10`
  ).all() as { plugin_name: string; vendor: string | null; category: string | null; icon_url: string | null }[]

  // Completion rate: % of unique songs that have at least one "done" project
  let completionRate = 0
  try {
    const allProjects = db.prepare('SELECT title, stage FROM projects').all() as { title: string; stage: string }[]
    const songStages = new Map<string, Set<string>>()
    for (const p of allProjects) {
      const key = generateGroupKey(p.title)
      if (!songStages.has(key)) songStages.set(key, new Set())
      songStages.get(key)!.add(p.stage)
    }
    const totalUniqueSongs = songStages.size
    const doneSongs = [...songStages.values()].filter(stages => stages.has('done')).length
    completionRate = totalUniqueSongs > 0 ? Math.round((doneSongs / totalUniqueSongs) * 100) : 0
  } catch { /* ignore */ }

  // Average versions per song
  const avgVersionsPerSong = totalSongs > 0 ? Math.round((totalProjects / totalSongs) * 10) / 10 : 0

  // Most productive day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  let mostProductiveDay: { day: string; count: number } | null = null
  try {
    const dayRow = db.prepare(
      `SELECT CAST(strftime('%w', created_at, 'unixepoch') AS INTEGER) as dow, COUNT(*) as count
       FROM projects GROUP BY dow ORDER BY count DESC LIMIT 1`
    ).get() as { dow: number; count: number } | undefined
    if (dayRow) {
      mostProductiveDay = { day: dayNames[dayRow.dow], count: dayRow.count }
    }
  } catch { /* ignore */ }

  // Top sample file formats
  const topSampleFormats = db.prepare(
    `SELECT LOWER(file_extension) as format, COUNT(*) as count
     FROM samples WHERE file_extension IS NOT NULL AND file_extension != ''
     GROUP BY format ORDER BY count DESC LIMIT 8`
  ).all() as { format: string; count: number }[]

  // Recent projects (last 5)
  const recentProjects = db.prepare(
    `SELECT title, stage, created_at FROM projects ORDER BY created_at DESC LIMIT 5`
  ).all() as { title: string; stage: string; created_at: number }[]

  // Project BPM distribution (from .als parsing)
  const projectBpmDistribution = db.prepare(
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
     FROM projects WHERE bpm IS NOT NULL
     GROUP BY range ORDER BY MIN(bpm)`
  ).all() as { range: string; count: number }[]

  // Project key distribution
  const projectKeyDistribution = db.prepare(
    'SELECT musical_key as key, COUNT(*) as count FROM projects WHERE musical_key IS NOT NULL GROUP BY musical_key ORDER BY count DESC LIMIT 12'
  ).all() as { key: string; count: number }[]

  // Top plugins used across projects
  const topProjectPlugins = db.prepare(
    `SELECT plugin_name, COUNT(DISTINCT project_id) as project_count
     FROM project_plugins GROUP BY plugin_name ORDER BY project_count DESC LIMIT 15`
  ).all() as { plugin_name: string; project_count: number }[]

  // Average track count
  const avgTrackRow = db.prepare(
    'SELECT AVG(track_count) as avg FROM projects WHERE track_count IS NOT NULL AND track_count > 0'
  ).get() as { avg: number | null }
  const avgTrackCount = avgTrackRow?.avg ? Math.round(avgTrackRow.avg * 10) / 10 : null

  // Collection count
  let collectionCount = 0
  try {
    collectionCount = (db.prepare('SELECT COUNT(*) as c FROM collections').get() as { c: number }).c
  } catch { /* table might not exist yet */ }

  return {
    totals: { samples: totalSamples, projects: totalProjects, songs: totalSongs, vsts: totalVsts, analyzedPercent, vstEnrichedPercent, favoriteSamples, favoriteVsts, totalDiskMb },
    projectsByStage,
    projectsPerMonth,
    dawUsage,
    samplesByCategory,
    samplesByKey,
    samplesByBpmRange,
    topTags,
    vstsByFormat,
    vstsByVendor,
    vstsByCategory,
    recentVsts,
    projectBpmDistribution,
    projectKeyDistribution,
    topProjectPlugins,
    avgTrackCount,
    collectionCount,
    completionRate,
    avgVersionsPerSong,
    mostProductiveDay,
    topSampleFormats,
    recentProjects
  }
}
