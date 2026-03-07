import { getDb } from './database.service'
import { generateGroupKey } from './project.service'

export interface Collection {
  id: number
  name: string
  type: 'album' | 'ep' | 'single' | 'playlist'
  description: string | null
  artwork_path: string | null
  color: string
  created_at: number
  updated_at: number
  item_count: number
  total_duration: number | null
}

export interface CollectionItem {
  id: number
  collection_id: number
  project_id: number
  sort_order: number
  notes: string | null
  created_at: number
  // Joined project fields
  title: string
  bpm: number | null
  musical_key: string | null
  track_count: number | null
  time_signature: string | null
  stage: string
  color: string | null
  group_key: string
  daw_file_name: string | null
  plugin_count: number
}

export interface CollectionSuggestion {
  project_id: number
  title: string
  bpm: number | null
  musical_key: string | null
  stage: string
  reason: string
  score: number
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listCollections(): Collection[] {
  return getDb().prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM collection_items WHERE collection_id = c.id) AS item_count,
      NULL as total_duration
    FROM collections c
    ORDER BY c.updated_at DESC
  `).all() as Collection[]
}

export function getCollection(id: number): Collection | null {
  return getDb().prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM collection_items WHERE collection_id = c.id) AS item_count,
      NULL as total_duration
    FROM collections c WHERE c.id = ?
  `).get(id) as Collection | null
}

export function createCollection(data: {
  name: string
  type: 'album' | 'ep' | 'single' | 'playlist'
  description?: string
  color?: string
}): Collection {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO collections (name, type, description, color) VALUES (?, ?, ?, ?)'
  ).run(data.name.trim(), data.type, data.description?.trim() || null, data.color || '#8b5cf6')
  return getCollection(Number(result.lastInsertRowid))!
}

export function updateCollection(id: number, changes: Record<string, any>): Collection {
  const db = getDb()
  const allowed = ['name', 'type', 'description', 'artwork_path', 'color']
  const sets: string[] = []
  const params: any[] = []
  for (const [key, value] of Object.entries(changes)) {
    if (allowed.includes(key)) { sets.push(`${key} = ?`); params.push(value) }
  }
  if (sets.length > 0) {
    sets.push("updated_at = strftime('%s','now')")
    params.push(id)
    db.prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }
  return getCollection(id)!
}

export function deleteCollection(id: number): void {
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id)
}

// ── Collection Items ──────────────────────────────────────────────────────────

export function getCollectionItems(collectionId: number): CollectionItem[] {
  const rows = getDb().prepare(`
    SELECT ci.*, p.title, p.bpm, p.musical_key, p.track_count, p.time_signature,
           p.stage, p.color, p.daw_project_id,
           dp.file_name AS daw_file_name,
           (SELECT COUNT(*) FROM project_plugins WHERE project_id = p.id) AS plugin_count
    FROM collection_items ci
    JOIN projects p ON p.id = ci.project_id
    LEFT JOIN daw_projects dp ON dp.id = p.daw_project_id
    WHERE ci.collection_id = ?
    ORDER BY ci.sort_order
  `).all(collectionId) as any[]

  return rows.map(r => ({
    ...r,
    group_key: generateGroupKey(r.title)
  }))
}

export function addToCollection(collectionId: number, projectId: number): CollectionItem | null {
  const db = getDb()
  const maxRow = db.prepare(
    'SELECT MAX(sort_order) as m FROM collection_items WHERE collection_id = ?'
  ).get(collectionId) as { m: number | null }
  const sortOrder = (maxRow.m ?? -1) + 1

  try {
    db.prepare(
      'INSERT INTO collection_items (collection_id, project_id, sort_order) VALUES (?, ?, ?)'
    ).run(collectionId, projectId, sortOrder)
    db.prepare("UPDATE collections SET updated_at = strftime('%s','now') WHERE id = ?").run(collectionId)
  } catch {
    return null // unique constraint — already in collection
  }

  const items = getCollectionItems(collectionId)
  return items.find(i => i.project_id === projectId) ?? null
}

export function removeFromCollection(collectionId: number, projectId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND project_id = ?').run(collectionId, projectId)
  db.prepare("UPDATE collections SET updated_at = strftime('%s','now') WHERE id = ?").run(collectionId)
}

export function reorderCollectionItems(collectionId: number, orderedProjectIds: number[]): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE collection_items SET sort_order = ? WHERE collection_id = ? AND project_id = ?')
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((pid, i) => stmt.run(i, collectionId, pid))
  })
  tx(orderedProjectIds)
}

export function updateCollectionItemNotes(collectionId: number, projectId: number, notes: string): void {
  getDb().prepare(
    'UPDATE collection_items SET notes = ? WHERE collection_id = ? AND project_id = ?'
  ).run(notes.trim() || null, collectionId, projectId)
}

// ── Suggestions Engine ────────────────────────────────────────────────────────

export function getCollectionSuggestions(collectionId: number): CollectionSuggestion[] {
  const db = getDb()
  const items = getCollectionItems(collectionId)
  if (items.length === 0) return getUnassignedProjects().map(p => ({
    project_id: p.id, title: p.title, bpm: p.bpm, musical_key: p.musical_key,
    stage: p.stage, reason: 'Unassigned to any collection', score: 1
  })).slice(0, 10)

  // Compute collection "profile" from existing items
  const bpms = items.map(i => i.bpm).filter((b): b is number => b != null)
  const avgBpm = bpms.length > 0 ? bpms.reduce((a, b) => a + b, 0) / bpms.length : null
  const keys = items.map(i => i.musical_key).filter((k): k is string => k != null)
  const keyCounts = new Map<string, number>()
  for (const k of keys) keyCounts.set(k, (keyCounts.get(k) || 0) + 1)
  const dominantKey = keyCounts.size > 0
    ? [...keyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null

  // Get all projects NOT already in this collection
  const existingIds = new Set(items.map(i => i.project_id))
  const allInCollections = new Set(
    (db.prepare('SELECT DISTINCT project_id FROM collection_items').all() as { project_id: number }[])
      .map(r => r.project_id)
  )

  const candidates = db.prepare(`
    SELECT p.id, p.title, p.bpm, p.musical_key, p.stage, p.track_count
    FROM projects p
    WHERE p.id NOT IN (SELECT project_id FROM collection_items WHERE collection_id = ?)
    ORDER BY p.updated_at DESC
  `).all(collectionId) as {
    id: number; title: string; bpm: number | null; musical_key: string | null;
    stage: string; track_count: number | null
  }[]

  const suggestions: CollectionSuggestion[] = []

  for (const c of candidates) {
    let score = 0
    const reasons: string[] = []

    // BPM proximity (within ±10)
    if (avgBpm && c.bpm) {
      const diff = Math.abs(c.bpm - avgBpm)
      if (diff <= 5) { score += 3; reasons.push(`BPM ${c.bpm} matches collection avg ${Math.round(avgBpm)}`) }
      else if (diff <= 10) { score += 2; reasons.push(`BPM ${c.bpm} close to collection avg ${Math.round(avgBpm)}`) }
    }

    // Key compatibility (same key or relative major/minor)
    if (dominantKey && c.musical_key) {
      if (c.musical_key === dominantKey) {
        score += 3; reasons.push(`Key ${c.musical_key} matches collection`)
      } else if (isCompatibleKey(c.musical_key, dominantKey)) {
        score += 2; reasons.push(`Key ${c.musical_key} is compatible with ${dominantKey}`)
      }
    }

    // Not assigned to any collection yet (higher priority)
    if (!allInCollections.has(c.id)) {
      score += 1; reasons.push('Not in any collection yet')
    }

    // Stage bonus — done/mixing projects are more ready
    if (c.stage === 'done') { score += 1; reasons.push('Finished track') }
    else if (c.stage === 'mixing') { score += 0.5 }

    // Same group key as existing items = same song, likely belongs
    const groupKey = generateGroupKey(c.title)
    if (items.some(i => i.group_key === groupKey)) {
      score += 2; reasons.push('Version of a song already in this collection')
    }

    if (score > 0) {
      suggestions.push({
        project_id: c.id,
        title: c.title,
        bpm: c.bpm,
        musical_key: c.musical_key,
        stage: c.stage,
        reason: reasons[0] || '',
        score
      })
    }
  }

  suggestions.sort((a, b) => b.score - a.score)
  return suggestions.slice(0, 12)
}

function getUnassignedProjects(): { id: number; title: string; bpm: number | null; musical_key: string | null; stage: string }[] {
  return getDb().prepare(`
    SELECT p.id, p.title, p.bpm, p.musical_key, p.stage
    FROM projects p
    WHERE p.id NOT IN (SELECT project_id FROM collection_items)
    ORDER BY p.updated_at DESC
    LIMIT 20
  `).all() as any[]
}

// ── Key Compatibility (Camelot Wheel) ─────────────────────────────────────────

const CAMELOT: Record<string, string> = {
  'C Major': '8B', 'A Minor': '8A',
  'G Major': '9B', 'E Minor': '9A',
  'D Major': '10B', 'B Minor': '10A',
  'A Major': '11B', 'F# Minor': '11A',
  'E Major': '12B', 'C# Minor': '12A',
  'B Major': '1B', 'G# Minor': '1A',
  'F# Major': '2B', 'D# Minor': '2A',
  'C# Major': '3B', 'A# Minor': '3A',
  'F Major': '7B', 'D Minor': '7A',
  'Bb Major': '6B', 'G Minor': '6A',
  'Eb Major': '5B', 'C Minor': '5A',
  'Ab Major': '4B', 'F Minor': '4A',
  'Db Major': '3B',
}

function isCompatibleKey(keyA: string, keyB: string): boolean {
  const camA = CAMELOT[keyA]
  const camB = CAMELOT[keyB]
  if (!camA || !camB) return false
  const numA = parseInt(camA)
  const numB = parseInt(camB)
  const letterA = camA.slice(-1)
  const letterB = camB.slice(-1)
  // Same number (relative major/minor)
  if (numA === numB) return true
  // Adjacent numbers, same letter
  if (letterA === letterB && Math.abs(numA - numB) === 1) return true
  if (letterA === letterB && (numA === 1 && numB === 12 || numA === 12 && numB === 1)) return true
  return false
}
