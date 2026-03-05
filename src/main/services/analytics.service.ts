import { getDb } from './database.service'

export interface AnalyticsData {
  totals: {
    samples: number
    projects: number
    vsts: number
    analyzedPercent: number
  }
  projectsByStage: { stage: string; count: number }[]
  projectsPerMonth: { month: string; count: number }[]
  dawUsage: { name: string; count: number }[]
  samplesByCategory: { category: string; count: number }[]
  samplesByKey: { key: string; count: number }[]
  samplesByBpmRange: { range: string; count: number }[]
  topTags: { name: string; color: string; count: number }[]
}

export function getAnalyticsData(): AnalyticsData {
  const db = getDb()

  // Totals
  const totalSamples = (db.prepare('SELECT COUNT(*) as c FROM samples').get() as { c: number }).c
  const totalProjects = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c
  const totalVsts = (db.prepare('SELECT COUNT(*) as c FROM vst_plugins').get() as { c: number }).c
  const analyzedCount = (db.prepare('SELECT COUNT(*) as c FROM samples WHERE waveform_data IS NOT NULL').get() as { c: number }).c
  const analyzedPercent = totalSamples > 0 ? Math.round((analyzedCount / totalSamples) * 100) : 0

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

  return {
    totals: { samples: totalSamples, projects: totalProjects, vsts: totalVsts, analyzedPercent },
    projectsByStage,
    projectsPerMonth,
    dawUsage,
    samplesByCategory,
    samplesByKey,
    samplesByBpmRange,
    topTags
  }
}
