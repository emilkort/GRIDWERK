import { useEffect, useMemo, useState } from 'react'

interface UseWaveformReturn {
  peaks: number[]
  loading: boolean
}

function parseCachedWaveform(data: any): number[] | null {
  if (!data) return null
  try {
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return JSON.parse(new TextDecoder().decode(data))
    }
    if (typeof data === 'string') {
      return JSON.parse(data)
    }
    if (Array.isArray(data)) {
      return data
    }
    // Electron serializes Buffer as { type: 'Buffer', data: [...] }
    if (data.type === 'Buffer' && Array.isArray(data.data)) {
      return JSON.parse(new TextDecoder().decode(new Uint8Array(data.data)))
    }
    return JSON.parse(String(data))
  } catch {
    return null
  }
}

export default function useWaveform(
  sampleId: number | null,
  cachedWaveformData: any,
  hasWaveform: boolean = false
): UseWaveformReturn {
  const [fetchedPeaks, setFetchedPeaks] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  // Synchronously parse cached data with useMemo (instant, no flash of empty state)
  const cachedPeaks = useMemo(
    () => parseCachedWaveform(cachedWaveformData),
    [cachedWaveformData]
  )

  // Fetch from main process only when waveform exists in DB but isn't in the cached data
  useEffect(() => {
    if (sampleId === null || cachedPeaks || !hasWaveform) {
      setFetchedPeaks([])
      return
    }

    let cancelled = false
    setLoading(true)

    window.api.sample
      .getWaveform(sampleId)
      .then((result) => {
        if (!cancelled && Array.isArray(result)) setFetchedPeaks(result)
      })
      .catch(() => {
        if (!cancelled) setFetchedPeaks([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sampleId, cachedPeaks, hasWaveform])

  return {
    peaks: cachedPeaks ?? fetchedPeaks,
    loading: !cachedPeaks && loading
  }
}
