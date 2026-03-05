import { getDb } from './database.service'
import type { VstPlugin } from '../db/schema'

export interface VstRecommendations {
  unexploredCategories: { category: string; count: number }[]
  trySomethingNew: VstPlugin[]
  similarToFavorites: VstPlugin[]
  recentlyAdded: VstPlugin[]
}

export function getVstRecommendations(): VstRecommendations {
  const db = getDb()

  // Categories where user has zero favorites
  const unexploredCategories = db.prepare(
    `SELECT category, COUNT(*) as count FROM vst_plugins
     WHERE category IS NOT NULL
     AND category NOT IN (
       SELECT DISTINCT category FROM vst_plugins WHERE is_favorite = 1 AND category IS NOT NULL
     )
     GROUP BY category ORDER BY count DESC`
  ).all() as { category: string; count: number }[]

  // 10 random unfavorited VSTs to try
  const trySomethingNew = db.prepare(
    'SELECT * FROM vst_plugins WHERE is_favorite = 0 ORDER BY RANDOM() LIMIT 10'
  ).all() as VstPlugin[]

  // Unfavorited VSTs sharing vendor or category with favorites
  const similarToFavorites = db.prepare(
    `SELECT DISTINCT v.* FROM vst_plugins v
     WHERE v.is_favorite = 0 AND (
       v.vendor IN (SELECT vendor FROM vst_plugins WHERE is_favorite = 1 AND vendor IS NOT NULL)
       OR v.category IN (SELECT category FROM vst_plugins WHERE is_favorite = 1 AND category IS NOT NULL)
     )
     ORDER BY RANDOM() LIMIT 10`
  ).all() as VstPlugin[]

  // 10 newest VSTs
  const recentlyAdded = db.prepare(
    'SELECT * FROM vst_plugins ORDER BY created_at DESC LIMIT 10'
  ).all() as VstPlugin[]

  return { unexploredCategories, trySomethingNew, similarToFavorites, recentlyAdded }
}
