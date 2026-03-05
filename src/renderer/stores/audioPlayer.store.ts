import { create } from 'zustand'
import { useSampleStore } from '@/stores/sample.store'

interface AudioPlayerStore {
  isPlaying: boolean
  isEnded: boolean
  currentTime: number
  duration: number
  currentFilePath: string | null

  play: (filePath: string) => Promise<void>
  pause: () => void
  stop: () => void
  seek: (ratio: number) => void
}

// ── Web Audio API engine with AudioBuffer LRU cache ─────────────────────────

let ctx: AudioContext | null = null
let sourceNode: AudioBufferSourceNode | null = null
let currentBuffer: AudioBuffer | null = null
let rafHandle: number | null = null
let lastUpdate = 0

// Playback position tracking (AudioBufferSourceNode is one-shot)
let startedAt = 0      // context.currentTime when playback started
let pauseOffset = 0    // seconds into the buffer where we paused
let playing = false     // internal flag (avoids store reads in hot path)
let stoppedByUser = false // distinguishes stop() from natural end

// LRU AudioBuffer cache — decode once, play instantly forever
const bufferCache = new Map<string, AudioBuffer>()
const MAX_CACHE = 50

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map((seg) => seg === '' || /^[a-zA-Z]:$/.test(seg) ? seg : encodeURIComponent(seg))
    .join('/')
  return /^[a-zA-Z]:/.test(normalized) ? `file:///${encoded}` : `file://${encoded}`
}

/** Fetch, decode, and cache an AudioBuffer. Returns cached if available. */
async function fetchAndDecode(filePath: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(filePath)
  if (cached) {
    // Move to end (LRU touch)
    bufferCache.delete(filePath)
    bufferCache.set(filePath, cached)
    return cached
  }

  const ac = getCtx()
  const url = filePathToUrl(filePath)
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ac.decodeAudioData(arrayBuffer)

  // Cache with LRU eviction
  bufferCache.set(filePath, audioBuffer)
  if (bufferCache.size > MAX_CACHE) {
    const firstKey = bufferCache.keys().next().value!
    bufferCache.delete(firstKey)
  }

  return audioBuffer
}

function stopTracking(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
}

function stopSource(): void {
  if (sourceNode) {
    try {
      sourceNode.onended = null
      sourceNode.stop()
    } catch { /* already stopped */ }
    sourceNode.disconnect()
    sourceNode = null
  }
}

/** Create and start a new AudioBufferSourceNode at the given offset */
function startSourceAt(buffer: AudioBuffer, offset: number, store: typeof useAudioPlayerStore): void {
  const ac = getCtx()
  stopSource()

  const source = ac.createBufferSource()
  source.buffer = buffer
  source.connect(ac.destination)

  source.onended = () => {
    // Only fire isEnded if playback reached the natural end (not user stop/seek)
    if (!stoppedByUser && playing) {
      playing = false
      stopTracking()
      store.setState({ isPlaying: false, currentTime: 0, isEnded: true })
    }
  }

  source.start(0, offset)
  sourceNode = source
  currentBuffer = buffer
  startedAt = ac.currentTime - offset
  pauseOffset = 0
  playing = true
  stoppedByUser = false
}

/** Prefetch adjacent samples for instant arrow-key navigation */
function prefetchNeighbors(filePath: string): void {
  try {
    const samples = useSampleStore.getState().samples
    const idx = samples.findIndex((s) => s.file_path === filePath)
    if (idx < 0) return

    for (const neighbor of [samples[idx + 1], samples[idx - 1], samples[idx + 2], samples[idx - 2]]) {
      if (neighbor) {
        fetchAndDecode(neighbor.file_path).catch(() => { /* ignore preload errors */ })
      }
    }
  } catch { /* ignore */ }
}

export const useAudioPlayerStore = create<AudioPlayerStore>((set) => {
  function trackPosition(): void {
    if (!playing || !ctx) return
    const now = performance.now()
    if (now - lastUpdate >= 50) {
      const elapsed = ctx.currentTime - startedAt
      const dur = currentBuffer?.duration ?? 0
      set({ currentTime: Math.min(elapsed, dur) })
      lastUpdate = now
    }
    rafHandle = requestAnimationFrame(trackPosition)
  }

  return {
    isPlaying: false,
    isEnded: false,
    currentTime: 0,
    duration: 0,
    currentFilePath: null,

    play: async (filePath: string) => {
      try {
        const state = useAudioPlayerStore.getState()

        // Already playing this file
        if (state.currentFilePath === filePath && state.isPlaying) {
          return
        }

        // Resume from pause (same file, same buffer)
        if (state.currentFilePath === filePath && !state.isPlaying && currentBuffer) {
          startSourceAt(currentBuffer, pauseOffset, useAudioPlayerStore)
          set({ isPlaying: true, isEnded: false })
          lastUpdate = 0
          rafHandle = requestAnimationFrame(trackPosition)
          return
        }

        // New file — stop current playback
        stoppedByUser = true
        playing = false
        stopSource()
        stopTracking()

        // Decode (instant if cached)
        const buffer = await fetchAndDecode(filePath)

        set({
          currentFilePath: filePath,
          currentTime: 0,
          duration: buffer.duration,
          isEnded: false,
          isPlaying: true
        })

        startSourceAt(buffer, 0, useAudioPlayerStore)
        lastUpdate = 0
        rafHandle = requestAnimationFrame(trackPosition)

        // Prefetch neighbors for fast arrow-key navigation
        prefetchNeighbors(filePath)
      } catch (err) {
        console.error('[AudioPlayer] play() failed:', err)
        set({ isPlaying: false })
        stopTracking()
      }
    },

    pause: () => {
      if (!playing || !ctx) return
      stoppedByUser = true
      pauseOffset = ctx.currentTime - startedAt
      playing = false
      stopSource()
      stopTracking()
      set({ isPlaying: false, currentTime: pauseOffset })
    },

    stop: () => {
      stoppedByUser = true
      playing = false
      pauseOffset = 0
      stopSource()
      stopTracking()
      set({ isPlaying: false, currentTime: 0 })
    },

    seek: (ratio: number) => {
      if (!currentBuffer) return
      const dur = currentBuffer.duration
      const offset = Math.max(0, Math.min(1, ratio)) * dur
      const wasPlaying = playing

      stoppedByUser = true
      playing = false
      stopSource()
      stopTracking()

      if (wasPlaying) {
        startSourceAt(currentBuffer, offset, useAudioPlayerStore)
        set({ currentTime: offset, isPlaying: true })
        lastUpdate = 0
        rafHandle = requestAnimationFrame(trackPosition)
      } else {
        pauseOffset = offset
        set({ currentTime: offset })
      }
    }
  }
})
