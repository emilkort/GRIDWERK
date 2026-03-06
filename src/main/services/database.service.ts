import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function initDatabase(): Database.Database {
  const dbDir = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, 'producers-manager.db')
  db = new Database(dbPath)

  // Performance settings
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('cache_size = -16000')   // 16 MB page cache
  db.pragma('mmap_size = 268435456') // 256 MB memory-mapped I/O

  runMigrations(db)

  return db
}

function runMigrations(db: Database.Database): void {
  // Create migrations tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `)

  const migrationsDir = path.join(__dirname, '../db/migrations')
  // In dev mode, try the source path
  const possiblePaths = [
    migrationsDir,
    path.join(__dirname, '../../src/main/db/migrations'),
    path.join(process.cwd(), 'src/main/db/migrations')
  ]

  let migrationFiles: string[] = []
  let resolvedDir = ''

  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      migrationFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .sort()
      resolvedDir = dir
      break
    }
  }

  if (migrationFiles.length === 0) {
    console.warn('No migration files found, running inline schema...')
    runInlineSchema(db)
  } else {
    const applied = new Set(
      db.prepare('SELECT name FROM _migrations').all()
        .map((row: any) => row.name)
    )

    for (const file of migrationFiles) {
      if (applied.has(file)) continue

      const sql = fs.readFileSync(path.join(resolvedDir, file), 'utf-8')
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
      console.log(`Applied migration: ${file}`)
    }
  }

  // Always run incremental inline migrations regardless of path taken above
  runIncrementalMigrations(db)
}

/**
 * Safe, idempotent additive migrations. Each is guarded by a _migrations check
 * so it runs exactly once per database, even across cold starts.
 */
function runIncrementalMigrations(db: Database.Database): void {
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all()
      .map((row: any) => row.name)
  )

  // 002: sample favorites
  if (!applied.has('002_sample_favorites')) {
    try {
      db.exec('ALTER TABLE samples ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0')
      db.exec('CREATE INDEX IF NOT EXISTS idx_samples_favorite ON samples(is_favorite)')
    } catch { /* column already exists — safe to ignore */ }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('002_sample_favorites')
    console.log('Applied inline migration: 002_sample_favorites')
  }

  // 004: project todos
  if (!applied.has('004_project_todos')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_todos_project ON project_todos(project_id, sort_order)')
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('004_project_todos')
    console.log('Applied inline migration: 004_project_todos')
  }

  // 005: project priority field
  if (!applied.has('005_project_priority')) {
    try {
      db.exec("ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'")
    } catch { /* column already exists */ }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('005_project_priority')
    console.log('Applied inline migration: 005_project_priority')
  }

  // 006: custom stages table + remove hardcoded CHECK constraint from projects.stage
  if (!applied.has('006_custom_stages')) {
    // Temporarily disable FK checks so we can drop & recreate the projects table
    db.pragma('foreign_keys = OFF')
    try {
      // Check which columns exist on projects
      const cols = (db.prepare('PRAGMA table_info(projects)').all() as any[]).map((c: any) => c.name)
      const hasPriority = cols.includes('priority')

      // Recreate projects without the CHECK(stage IN ...) constraint
      db.exec(`
        CREATE TABLE projects_migration_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          stage TEXT NOT NULL DEFAULT 'idea',
          sort_order INTEGER NOT NULL DEFAULT 0,
          bpm REAL,
          musical_key TEXT,
          daw_project_id INTEGER REFERENCES daw_projects(id) ON DELETE SET NULL,
          color TEXT,
          priority TEXT NOT NULL DEFAULT 'normal',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        )
      `)
      if (hasPriority) {
        db.exec(`INSERT INTO projects_migration_new
          SELECT id, title, description, stage, sort_order, bpm, musical_key,
                 daw_project_id, color, priority, created_at, updated_at FROM projects`)
      } else {
        db.exec(`INSERT INTO projects_migration_new
          SELECT id, title, description, stage, sort_order, bpm, musical_key,
                 daw_project_id, color, 'normal', created_at, updated_at FROM projects`)
      }
      db.exec(`
        DROP TABLE projects;
        ALTER TABLE projects_migration_new RENAME TO projects;
        CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage, sort_order)
      `)
    } finally {
      db.pragma('foreign_keys = ON')
    }

    // Create stages table with defaults
    db.exec(`
      CREATE TABLE IF NOT EXISTS stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#888888',
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO stages (name, slug, color, sort_order) VALUES
        ('Idea', 'idea', '#3b82f6', 0),
        ('In Progress', 'in_progress', '#f97316', 1),
        ('Mixing', 'mixing', '#8b5cf6', 2),
        ('Done', 'done', '#22c55e', 3)
    `)

    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('006_custom_stages')
    console.log('Applied inline migration: 006_custom_stages')
  }

  // 007: AI features — embeddings, confidence scores, spectral features, waveform hash
  if (!applied.has('007_ai_features')) {
    try { db.exec('ALTER TABLE samples ADD COLUMN embedding BLOB') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN bpm_confidence REAL') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN key_confidence REAL') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN waveform_hash TEXT') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN spectral_centroid REAL') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN spectral_flatness REAL') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN zero_crossing_rate REAL') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN attack_time_ms REAL') } catch { /* exists */ }
    try { db.exec('ALTER TABLE samples ADD COLUMN onset_count INTEGER') } catch { /* exists */ }
    db.exec('CREATE INDEX IF NOT EXISTS idx_samples_waveform_hash ON samples(waveform_hash)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_samples_centroid ON samples(spectral_centroid)')
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('007_ai_features')
    console.log('Applied inline migration: 007_ai_features')
  }

  // 008: plugin reference library
  if (!applied.has('008_plugin_reference')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS plugin_reference (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        vendor TEXT,
        category TEXT,
        subcategory TEXT,
        description TEXT,
        image_url TEXT,
        website TEXT,
        formats TEXT,
        tags TEXT,
        source TEXT NOT NULL DEFAULT 'vst-guide-api',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_plugin_ref_normalized ON plugin_reference(normalized_name)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_plugin_ref_vendor ON plugin_reference(vendor)')
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_ref_name_vendor ON plugin_reference(normalized_name, COALESCE(vendor, \'\'))')
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('008_plugin_reference')
    console.log('Applied inline migration: 008_plugin_reference')
  }

  // 009: vst_plugins is_hidden flag
  if (!applied.has('009_vst_hidden')) {
    try { db.exec('ALTER TABLE vst_plugins ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0') } catch { /* exists */ }
    db.exec('CREATE INDEX IF NOT EXISTS idx_vst_plugins_hidden ON vst_plugins(is_hidden)')
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('009_vst_hidden')
    console.log('Applied inline migration: 009_vst_hidden')
  }

  // 010: project_plugins — tracks which VSTs are used in each DAW project (.als parsing)
  if (!applied.has('010_project_plugins')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_plugins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        plugin_name TEXT NOT NULL,
        format TEXT,
        file_name TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        UNIQUE(project_id, plugin_name)
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_plugins_name ON project_plugins(plugin_name)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_plugins_project ON project_plugins(project_id)')
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('010_project_plugins')
    console.log('Applied inline migration: 010_project_plugins')
  }

  // 003: indexed forward-slash path for fast subfolder filtering + composite indexes
  if (!applied.has('003_path_fwd_and_composite_indexes')) {
    try {
      // Normalized (lowercase, forward-slash) path column — avoids per-query LOWER(REPLACE(...))
      db.exec('ALTER TABLE samples ADD COLUMN file_path_fwd TEXT')
      // Backfill existing rows
      db.exec("UPDATE samples SET file_path_fwd = LOWER(REPLACE(file_path, char(92), '/')) WHERE file_path_fwd IS NULL")
      db.exec('CREATE INDEX IF NOT EXISTS idx_samples_file_path_fwd ON samples(file_path_fwd)')
    } catch { /* column already exists */ }
    try {
      // Composite indexes for the most common filter combinations
      db.exec('CREATE INDEX IF NOT EXISTS idx_samples_folder_category ON samples(folder_id, category)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_samples_folder_bpm ON samples(folder_id, bpm)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_samples_folder_name ON samples(folder_id, file_name)')
    } catch { /* indexes already exist */ }
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('003_path_fwd_and_composite_indexes')
    console.log('Applied inline migration: 003_path_fwd_and_composite_indexes')
  }
}

function runInlineSchema(db: Database.Database): void {
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all()
      .map((row: any) => row.name)
  )

  if (applied.has('001_initial.sql')) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS daws (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      executable_path TEXT NOT NULL,
      version TEXT,
      icon_name TEXT,
      project_extension TEXT NOT NULL,
      project_folders TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS daw_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      daw_id INTEGER NOT NULL REFERENCES daws(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      last_modified INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_daw_projects_daw ON daw_projects(daw_id);

    CREATE TABLE IF NOT EXISTS vst_scan_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL CHECK(format IN ('VST2','VST3')),
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS vst_plugins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_path_id INTEGER REFERENCES vst_scan_paths(id) ON DELETE SET NULL,
      file_path TEXT NOT NULL UNIQUE,
      plugin_name TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('VST2','VST3')),
      vendor TEXT,
      category TEXT DEFAULT 'Unknown',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER,
      last_modified INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vst_plugins_name ON vst_plugins(plugin_name);
    CREATE INDEX IF NOT EXISTS idx_vst_plugins_category ON vst_plugins(category);
    CREATE INDEX IF NOT EXISTS idx_vst_plugins_favorite ON vst_plugins(is_favorite);

    CREATE TABLE IF NOT EXISTS sample_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path TEXT NOT NULL UNIQUE,
      label TEXT,
      is_watched INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER REFERENCES sample_folders(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_extension TEXT NOT NULL,
      file_size INTEGER,
      duration_ms INTEGER,
      sample_rate INTEGER,
      channels INTEGER,
      bit_depth INTEGER,
      bpm REAL,
      musical_key TEXT,
      category TEXT DEFAULT 'other',
      waveform_data BLOB,
      last_modified INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_samples_folder ON samples(folder_id);
    CREATE INDEX IF NOT EXISTS idx_samples_category ON samples(category);
    CREATE INDEX IF NOT EXISTS idx_samples_bpm ON samples(bpm);
    CREATE INDEX IF NOT EXISTS idx_samples_key ON samples(musical_key);
    CREATE INDEX IF NOT EXISTS idx_samples_name ON samples(file_name);

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      stage TEXT NOT NULL DEFAULT 'idea' CHECK(stage IN ('idea','in_progress','mixing','done')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      bpm REAL,
      musical_key TEXT,
      daw_project_id INTEGER REFERENCES daw_projects(id) ON DELETE SET NULL,
      color TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage, sort_order);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT DEFAULT '#8b5cf6',
      is_auto INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS taggables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('sample','vst','project','daw_project')),
      entity_id INTEGER NOT NULL,
      UNIQUE(tag_id, entity_type, entity_id)
    );

    CREATE INDEX IF NOT EXISTS idx_taggables_entity ON taggables(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_taggables_tag ON taggables(tag_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      entity_type,
      entity_id UNINDEXED,
      title,
      tags,
      metadata,
      content='',
      tokenize='porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('001_initial.sql')
  console.log('Applied inline migration: 001_initial.sql')
}

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'data', 'producers-manager.db')
}

export async function backupDatabase(destPath?: string): Promise<string> {
  const database = getDb()
  const backupDir = destPath
    ? path.dirname(destPath)
    : path.join(app.getPath('userData'), 'data', 'backups')

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = destPath || path.join(backupDir, `producers-manager-backup-${timestamp}.db`)

  await database.backup(backupPath)

  return backupPath
}

export function closeDatabase(): void {
  if (db) {
    try { db.pragma('optimize') } catch { /* best-effort */ }
    db.close()
    db = null
  }
}
