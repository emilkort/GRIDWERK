import { getDb } from './database.service'
import type { Tag, Taggable, EntityType } from '../db/schema'

export function createTag(data: { name: string; color?: string }): Tag {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
    .run(data.name, data.color || '#8b5cf6')
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag
}

export function listTags(): Tag[] {
  return getDb().prepare('SELECT * FROM tags ORDER BY name').all() as Tag[]
}

export function deleteTag(tagId: number): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(tagId)
}

export function attachTag(tagId: number, entityType: EntityType, entityId: number): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) VALUES (?, ?, ?)')
    .run(tagId, entityType, entityId)
}

export function detachTag(tagId: number, entityType: EntityType, entityId: number): void {
  getDb()
    .prepare('DELETE FROM taggables WHERE tag_id = ? AND entity_type = ? AND entity_id = ?')
    .run(tagId, entityType, entityId)
}

export function getTagsForEntity(entityType: EntityType, entityId: number): Tag[] {
  return getDb()
    .prepare(
      `SELECT t.* FROM tags t
       JOIN taggables tg ON tg.tag_id = t.id
       WHERE tg.entity_type = ? AND tg.entity_id = ?
       ORDER BY t.name`
    )
    .all(entityType, entityId) as Tag[]
}
