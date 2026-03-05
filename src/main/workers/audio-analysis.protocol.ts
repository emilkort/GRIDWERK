// Message protocol between main thread and audio analysis worker

// ============================================================
// Main Thread → Worker
// ============================================================

export interface AnalyzeFileRequest {
  type: 'analyze-file'
  requestId: string
  filePath: string
  currentCategory: string
}

export type WorkerRequest = AnalyzeFileRequest

// ============================================================
// Worker → Main Thread
// ============================================================

export interface AnalysisResultData {
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

export interface AnalyzeFileResponse {
  type: 'analyze-file-result'
  requestId: string
  success: true
  result: AnalysisResultData
}

export interface AnalyzeFileError {
  type: 'analyze-file-error'
  requestId: string
  success: false
  error: string
}

export interface WorkerReady {
  type: 'ready'
}

export type WorkerResponse = AnalyzeFileResponse | AnalyzeFileError | WorkerReady
