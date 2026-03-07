import { getDb } from './database.service'

interface SimilarResult {
  id: number
  file_name: string
  file_path: string
  category: string | null
  similarity: number
}

interface DuplicateGroup {
  hash: string
  samples: { id: number; file_name: string; file_path: string; file_size: number | null }[]
}

interface NearDuplicateGroup {
  samples: { id: number; file_name: string; file_path: string; file_size: number | null; similarity: number }[]
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export function findSimilarSamples(sampleId: number, limit: number = 20): SimilarResult[] {
  const db = getDb()

  const target = db.prepare('SELECT embedding FROM samples WHERE id = ?').get(sampleId) as { embedding: Buffer | null } | undefined
  if (!target?.embedding) return []

  let targetVec: number[]
  try {
    targetVec = JSON.parse(target.embedding.toString('utf-8'))
  } catch {
    return []
  }

  const rows = db.prepare(
    'SELECT id, file_name, file_path, category, embedding FROM samples WHERE id != ? AND embedding IS NOT NULL LIMIT 5000'
  ).all(sampleId) as { id: number; file_name: string; file_path: string; category: string | null; embedding: Buffer }[]

  const results: SimilarResult[] = []
  for (const row of rows) {
    try {
      const vec = JSON.parse(row.embedding.toString('utf-8')) as number[]
      const sim = cosineSimilarity(targetVec, vec)
      if (sim > 0.5) {
        results.push({
          id: row.id,
          file_name: row.file_name,
          file_path: row.file_path,
          category: row.category,
          similarity: Math.round(sim * 1000) / 1000
        })
      }
    } catch { /* skip corrupt */ }
  }

  results.sort((a, b) => b.similarity - a.similarity)
  return results.slice(0, limit)
}

export function findDuplicates(): { exact: DuplicateGroup[]; near: NearDuplicateGroup[] } {
  const db = getDb()

  // Exact duplicates: same waveform hash
  const hashGroups = db.prepare(
    `SELECT waveform_hash, COUNT(*) as cnt FROM samples
     WHERE waveform_hash IS NOT NULL
     GROUP BY waveform_hash HAVING cnt > 1`
  ).all() as { waveform_hash: string; cnt: number }[]

  const exact: DuplicateGroup[] = []
  for (const g of hashGroups) {
    const samples = db.prepare(
      'SELECT id, file_name, file_path, file_size FROM samples WHERE waveform_hash = ? ORDER BY file_name'
    ).all(g.waveform_hash) as { id: number; file_name: string; file_path: string; file_size: number | null }[]
    exact.push({ hash: g.waveform_hash, samples })
  }

  // Near duplicates: similar duration + high waveform peak cosine similarity
  const near: NearDuplicateGroup[] = []
  const analyzed = db.prepare(
    'SELECT id, file_name, file_path, file_size, duration_ms, embedding FROM samples WHERE embedding IS NOT NULL AND waveform_hash IS NOT NULL ORDER BY duration_ms LIMIT 5000'
  ).all() as { id: number; file_name: string; file_path: string; file_size: number | null; duration_ms: number | null; embedding: Buffer }[]

  // Group by similar duration (within 10%) and check embedding similarity
  const usedIds = new Set<number>()
  // Collect exact dupe IDs to skip
  for (const g of exact) {
    for (const s of g.samples) usedIds.add(s.id)
  }

  for (let i = 0; i < analyzed.length; i++) {
    if (usedIds.has(analyzed[i].id)) continue
    const group: NearDuplicateGroup['samples'] = []
    let vecA: number[]
    try {
      vecA = JSON.parse(analyzed[i].embedding.toString('utf-8'))
    } catch { continue }

    for (let j = i + 1; j < analyzed.length; j++) {
      if (usedIds.has(analyzed[j].id)) continue
      const durA = analyzed[i].duration_ms || 0
      const durB = analyzed[j].duration_ms || 0
      // Only compare if durations are within 15%
      if (durA > 0 && durB > 0 && Math.abs(durA - durB) / Math.max(durA, durB) > 0.15) continue

      let vecB: number[]
      try {
        vecB = JSON.parse(analyzed[j].embedding.toString('utf-8'))
      } catch { continue }

      const sim = cosineSimilarity(vecA, vecB)
      if (sim > 0.95) {
        if (group.length === 0) {
          group.push({ ...analyzed[i], similarity: 1.0 })
          usedIds.add(analyzed[i].id)
        }
        group.push({ ...analyzed[j], similarity: Math.round(sim * 1000) / 1000 })
        usedIds.add(analyzed[j].id)
      }
    }

    if (group.length > 1) {
      near.push({ samples: group })
    }
  }

  return { exact, near }
}
