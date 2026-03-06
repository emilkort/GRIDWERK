import { useEffect, useState } from 'react'
import { useVstStore } from '@/stores/vst.store'
import type { MergedVstPlugin } from '@/utils/vst-grouping'
import EmptyState from '@/components/shared/EmptyState'
import VstFilterBar from './VstFilterBar'
import VstGrid from './VstGrid'
import VstScanDialog from './VstScanDialog'
import VstDetailPanel from './VstDetailPanel'
import VstHiddenDrawer from './VstHiddenDrawer'

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
  const syncReferenceLibrary = useVstStore((s) => s.syncReferenceLibrary)
  const syncingLibrary = useVstStore((s) => s.syncingLibrary)

  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<MergedVstPlugin | null>(null)
  const [hiddenDrawerOpen, setHiddenDrawerOpen] = useState(false)

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
            onClick={() => setHiddenDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-transparent border border-border hover:border-border-hover text-text-dark hover:text-text text-[11px] font-bold uppercase tracking-widest transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            Hidden
          </button>
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
            onClick={syncReferenceLibrary}
            disabled={syncingLibrary || enriching}
            className="flex items-center gap-2 px-5 py-2 bg-transparent border border-border hover:border-border-hover text-text text-[11px] font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncingLibrary ? (
              <>
                <svg className="w-4 h-4 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                Sync Library
              </>
            )}
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

      {/* Content + Detail Panel — fixed height container so both grid and panel fill viewport */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {hasPlugins ? (
            <>
              <div className="shrink-0">
                <VstFilterBar />
              </div>
              <div className="flex-1 min-h-0 mt-5">
                <VstGrid onPluginClick={setSelectedPlugin} />
              </div>
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

        {/* Detail panel — fills the same constrained height */}
        {selectedPlugin && (
          <VstDetailPanel
            plugin={selectedPlugin}
            onClose={() => setSelectedPlugin(null)}
          />
        )}
      </div>

      {/* Scan Dialog Modal */}
      <VstScanDialog open={scanDialogOpen} onClose={() => setScanDialogOpen(false)} />

      {/* Hidden Plugins Drawer */}
      <VstHiddenDrawer open={hiddenDrawerOpen} onClose={() => setHiddenDrawerOpen(false)} />
    </div>
  )
}
