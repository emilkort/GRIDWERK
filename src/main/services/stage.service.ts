import { getDb } from './database.service'

export interface Stage {
  id: number
  name: string
  slug: string
  color: string
  sort_order: number
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'stage'
}

function uniqueSlug(base: string): string {
  const db = getDb()
  let slug = base
  let n = 2
  while (db.prepare('SELECT 1 FROM stages WHERE slug = ?').get(slug)) {
    slug = `${base}_${n++}`
  }
  return slug
}

export function listStages(): Stage[] {
  return getDb().prepare('SELECT * FROM stages ORDER BY sort_order, id').all() as Stage[]
}

export function createStage(data: { name: string; color: string }): Stage {
  const db = getDb()
  const slug = uniqueSlug(slugify(data.name.trim()))
  const maxRow = db.prepare('SELECT MAX(sort_order) as m FROM stages').get() as { m: number | null }
  const sortOrder = (maxRow.m ?? -1) + 1
  const result = db
    .prepare('INSERT INTO stages (name, slug, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(data.name.trim(), slug, data.color, sortOrder)
  return db.prepare('SELECT * FROM stages WHERE id = ?').get(result.lastInsertRowid) as Stage
}

export function updateStage(id: number, changes: { name?: string; color?: string; sort_order?: number }): Stage {
  const db = getDb()
  const sets: string[] = []
  const params: any[] = []
  if (changes.name !== undefined) { sets.push('name = ?'); params.push(changes.name.trim()) }
  if (changes.color !== undefined) { sets.push('color = ?'); params.push(changes.color) }
  if (changes.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(changes.sort_order) }
  if (sets.length > 0) {
    params.push(id)
    db.prepare(`UPDATE stages SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }
  return db.prepare('SELECT * FROM stages WHERE id = ?').get(id) as Stage
}

export function deleteStage(id: number): { ok: boolean; error?: string } {
  const db = getDb()
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(id) as Stage | undefined
  if (!stage) return { ok: false, error: 'Stage not found' }

  const count = (db.prepare('SELECT COUNT(*) as n FROM projects WHERE stage = ?').get(stage.slug) as { n: number }).n
  if (count > 0) return { ok: false, error: `${count} project${count > 1 ? 's' : ''} still in this stage` }

  db.prepare('DELETE FROM stages WHERE id = ?').run(id)
  return { ok: true }
}

export function reorderStages(orderedIds: number[]): void {
  const db = getDb()
  const stmt = db.prepare('UPDATE stages SET sort_order = ? WHERE id = ?')
  const update = db.transaction((ids: number[]) => {
    ids.forEach((id, i) => stmt.run(i, id))
  })
  update(orderedIds)
}
