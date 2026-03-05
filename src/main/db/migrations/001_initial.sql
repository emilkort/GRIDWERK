PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ========================================
-- DAW Registry
-- ========================================
CREATE TABLE IF NOT EXISTS daws (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    executable_path TEXT NOT NULL,
    version         TEXT,
    icon_name       TEXT,
    project_extension TEXT NOT NULL,
    project_folders TEXT NOT NULL DEFAULT '[]',
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS daw_projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    daw_id          INTEGER NOT NULL REFERENCES daws(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL UNIQUE,
    file_name       TEXT NOT NULL,
    file_size       INTEGER,
    last_modified   INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_daw_projects_daw ON daw_projects(daw_id);

-- ========================================
-- VST / Plugin Manager
-- ========================================
CREATE TABLE IF NOT EXISTS vst_scan_paths (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_path     TEXT NOT NULL UNIQUE,
    format          TEXT NOT NULL CHECK(format IN ('VST2','VST3')),
    enabled         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vst_plugins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_path_id    INTEGER REFERENCES vst_scan_paths(id) ON DELETE SET NULL,
    file_path       TEXT NOT NULL UNIQUE,
    plugin_name     TEXT NOT NULL,
    format          TEXT NOT NULL CHECK(format IN ('VST2','VST3')),
    vendor          TEXT,
    category        TEXT DEFAULT 'Unknown',
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    file_size       INTEGER,
    last_modified   INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_vst_plugins_name ON vst_plugins(plugin_name);
CREATE INDEX IF NOT EXISTS idx_vst_plugins_category ON vst_plugins(category);
CREATE INDEX IF NOT EXISTS idx_vst_plugins_favorite ON vst_plugins(is_favorite);

-- ========================================
-- Sample Library
-- ========================================
CREATE TABLE IF NOT EXISTS sample_folders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_path     TEXT NOT NULL UNIQUE,
    label           TEXT,
    is_watched      INTEGER NOT NULL DEFAULT 1,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS samples (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id       INTEGER REFERENCES sample_folders(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL UNIQUE,
    file_name       TEXT NOT NULL,
    file_extension  TEXT NOT NULL,
    file_size       INTEGER,
    duration_ms     INTEGER,
    sample_rate     INTEGER,
    channels        INTEGER,
    bit_depth       INTEGER,
    bpm             REAL,
    musical_key     TEXT,
    category        TEXT DEFAULT 'other',
    waveform_data   BLOB,
    last_modified   INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_samples_folder ON samples(folder_id);
CREATE INDEX IF NOT EXISTS idx_samples_category ON samples(category);
CREATE INDEX IF NOT EXISTS idx_samples_bpm ON samples(bpm);
CREATE INDEX IF NOT EXISTS idx_samples_key ON samples(musical_key);
CREATE INDEX IF NOT EXISTS idx_samples_name ON samples(file_name);

-- ========================================
-- Project Tracker (Kanban)
-- ========================================
CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    stage           TEXT NOT NULL DEFAULT 'idea'
                        CHECK(stage IN ('idea','in_progress','mixing','done')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    bpm             REAL,
    musical_key     TEXT,
    daw_project_id  INTEGER REFERENCES daw_projects(id) ON DELETE SET NULL,
    color           TEXT,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(stage, sort_order);

-- ========================================
-- Tag System
-- ========================================
CREATE TABLE IF NOT EXISTS tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color           TEXT DEFAULT '#8b5cf6',
    is_auto         INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS taggables (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL CHECK(entity_type IN ('sample','vst','project','daw_project')),
    entity_id       INTEGER NOT NULL,
    UNIQUE(tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_taggables_entity ON taggables(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_taggables_tag ON taggables(tag_id);

-- ========================================
-- Full-Text Search
-- ========================================
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type,
    entity_id UNINDEXED,
    title,
    tags,
    metadata,
    content='',
    tokenize='porter unicode61'
);

-- ========================================
-- App Settings
-- ========================================
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- ========================================
-- Migration tracking
-- ========================================
CREATE TABLE IF NOT EXISTS _migrations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    applied_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
