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

// ── HTML5 Audio engine with preload cache ────────────────────────────────────

let audio: HTMLAudioElement | null = null
let rafHandle: number | null = null
let lastTimeUpdate = 0

// Preloaded audio elements — adjacent samples ready for instant playback
const preloadCache = new Map<string, HTMLAudioElement>()
const MAX_PRELOAD = 8

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map((seg) => (seg === '' || /^[a-zA-Z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join('/')
  return /^[a-zA-Z]:/.test(normalized) ? `file:///${encoded}` : `file://${encoded}`
}

function stopTracking(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
}

/** Preload a file for instant playback later */
function preloadFile(filePath: string): void {
  if (preloadCache.has(filePath)) return
  const el = new Audio()
  el.preload = 'auto'
  el.src = filePathToUrl(filePath)
  el.load()
  preloadCache.set(filePath, el)

  if (preloadCache.size > MAX_PRELOAD) {
    const firstKey = preloadCache.keys().next().value!
    const old = preloadCache.get(firstKey)
    if (old) { old.pause(); old.src = '' }
    preloadCache.delete(firstKey)
  }
}

/** Prefetch adjacent samples */
function prefetchNeighbors(filePath: string): void {
  try {
    const samples = useSampleStore.getState().samples
    const idx = samples.findIndex((s) => s.file_path === filePath)
    if (idx < 0) return
    for (const n of [samples[idx + 1], samples[idx - 1], samples[idx + 2], samples[idx - 2]]) {
      if (n) preloadFile(n.file_path)
    }
  } catch { /* ignore */ }
}

export const useAudioPlayerStore = create<AudioPlayerStore>((set, get) => {
  // Position tracking — only updates store at ~15fps to minimize re-renders
  // but feels smooth because WaveformPreview interpolates via CSS/canvas
  function trackPosition(): void {
    if (!audio || audio.paused) return
    const now = performance.now()
    if (now - lastTimeUpdate >= 66) { // ~15fps — enough for smooth progress bars
      set({ currentTime: audio.currentTime })
      lastTimeUpdate = now
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
      const state = get()

      // Already playing this file
      if (state.currentFilePath === filePath && state.isPlaying) return

      // Resume from pause (same file)
      if (state.currentFilePath === filePath && !state.isPlaying && audio) {
        audio.play().catch(() => {})
        set({ isPlaying: true, isEnded: false })
        lastTimeUpdate = 0
        rafHandle = requestAnimationFrame(trackPosition)
        return
      }

      // New file — stop current immediately
      if (audio) {
        audio.pause()
        audio.onended = null
        audio.onerror = null
      }
      stopTracking()

      // Set state immediately (no await) for instant UI response
      set({
        currentFilePath: filePath,
        currentTime: 0,
        duration: 0,
        isEnded: false,
        isPlaying: true
      })

      // Use preloaded element if available
      const preloaded = preloadCache.get(filePath)
      if (preloaded) {
        preloadCache.delete(filePath)
        audio = preloaded
        audio.currentTime = 0
      } else {
        audio = new Audio()
        audio.preload = 'auto'
        audio.src = filePathToUrl(filePath)
      }

      const el = audio

      // Wire minimal events (no onplay — we already set isPlaying above)
      el.onended = () => {
        stopTracking()
        set({ isPlaying: false, currentTime: 0, isEnded: true })
      }
      el.onerror = () => {
        console.error('[AudioPlayer] playback error:', el.error?.message)
        stopTracking()
        set({ isPlaying: false })
      }

      // Set duration as soon as known
      if (Number.isFinite(el.duration) && el.duration > 0) {
        set({ duration: el.duration })
      } else {
        el.ondurationchange = () => {
          if (Number.isFinite(el.duration)) {
            set({ duration: el.duration })
            el.ondurationchange = null
          }
        }
      }

      // Start playback (fire-and-forget for responsiveness)
      el.play().catch((err) => {
        console.error('[AudioPlayer] play() failed:', err)
        set({ isPlaying: false })
      })

      // Start position tracking
      lastTimeUpdate = 0
      rafHandle = requestAnimationFrame(trackPosition)

      // Prefetch neighbors in background
      prefetchNeighbors(filePath)
    },

    pause: () => {
      if (!audio) return
      audio.pause()
      stopTracking()
      set({ isPlaying: false, currentTime: audio.currentTime })
    },

    stop: () => {
      if (audio) { audio.pause(); audio.currentTime = 0 }
      stopTracking()
      set({ isPlaying: false, currentTime: 0 })
    },

    seek: (ratio: number) => {
      if (!audio || !Number.isFinite(audio.duration)) return
      const target = Math.max(0, Math.min(1, ratio)) * audio.duration
      audio.currentTime = target
      set({ currentTime: target })
    }
  }
})
