import { useEffect, useState } from 'react'
import { useVstStore } from '@/stores/vst.store'
import EmptyState from '@/components/shared/EmptyState'
import VstFilterBar from './VstFilterBar'
import VstGrid from './VstGrid'
import VstScanDialog from './VstScanDialog'

export default function VstManagerPage() {
  const plugins = useVstStore((s) => s.plugins)
  const scanPaths = useVstStore((s) => s.scanPaths)
  const loading = useVstStore((s) => s.loading)
  const scanning = useVstStore((s) => s.scanning)
  const enriching = useVstStore((s) => s.enriching)
  const enrichProgress = useVstStore((s) => s.enrichProgress)
  const fetchPlugins = useVstStore((s) => s.fetchPlugins)
  const fetchScanPaths = useVstStore((s) => s.fetchScanPaths)
  const scan = useVstStore((s) => s.scan)
  const enrichAll = useVstStore((s) => s.enrichAll)

  const [scanDialogOpen, setScanDialogOpen] = useState(false)

  useEffect(() => {
    fetchPlugins()
    fetchScanPaths()
  }, [])

  useEffect(() => {
    const unsub = window.api.on.enrichProgress((data) => {
      useVstStore.setState({ enrichProgress: data })
    })
    return unsub
  }, [])

  const handleScanAll = async () => {
    for (const path of scanPaths) {
      await scan(path.id)
    }
  }

  const hasPlugins = plugins.length > 0 || loading
  const hasScanPaths = scanPaths.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-[0.05em] uppercase">VST Plugins</h1>
          <p className="text-text-muted text-[11px] mt-1.5 tracking-wider uppercase">Manage and scan your VST plugin library</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScanDialogOpen(true)}
            className="flex items-center gap-2 px-5 py-2 bg-transparent border border-border hover:border-border-hover text-text text-[11px] font-bold uppercase tracking-widest transition-all duration-200"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            Add VST Path
          </button>
          <button
            onClick={enrichAll}
            disabled={enriching || plugins.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-elevated border border-border hover:border-border-hover text-text text-[11px] font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enriching ? (
              <>
                <svg className="w-4 h-4 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enriching {enrichProgress ? `${enrichProgress.current}/${enrichProgress.total}` : '...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Enrich All
              </>
            )}
          </button>
          <button
            onClick={handleScanAll}
            disabled={scanning || !hasScanPaths}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-red-600 text-white text-[11px] font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Scan All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-5">
        {hasPlugins ? (
          <>
            <VstFilterBar />
            <VstGrid />
          </>
        ) : (
          <EmptyState
            title="No VST Plugins Found"
            description="Add a scan path to your VST plugin folders and scan to discover your plugins."
            action={{
              label: 'Add VST Path',
              onClick: () => setScanDialogOpen(true)
            }}
          />
        )}
      </div>

      {/* Scan Dialog Modal */}
      <VstScanDialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} />
    </div>
  )
}
