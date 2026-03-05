import { BrowserWindow } from 'electron'
import * as path from 'node:path'
import * as os from 'node:os'
import Piscina from 'piscina'
import { getDb } from './database.service'
import * as sampleService from './sample.service'
import { rebuildSearchIndex } from './search.service'
import type { Sample } from '../db/schema'
import type { AnalysisResultData } from '../workers/audio-analysis.protocol'

// ============================================================
// Types
// ============================================================

export interface AnalysisResult {
  duration_ms: number | null
  sample_rate: number | null
  channels: number | null
  bit_depth: number | null
  bpm: number | null
  bpm_confidence: number | null
  musical_key: string | null
  key_confidence: number | null
  category: string
  waveform_peaks: number[]
  waveform_hash: string | null
  embedding: number[]
  spectral_centroid: number | null
  spectral_flatness: number | null
  zero_crossing_rate: number | null
  attack_time_ms: number | null
  onset_count: number | null
}

// ============================================================
// Piscina Worker Pool
// ============================================================

let pool: Piscina | null = null

function getPool(): Piscina {
  if (!pool) {
    pool = new Piscina({
      filename: path.join(__dirname, 'audio-analysis.worker.js'),
      maxThreads: Math.max(2, Math.min(os.cpus().length - 2, 6)),
      idleTimeout: 30000
    })
  }
  return pool
}

export function destroyAnalysisWorker(): void {
  if (pool) {
    pool.destroy()
    pool = null
  }
}

// ============================================================
// Quick metadata extraction (stays in main process — fast, header-only)
// ============================================================

export async function extractQuickMetadata(
  filePath: string
): Promise<{
  duration_ms: number | null
  sample_rate: number | null
  channels: number | null
  bit_depth: number | null
}> {
  try {
    const mm = await import('music-metadata')
    const metadata = await mm.parseFile(filePath, { duration: true })
    return {
      duration_ms: metadata.format.duration
        ? Math.round(metadata.format.duration * 1000)
        : null,
      sample_rate: metadata.format.sampleRate ?? null,
      channels: metadata.format.numberOfChannels ?? null,
      bit_depth: metadata.format.bitsPerSample ?? null
    }
  } catch (err) {
    console.error(`Failed to extract metadata from ${filePath}:`, err)
    return { duration_ms: null, sample_rate: null, channels: null, bit_depth: null }
  }
}

// ============================================================
// Public API
// ============================================================

export async function analyzeSample(sampleId: number): Promise<AnalysisResult | null> {
  const sample = sampleService.getSample(sampleId)
  if (!sample) return null

  const p = getPool()
  const workerResult: AnalysisResultData = await p.run({
    filePath: sample.file_path,
    currentCategory: sample.category || 'other'
  })

  const result: AnalysisResult = { ...workerResult }

  // DB write stays in main thread (better-sqlite3 is not thread-safe)
  sampleService.updateSample(sampleId, {
    duration_ms: result.duration_ms,
    sample_rate: result.sample_rate,
    channels: result.channels,
    bit_depth: result.bit_depth,
    bpm: result.bpm,
    bpm_confidence: result.bpm_confidence,
    musical_key: result.musical_key,
    key_confidence: result.key_confidence,
    category: result.category,
    waveform_data:
      result.waveform_peaks.length > 0
        ? Buffer.from(JSON.stringify(result.waveform_peaks))
        : null,
    waveform_hash: result.waveform_hash,
    embedding:
      result.embedding.length > 0
        ? Buffer.from(JSON.stringify(result.embedding))
        : null,
    spectral_centroid: result.spectral_centroid,
    spectral_flatness: result.spectral_flatness,
    zero_crossing_rate: result.zero_crossing_rate,
    attack_time_ms: result.attack_time_ms,
    onset_count: result.onset_count
  })

  return result
}

export async function getWaveformPeaks(sampleId: number): Promise<number[]> {
  const sample = sampleService.getSample(sampleId)
  if (!sample) return []

  // Return cached peaks if available — never trigger analysis as side-effect
  if (sample.waveform_data) {
    try {
      const data =
        sample.waveform_data instanceof Buffer
          ? sample.waveform_data.toString('utf-8')
          : String(sample.waveform_data)
      return JSON.parse(data) as number[]
    } catch {
      return []
    }
  }

  return []
}

// Throttle progress IPC to max 1 event per 200ms to avoid saturating the IPC channel
// when analyzing large libraries (otherwise it's 1 IPC call per file = thousands of calls).
let lastProgressEmitMs = 0

function sendProgress(
  win: BrowserWindow | null | undefined,
  data: { current: number; total: number; currentFile: string; sampleId: number }
): void {
  if (!win) return
  const now = Date.now()
  // Always emit the final event; throttle all intermediate ones
  if (now - lastProgressEmitMs < 200 && data.current < data.total) return
  lastProgressEmitMs = now
  try {
    win.webContents.send('analysis:progress', data)
  } catch {
    // Window may have been closed / frame disposed
  }
}

export async function analyzeFolder(
  folderId: number,
  win?: BrowserWindow | null
): Promise<void> {
  const db = getDb()
  const unanalyzed = db
    .prepare(
      'SELECT * FROM samples WHERE folder_id = ? AND (waveform_data IS NULL OR bpm IS NULL) ORDER BY file_name'
    )
    .all(folderId) as Sample[]

  const total = unanalyzed.length
  if (total === 0) {
    if (win) {
      try {
        win.webContents.send('analysis:complete', { folderId, successCount: 0, total: 0 })
      } catch { /* disposed */ }
    }
    return
  }

  let successCount = 0
  let completed = 0
  const p = getPool()

  // Submit all tasks at once — Piscina queues internally and respects maxThreads.
  // Avoids the "wait for slowest file in batch" stall of the old chunk approach.
  await Promise.all(
    unanalyzed.map(async (sample) => {
      try {
        const workerResult: AnalysisResultData = await p.run({
          filePath: sample.file_path,
          currentCategory: sample.category || 'other'
        })

        // DB write in main thread (better-sqlite3 is not thread-safe)
        sampleService.updateSample(sample.id, {
          duration_ms: workerResult.duration_ms,
          sample_rate: workerResult.sample_rate,
          channels: workerResult.channels,
          bit_depth: workerResult.bit_depth,
          bpm: workerResult.bpm,
          bpm_confidence: workerResult.bpm_confidence,
          musical_key: workerResult.musical_key,
          key_confidence: workerResult.key_confidence,
          category: workerResult.category,
          waveform_data:
            workerResult.waveform_peaks.length > 0
              ? Buffer.from(JSON.stringify(workerResult.waveform_peaks))
              : null,
          waveform_hash: workerResult.waveform_hash,
          embedding:
            workerResult.embedding.length > 0
              ? Buffer.from(JSON.stringify(workerResult.embedding))
              : null,
          spectral_centroid: workerResult.spectral_centroid,
          spectral_flatness: workerResult.spectral_flatness,
          zero_crossing_rate: workerResult.zero_crossing_rate,
          attack_time_ms: workerResult.attack_time_ms,
          onset_count: workerResult.onset_count
        })

        successCount++
      } catch (err) {
        console.error(`Failed to analyze ${sample.file_name}:`, err)
      }

      completed++
      sendProgress(win, {
        current: completed,
        total,
        currentFile: sample.file_name,
        sampleId: sample.id
      })
    })
  )

  // Rebuild FTS5 search index with updated BPM/key/category data
  try {
    rebuildSearchIndex()
  } catch { /* non-critical */ }

  // Send completion event so renderer can refresh
  if (win) {
    try {
      win.webContents.send('analysis:complete', { folderId, successCount, total })
    } catch { /* disposed */ }
  }
}
