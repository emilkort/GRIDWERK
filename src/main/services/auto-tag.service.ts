/**
 * auto-tag.service.ts
 *
 * Suggests and applies tags to samples based on file path keywords,
 * spectral features, category, and BPM range.
 */
import { getDb } from './database.service'
import type { Sample, Tag } from '../db/schema'

// Tag colors for auto-generated tags
const AUTO_TAG_COLORS: Record<string, string> = {
  // Category-based
  kick: '#ef4444', snare: '#f97316', 'hi-hat': '#fbbf24', clap: '#f59e0b',
  percussion: '#f97316', bass: '#8b5cf6', vocal: '#ec4899', fx: '#06b6d4',
  pad: '#3b82f6', synth: '#6366f1', keys: '#8b5cf6', guitar: '#22c55e',
  loop: '#14b8a6', 'one-shot': '#f43f5e',
  // Spectral-based
  bright: '#fbbf24', warm: '#f97316', noisy: '#6b7280', texture: '#64748b',
  percussive: '#ef4444', ambient: '#3b82f6',
  // BPM-based
  slow: '#3b82f6', 'mid-tempo': '#22c55e', uptempo: '#f97316', fast: '#ef4444',
  // Path-based genre hints
  trap: '#ef4444', house: '#3b82f6', 'drum & bass': '#f97316', hiphop: '#8b5cf6',
  lofi: '#6b7280', cinematic: '#1e40af', electronic: '#6366f1'
}

const PATH_KEYWORD_MAP: Record<string, string> = {
  drums: 'percussion', drum: 'percussion', kick: 'kick', snare: 'snare',
  'hi-hat': 'hi-hat', hihat: 'hi-hat', hat: 'hi-hat', clap: 'clap',
  bass: 'bass', vocal: 'vocal', vox: 'vocal', fx: 'fx', sfx: 'fx',
  pad: 'pad', synth: 'synth', piano: 'keys', keys: 'keys', guitar: 'guitar',
  loop: 'loop', oneshot: 'one-shot', 'one-shot': 'one-shot', 'one shot': 'one-shot',
  ambient: 'ambient', trap: 'trap', house: 'house', dnb: 'drum & bass',
  hiphop: 'hiphop', 'hip-hop': 'hiphop', 'hip hop': 'hiphop',
  lofi: 'lofi', 'lo-fi': 'lofi', cinematic: 'cinematic', electronic: 'electronic'
}

export function suggestTagsForSample(sample: {
  file_path: string
  category: string | null
  bpm: number | null
  spectral_centroid: number | null
  spectral_flatness: number | null
  zero_crossing_rate: number | null
  attack_time_ms: number | null
  onset_count: number | null
  duration_ms: number | null
}): string[] {
  const tags = new Set<string>()

  // 1. File path keywords
  const pathLower = sample.file_path.toLowerCase().replace(/\\/g, '/')
  const pathParts = pathLower.split('/')
  for (const part of pathParts) {
    for (const [keyword, tag] of Object.entries(PATH_KEYWORD_MAP)) {
      if (part.includes(keyword)) {
        tags.add(tag)
      }
    }
  }

  // 2. Category
  if (sample.category && sample.category !== 'other' && sample.category !== 'Unknown') {
    tags.add(sample.category.toLowerCase())
  }

  // 3. Spectral features
  if (sample.spectral_centroid != null) {
    if (sample.spectral_centroid > 5000 && (sample.zero_crossing_rate ?? 0) > 0.15) {
      tags.add('bright')
    }
    if (sample.spectral_centroid < 1500 && (sample.spectral_flatness ?? 1) < 0.3) {
      tags.add('warm')
    }
  }
  if (sample.spectral_flatness != null && sample.spectral_flatness > 0.7) {
    tags.add('noisy')
  }
  if (sample.attack_time_ms != null && sample.attack_time_ms < 5 && (sample.onset_count ?? 0) <= 2) {
    tags.add('percussive')
  }
  if ((sample.duration_ms ?? 0) > 3000 && (sample.onset_count ?? 0) <= 3) {
    tags.add('ambient')
  }

  // 4. BPM range
  if (sample.bpm != null) {
    if (sample.bpm < 90) tags.add('slow')
    else if (sample.bpm < 120) tags.add('mid-tempo')
    else if (sample.bpm < 150) tags.add('uptempo')
    else tags.add('fast')
  }

  return [...tags]
}

/**
 * Auto-tag all untagged samples. Returns number of samples tagged.
 */
export function autoTagUntaggedSamples(): { tagged: number; tagsCreated: number } {
  const db = getDb()

  // Get untagged samples with their spectral features
  const untagged = db.prepare(
    `SELECT s.id, s.file_path, s.category, s.bpm,
       s.spectral_centroid, s.spectral_flatness, s.zero_crossing_rate,
       s.attack_time_ms, s.onset_count, s.duration_ms
     FROM samples s
     WHERE s.id NOT IN (SELECT entity_id FROM taggables WHERE entity_type = 'sample')
     LIMIT 5000`
  ).all() as any[]

  if (untagged.length === 0) return { tagged: 0, tagsCreated: 0 }

  // Cache existing tags
  const existingTags = new Map<string, number>()
  const allTags = db.prepare('SELECT id, name FROM tags').all() as { id: number; name: string }[]
  for (const t of allTags) existingTags.set(t.name.toLowerCase(), t.id)

  const createTag = db.prepare('INSERT INTO tags (name, color, is_auto) VALUES (?, ?, 1)')
  const attachTag = db.prepare('INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) VALUES (?, ?, ?)')

  let tagged = 0
  let tagsCreated = 0

  const tx = db.transaction(() => {
    for (const sample of untagged) {
      const suggestions = suggestTagsForSample(sample)
      if (suggestions.length === 0) continue

      for (const tagName of suggestions) {
        let tagId = existingTags.get(tagName.toLowerCase())
        if (!tagId) {
          const color = AUTO_TAG_COLORS[tagName] ?? '#8b5cf6'
          const result = createTag.run(tagName, color)
          tagId = Number(result.lastInsertRowid)
          existingTags.set(tagName.toLowerCase(), tagId)
          tagsCreated++
        }
        attachTag.run(tagId, 'sample', sample.id)
      }
      tagged++
    }
  })
  tx()

  return { tagged, tagsCreated }
}
