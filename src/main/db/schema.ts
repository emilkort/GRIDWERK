// Database entity types matching SQL schema

export interface Daw {
  id: number
  name: string
  executable_path: string
  version: string | null
  icon_name: string | null
  icon_data: string | null
  project_extension: string
  project_folders: string // JSON array
  created_at: number
  updated_at: number
}

export interface DawProject {
  id: number
  daw_id: number
  file_path: string
  file_name: string
  file_size: number | null
  last_modified: number | null
  created_at: number
}

export interface VstScanPath {
  id: number
  folder_path: string
  format: 'VST2' | 'VST3'
  enabled: number
}

export interface VstPlugin {
  id: number
  scan_path_id: number | null
  file_path: string
  plugin_name: string
  format: 'VST2' | 'VST3'
  vendor: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  icon_url: string | null
  website: string | null
  enriched: number
  is_favorite: number
  is_hidden: number
  file_size: number | null
  last_modified: number | null
  created_at: number
  updated_at: number
}

export interface SampleFolder {
  id: number
  folder_path: string
  label: string | null
  is_watched: number
  created_at: number
}

export interface Sample {
  id: number
  folder_id: number | null
  file_path: string
  file_name: string
  file_extension: string
  file_size: number | null
  duration_ms: number | null
  sample_rate: number | null
  channels: number | null
  bit_depth: number | null
  bpm: number | null
  musical_key: string | null
  category: string | null
  waveform_data: Buffer | null
  is_favorite: number
  embedding: Buffer | null
  bpm_confidence: number | null
  key_confidence: number | null
  waveform_hash: string | null
  spectral_centroid: number | null
  spectral_flatness: number | null
  zero_crossing_rate: number | null
  attack_time_ms: number | null
  onset_count: number | null
  last_modified: number | null
  created_at: number
  updated_at: number
}

export interface Project {
  id: number
  title: string
  description: string | null
  stage: 'idea' | 'in_progress' | 'mixing' | 'done'
  sort_order: number
  bpm: number | null
  musical_key: string | null
  daw_project_id: number | null
  color: string | null
  track_count: number | null
  time_signature: string | null
  created_at: number
  updated_at: number
}

export interface Tag {
  id: number
  name: string
  color: string
  is_auto: number
  created_at: number
}

export interface Taggable {
  id: number
  tag_id: number
  entity_type: 'sample' | 'vst' | 'project' | 'daw_project'
  entity_id: number
}

export interface PluginReference {
  id: number
  name: string
  normalized_name: string
  vendor: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  image_url: string | null
  website: string | null
  formats: string | null // JSON array of format strings
  tags: string | null // JSON array of tag strings
  source: string // 'vst-guide-api' | 'pluginboutique' | 'manual'
  created_at: number
  updated_at: number
}

export interface Setting {
  key: string
  value: string
}

export type EntityType = Taggable['entity_type']
