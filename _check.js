const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(process.env.APPDATA, 'producers-manager/data/producers-manager.db'))

// Simulate what listProjects does
try {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM project_todos t WHERE t.project_id = p.id) as todo_count,
      (SELECT COUNT(*) FROM project_todos t WHERE t.project_id = p.id AND t.done = 1) as done_count,
      dp.file_name as daw_file_name,
      dp.last_modified as daw_last_modified,
      d.name as daw_name,
      COALESCE(
        (SELECT json_group_array(json_object('id', tg2.tag_id, 'name', t2.name, 'color', t2.color))
         FROM taggables tg2 JOIN tags t2 ON t2.id = tg2.tag_id
         WHERE tg2.entity_type = 'project' AND tg2.entity_id = p.id),
        '[]'
      ) as tags_json
    FROM projects p
    LEFT JOIN daw_projects dp ON dp.id = p.daw_project_id
    LEFT JOIN daws d ON d.id = dp.daw_id
    ORDER BY p.sort_order ASC
  `).all()
  console.log('Total projects from query:', rows.length)
  console.log('First project:', JSON.stringify(rows[0], null, 2))
} catch (err) {
  console.error('ERROR:', err.message)
}

db.close()
