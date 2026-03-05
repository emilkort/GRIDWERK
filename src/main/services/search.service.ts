import { getDb } from './database.service'

export interface SearchResult {
  entityType: string
  entityId: number
  title: string
  tags: string
  metadata: string
}

export function search(query: string): SearchResult[] {
  if (!query.trim()) return []

  const db = getDb()
  const ftsQuery = query
    .trim()
    .split(/\s+/)
    .map((word) => `${word}*`)
    .join(' ')

  try {
    return db
      .prepare(
        `SELECT entity_type as entityType, entity_id as entityId, title, tags, metadata
         FROM search_index WHERE search_index MATCH ?
         ORDER BY rank
         LIMIT 50`
      )
      .all(ftsQuery) as SearchResult[]
  } catch {
    // Fallback: search individual tables directly
    return searchFallback(query)
  }
}

function searchFallback(query: string): SearchResult[] {
  const db = getDb()
  const like = `%${query}%`
  const results: SearchResult[] = []

  // Search samples
  const samples = db
    .prepare('SELECT id, file_name FROM samples WHERE file_name LIKE ? LIMIT 20')
    .all(like) as { id: number; file_name: string }[]
  for (const s of samples) {
    results.push({ entityType: 'sample', entityId: s.id, title: s.file_name, tags: '', metadata: '' })
  }

  // Search VSTs
  const vsts = db
    .prepare('SELECT id, plugin_name FROM vst_plugins WHERE plugin_name LIKE ? LIMIT 20')
    .all(like) as { id: number; plugin_name: string }[]
  for (const v of vsts) {
    results.push({ entityType: 'vst', entityId: v.id, title: v.plugin_name, tags: '', metadata: '' })
  }

  // Search projects
  const projects = db
    .prepare('SELECT id, title FROM projects WHERE title LIKE ? LIMIT 20')
    .all(like) as { id: number; title: string }[]
  for (const p of projects) {
    results.push({ entityType: 'project', entityId: p.id, title: p.title, tags: '', metadata: '' })
  }

  return results
}

export function rebuildSearchIndex(): void {
  const db = getDb()

  // Drop and recreate — contentless FTS5 tables don't support DELETE
  db.exec("DROP TABLE IF EXISTS search_index")
  db.exec(`CREATE VIRTUAL TABLE search_index USING fts5(
    entity_type, entity_id UNINDEXED, title, tags, metadata,
    content='', tokenize='porter unicode61'
  )`)

  // Index samples
  db.exec(`
    INSERT INTO search_index (entity_type, entity_id, title, tags, metadata)
    SELECT 'sample', s.id, s.file_name,
           COALESCE((SELECT GROUP_CONCAT(t.name, ' ') FROM tags t JOIN taggables tg ON tg.tag_id = t.id WHERE tg.entity_type = 'sample' AND tg.entity_id = s.id), ''),
           COALESCE(s.category, '') || ' ' || COALESCE(s.musical_key, '') || ' ' || COALESCE(CAST(s.bpm AS TEXT), '')
    FROM samples s
  `)

  // Index VSTs
  db.exec(`
    INSERT INTO search_index (entity_type, entity_id, title, tags, metadata)
    SELECT 'vst', v.id, v.plugin_name,
           COALESCE((SELECT GROUP_CONCAT(t.name, ' ') FROM tags t JOIN taggables tg ON tg.tag_id = t.id WHERE tg.entity_type = 'vst' AND tg.entity_id = v.id), ''),
           COALESCE(v.vendor, '') || ' ' || COALESCE(v.category, '')
    FROM vst_plugins v
  `)

  // Index projects
  db.exec(`
    INSERT INTO search_index (entity_type, entity_id, title, tags, metadata)
    SELECT 'project', p.id, p.title,
           COALESCE((SELECT GROUP_CONCAT(t.name, ' ') FROM tags t JOIN taggables tg ON tg.tag_id = t.id WHERE tg.entity_type = 'project' AND tg.entity_id = p.id), ''),
           COALESCE(p.stage, '') || ' ' || COALESCE(p.musical_key, '') || ' ' || COALESCE(CAST(p.bpm AS TEXT), '')
    FROM projects p
  `)
}
