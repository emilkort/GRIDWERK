import { useCallback, useState } from 'react'
import type { Sample } from '@/stores/sample.store'
import { useSampleStore } from '@/stores/sample.store'
import WaveSurferWaveform from './WaveSurferWaveform'
import useWaveform from '@/hooks/useWaveform'
import TagPicker from '@/components/tags/TagPicker'
import { getCamelotColor, getCamelotLabel } from '@/utils/camelot'

interface SimilarSample {
  id: number
  file_name: string
  file_path: string
  category: string | null
  similarity: number
}

interface SampleDetailPanelProps {
  sample: Sample | null
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  const totalSec = ms / 1000
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`
  const mins = Math.floor(totalSec / 60)
  const secs = Math.floor(totalSec % 60)
  return `${mins}m ${secs}s`
}

function formatSampleRate(rate: number | null): string {
  if (rate === null) return '--'
  return `${(rate / 1000).toFixed(1)} kHz`
}

export default function SampleDetailPanel({ sample }: SampleDetailPanelProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [similarSamples, setSimilarSamples] = useState<SimilarSample[]>([])
  const [findingSimilar, setFindingSimilar] = useState(false)
  const [showSimilar, setShowSimilar] = useState(false)
  const { peaks, loading: waveformLoading } = useWaveform(
    sample?.id ?? null,
    sample?.waveform_data,
    !!sample?.has_waveform
  )
  const fetchSamples = useSampleStore((s) => s.fetchSamples)
  const toggleFavorite = useSampleStore((s) => s.toggleFavorite)

  const handleFindSimilar = useCallback(async () => {
    if (!sample || findingSimilar) return
    setFindingSimilar(true)
    try {
      const results = await window.api.sample.findSimilar(sample.id, 20)
      setSimilarSamples(results)
      setShowSimilar(true)
    } catch (err) {
      console.error('Find similar failed:', err)
    } finally {
      setFindingSimilar(false)
    }
  }, [sample, findingSimilar])

  const handleAnalyze = useCallback(async () => {
    if (!sample || analyzing) return
    setAnalyzing(true)
    try {
      await window.api.sample.analyze(sample.id)
      await fetchSamples()
    } catch (err) {
      console.error('Analysis failed:', err)
    } finally {
      setAnalyzing(false)
    }
  }, [sample, analyzing, fetchSamples])

  const isFav = !!sample?.is_favorite
  const keyColor = sample?.musical_key ? getCamelotColor(sample.musical_key) : null
  const keyLabel = sample?.musical_key ? getCamelotLabel(sample.musical_key) : null

  if (!sample) {
    return (
      <div className="w-80 border-l border-border bg-surface flex flex-col items-center justify-center text-center px-6 z-10">
        <div className="w-16 h-16 bg-base border border-border flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
        </div>
        <p className="text-text text-[12px] font-bold tracking-[0.1em] uppercase mb-1.5">No Sample Selected</p>
        <p className="text-text-muted text-[11px] tracking-wider">Click a sample to view its details</p>
      </div>
    )
  }

  const isAnalyzed = sample.has_waveform === 1 || sample.bpm !== null

  return (
    <div className="w-80 border-l border-border bg-surface flex flex-col overflow-hidden z-10">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0 bg-base flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-text text-[13px] font-bold truncate tracking-[0.04em] uppercase">{sample.file_name}</h2>
          <p className="text-text-dark text-[10px] truncate mt-1 font-mono">{sample.file_path}</p>
        </div>
        {/* Favorite toggle */}
        <button
          onClick={() => toggleFavorite(sample.id)}
          className={`flex-shrink-0 mt-0.5 transition-all duration-150 ${
            isFav ? 'text-red-400' : 'text-text-muted hover:text-red-400'
          }`}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg className="w-5 h-5" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
      </div>

      {/* Waveform */}
      <div className="px-6 py-5 border-b border-border">
        {waveformLoading ? (
          <div className="flex items-center justify-center h-[100px] bg-base border border-border">
            <div className="w-5 h-5 border-2 border-border border-t-accent animate-spin" />
          </div>
        ) : (
          <WaveSurferWaveform
            filePath={sample.file_path}
            peaks={peaks}
            durationSec={sample.duration_ms ? sample.duration_ms / 1000 : undefined}
            height={100}
          />
        )}
      </div>

      {/* Analyze button */}
      <div className="px-6 py-4 border-b border-border">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${
            isAnalyzed
              ? 'bg-elevated text-text-muted hover:text-text border border-border'
              : 'bg-accent hover:bg-red-600 text-white'
          } disabled:opacity-50`}
        >
          {analyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-500 border-t-black rounded-full animate-spin" />
              Analyzing...
            </>
          ) : isAnalyzed ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-analyze
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze Sample
            </>
          )}
        </button>
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em]">Metadata</h3>

        <div className="grid grid-cols-2 gap-3">
          <MetadataItem
            label="BPM"
            value={sample.bpm != null ? sample.bpm.toFixed(1) : '--'}
            subtitle={sample.bpm_confidence != null ? `${Math.round(sample.bpm_confidence * 100)}%` : undefined}
          />
          <MetadataItem
            label="Key"
            value={sample.musical_key ?? '--'}
            accent={keyColor ?? undefined}
            subtitle={keyLabel ? `${keyLabel}${sample.key_confidence != null ? ` ${Math.round(sample.key_confidence * 100)}%` : ''}` : (sample.key_confidence != null ? `${Math.round(sample.key_confidence * 100)}%` : undefined)}
          />
          <MetadataItem label="Duration" value={formatDuration(sample.duration_ms)} />
          <MetadataItem label="Sample Rate" value={formatSampleRate(sample.sample_rate)} />
          <MetadataItem label="Channels" value={sample.channels?.toString() ?? '--'} />
          <MetadataItem label="Bit Depth" value={sample.bit_depth ? `${sample.bit_depth}-bit` : '--'} />
          <MetadataItem label="File Size" value={formatFileSize(sample.file_size)} />
          <MetadataItem label="Category" value={sample.category ?? '--'} />
        </div>

        {/* Find Similar button */}
        {isAnalyzed && (
          <button
            onClick={handleFindSimilar}
            disabled={findingSimilar}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-elevated border border-border text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            {findingSimilar ? (
              <>
                <div className="w-3 h-3 border-2 border-border border-t-accent rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Find Similar
              </>
            )}
          </button>
        )}

        {/* Similar samples results */}
        {showSimilar && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em]">
                Similar Samples ({similarSamples.length})
              </h3>
              <button
                onClick={() => setShowSimilar(false)}
                className="text-text-dark hover:text-text text-[9px]"
              >
                Hide
              </button>
            </div>
            {similarSamples.length === 0 ? (
              <p className="text-text-dark text-[10px]">No similar samples found</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {similarSamples.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-base border border-border hover:border-border-hover transition-colors cursor-pointer"
                    onClick={async () => {
                      try {
                        const fullSample = await window.api.sample.get(s.id)
                        if (fullSample) {
                          useSampleStore.getState().selectSample(fullSample)
                          setShowSimilar(false)
                          setSimilarSamples([])
                        }
                      } catch { /* ignore */ }
                    }}
                  >
                    <span className="flex-1 text-[10px] text-text truncate">{s.file_name}</span>
                    <span className="text-[9px] text-accent font-bold shrink-0">
                      {Math.round(s.similarity * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Format badge */}
        <div className="pt-2">
          <span className="inline-block text-[10px] font-bold uppercase px-3 py-1 bg-elevated border border-border text-text-muted">
            {sample.file_extension}
          </span>
        </div>

        {/* Tags */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-text-dark text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Tags</h3>
          <TagPicker entityType="sample" entityId={sample.id} />
        </div>
      </div>
    </div>
  )
}

function MetadataItem({ label, value, accent, subtitle }: { label: string; value: string; accent?: string; subtitle?: string }) {
  return (
    <div className="bg-base border border-border p-2.5">
      <p className="text-text-dark text-[9px] uppercase font-bold tracking-[0.15em] mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[13px] font-bold truncate tracking-tight" style={{ color: accent ?? 'white' }}>
          {value}
        </p>
        {subtitle && (
          <span className="text-[10px] font-bold" style={{ color: accent ? `${accent}99` : '#666' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
