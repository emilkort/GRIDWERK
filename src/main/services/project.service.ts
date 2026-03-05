import { getDb } from './database.service'
import type { Project } from '../db/schema'

export interface ProjectTodo {
  id: number
  project_id: number
  text: string
  done: number // 0 | 1
  sort_order: number
  created_at: number
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function createProject(data: {
  title: string
  description?: string
  stage?: string
  bpm?: number
  musicalKey?: string
  color?: string
  priority?: string
  dawProjectId?: number
}): Project {
  const db = getDb()
  const stage = data.stage || 'idea'

  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as max_order FROM projects WHERE stage = ?')
    .get(stage) as { max_order: number | null }
  const sortOrder = (maxOrder.max_order ?? -1) + 1

  const result = db
    .prepare(
      `INSERT INTO projects (title, description, stage, sort_order, bpm, musical_key, color, priority, daw_project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.title,
      data.description || null,
      stage,
      sortOrder,
      data.bpm || null,
      data.musicalKey || null,
      data.color || null,
      data.priority || 'normal',
      data.dawProjectId || null
    )

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid) as Project
}

export function updateProject(id: number, changes: Record<string, any>): Project {
  const db = getDb()
  const allowed = ['title', 'description', 'bpm', 'musical_key', 'color', 'priority', 'daw_project_id']
  const sets: string[] = []
  const params: any[] = []

  for (const [key, value] of Object.entries(changes)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = ?`)
      params.push(value)
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = strftime('%s','now')")
    params.push(id)
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project
}

export function moveStage(id: number, stage: string, sortOrder: number): void {
  getDb()
    .prepare("UPDATE projects SET stage = ?, sort_order = ?, updated_at = strftime('%s','now') WHERE id = ?")
    .run(stage, sortOrder, id)
}

export function generateGroupKey(title: string): string {
  // Step 1: strip Ableton auto-save timestamp [YYYY-MM-DD HHMMSS]
  const base = title.replace(/\s*\[\d{4}-\d{2}-\d{2}[\s_]\d{6}\]\s*$/i, '').trim()

  // Production terms used in both boundary detection AND suffix stripping.
  // Order: longer alternatives first so regex alternation matches greedily.
  const PROD_TERMS = [
    'new\\s+mix', 'mix\\s+and\\s+master', 'mix\\s+master',
    'mix(?:ed)?', 'master(?:ed|ing)?', 'bounce[d]?', 'remix(?:ed)?',
    'demo', 'draft', 'alt', 'final', 'wip', 'test', 'restore',
    'maccopy', 'stems', 'split', 'instrumental', 'freestyle', 'vocal',
    'export(?:ed)?', 'new', 'old', 'copy', 'dup', 'backup', 'edit(?:ed)?',
    'diff', 'end', 'fixed', 'done', 'rough', 'clean', 'dry', 'wet',
    'earphones?', 'headphones?', 'monitor', 'loud', 'quiet',
    'duo\\d*', 'trio', 'solo', 'varied'
  ].join('|')

  // Step 2: Boundary-based truncation — find the FIRST version/production marker
  // and cut everything from there onward.
  let key = base
  let cutIndex = key.length

  // Decimal version with separator: " 1.2", "_2.0"
  const decSep = key.match(/[\s._-]\d+\.\d/)
  if (decSep?.index !== undefined) cutIndex = Math.min(cutIndex, decSep.index)

  // Decimal version glued to letters: "Song1.2", "TrackV2.1"
  const decGlued = key.match(/(?<=[a-zA-Z])\d+\.\d/)
  if (decGlued?.index !== undefined) cutIndex = Math.min(cutIndex, decGlued.index)

  // V/B/C variant letter glued to letters: "SongV2", "TrackB1"
  const varGlued = key.match(/(?<=[a-zA-Z])[VvBbCc]\d/)
  if (varGlued?.index !== undefined) cutIndex = Math.min(cutIndex, varGlued.index)

  // "v" + digit with separator: " v2", "_v3"
  const vPrefix = key.match(/[\s._-]v\d/i)
  if (vPrefix?.index !== undefined) cutIndex = Math.min(cutIndex, vPrefix.index)

  // Space + single uppercase letter + digit (version): " B1", " C2"
  const letterVer = key.match(/\s[A-Z]\d/)
  if (letterVer?.index !== undefined) cutIndex = Math.min(cutIndex, letterVer.index)

  // Production keywords as whole words (preceded by separator)
  const prodRe = new RegExp(`[\\s._-](?:${PROD_TERMS})(?:\\s|$|\\d)`, 'i')
  const prodKeyword = key.match(prodRe)
  if (prodKeyword?.index !== undefined) cutIndex = Math.min(cutIndex, prodKeyword.index)

  // Separator sequences: " -- " or " - " (annotation markers)
  const sepSeq = key.match(/\s--\s|\s-\s(?=[a-z])/)
  if (sepSeq?.index !== undefined) cutIndex = Math.min(cutIndex, sepSeq.index)

  if (cutIndex > 0 && cutIndex < key.length) {
    key = key.substring(0, cutIndex).trim()
  }

  // Step 3: iterative suffix stripping — peel remaining production terms,
  // trailing integers, and glued digits until stable.
  const suffixRe = new RegExp(`[\\s._-]+(?:${PROD_TERMS})\\d*\\s*$`, 'i')
  let prev = ''
  while (key !== prev) {
    prev = key
    key = key
      .replace(suffixRe, '')                      // production terms as trailing suffix
      .replace(/[\s._-]+[1-9]\d?\s*$/, '')       // trailing integer: "Beat 1"
      .replace(/(?<=[a-zA-Z])\d{1,2}\s*$/, '')   // glued integer: "RISE2"
      .trim()
  }

  // Normalize case for grouping: lowercase the key so "AWESOME" == "Awesome"
  key = key.toLowerCase()

  // Safety: if stripping emptied the key, return the timestamp-stripped base
  return key.length >= 2 ? key : base.toLowerCase()
}

export function listProjects(): (Project & {
  group_key: string
  todo_count: number
  done_count: number
  daw_file_name: string | null
  daw_last_modified: number | null
  daw_name: string | null
  tags: Array<{ id: number; name: string; color: string }>
})[] {
  const rows = getDb().prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM project_todos WHERE project_id = p.id) AS todo_count,
      (SELECT COUNT(*) FROM project_todos WHERE project_id = p.id AND done = 1) AS done_count,
      dp.file_name AS daw_file_name,
      dp.last_modified AS daw_last_modified,
      d.name AS daw_name,
      (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
       FROM taggables ta JOIN tags t ON t.id = ta.tag_id
       WHERE ta.entity_type = 'project' AND ta.entity_id = p.id) AS tags_json
    FROM projects p
    LEFT JOIN daw_projects dp ON dp.id = p.daw_project_id
    LEFT JOIN daws d ON d.id = dp.daw_id
    ORDER BY p.stage, p.sort_order
  `).all() as any[]

  return rows.map((p) => ({
    ...p,
    group_key: generateGroupKey(p.title),
    tags: JSON.parse(p.tags_json ?? '[]')
  }))
}

export function deleteProject(id: number): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

// ── Todos ─────────────────────────────────────────────────────────────────────

export function getTodos(projectId: number): ProjectTodo[] {
  return getDb()
    .prepare('SELECT * FROM project_todos WHERE project_id = ? ORDER BY sort_order, id')
    .all(projectId) as ProjectTodo[]
}

export function createTodo(projectId: number, text: string): ProjectTodo {
  const db = getDb()
  const maxRow = db
    .prepare('SELECT MAX(sort_order) as m FROM project_todos WHERE project_id = ?')
    .get(projectId) as { m: number | null }
  const sortOrder = (maxRow.m ?? -1) + 1
  const result = db
    .prepare('INSERT INTO project_todos (project_id, text, sort_order) VALUES (?, ?, ?)')
    .run(projectId, text.trim(), sortOrder)
  return db.prepare('SELECT * FROM project_todos WHERE id = ?').get(result.lastInsertRowid) as ProjectTodo
}

export function updateTodo(
  todoId: number,
  changes: { text?: string; done?: boolean }
): ProjectTodo {
  const db = getDb()
  const sets: string[] = []
  const params: any[] = []
  if (changes.text !== undefined) { sets.push('text = ?'); params.push(changes.text.trim()) }
  if (changes.done !== undefined) { sets.push('done = ?'); params.push(changes.done ? 1 : 0) }
  if (sets.length > 0) {
    params.push(todoId)
    db.prepare(`UPDATE project_todos SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }
  return db.prepare('SELECT * FROM project_todos WHERE id = ?').get(todoId) as ProjectTodo
}

export function deleteTodo(todoId: number): void {
  getDb().prepare('DELETE FROM project_todos WHERE id = ?').run(todoId)
}
