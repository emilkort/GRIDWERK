import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useVstStore } from '@/stores/vst.store'

interface VstScanDialogProps {
  open: boolean
  onClose: () => void
}

export default function VstScanDialog({ open, onClose }: VstScanDialogProps) {
  const scanPaths = useVstStore((s) => s.scanPaths)
  const scanning = useVstStore((s) => s.scanning)
  const addScanPath = useVstStore((s) => s.addScanPath)
  const deleteScanPath = useVstStore((s) => s.deleteScanPath)
  const scan = useVstStore((s) => s.scan)

  const [newFormat, setNewFormat] = useState<'VST2' | 'VST3'>('VST3')
  const [scanningPathId, setScanningPathId] = useState<number | null>(null)

  const handleAddPath = async () => {
    const result = await window.api.dialog.pickFolder()
    if (result) {
      await addScanPath(result, newFormat)
    }
  }

  const handleScan = async (scanPathId: number) => {
    setScanningPathId(scanPathId)
    try {
      await scan(scanPathId)
    } finally {
      setScanningPathId(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-base/60 z-50" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base border border-border w-[560px] max-h-[80vh] flex flex-col shadow-2xl shadow-black/90 focus:outline-none"
        >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <h2 className="text-text font-bold text-[12px] tracking-[0.2em] uppercase">VST Scan Paths</h2>
          <Dialog.Close asChild>
            <button className="p-1.5 text-text-muted hover:text-text transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </div>

        {/* Existing paths list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {scanPaths.length === 0 ? (
            <p className="text-text-muted text-[11px] text-center py-8 font-bold uppercase tracking-wider">
              No scan paths configured.
            </p>
          ) : (
            scanPaths.map((path) => (
              <div
                key={path.id}
                className="flex items-center gap-3 bg-surface border border-border px-4 py-3.5 group hover:border-border-hover transition-all"
              >
                {/* Folder icon */}
                <svg className="w-5 h-5 text-text-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>

                {/* Path info */}
                <div className="flex-1 min-w-0">
                  <p className="text-text text-[11px] font-bold truncate font-mono">{path.folder_path}</p>
                </div>

                {/* Format badge */}
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-border-hover text-text-secondary shrink-0">
                  {path.format}
                </span>

                {/* Scan button */}
                <button
                  onClick={() => handleScan(path.id)}
                  disabled={scanning}
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white bg-accent hover:bg-red-600 transition-colors disabled:opacity-50 shrink-0"
                >
                  {scanningPathId === path.id ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Scanning
                    </span>
                  ) : (
                    'Scan'
                  )}
                </button>

                {/* Delete button */}
                <button
                  onClick={() => deleteScanPath(path.id)}
                  disabled={scanning}
                  className="p-1.5 text-text-dark hover:text-accent transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add new path section */}
        <div className="px-6 py-5 border-t border-border bg-surface">
          <div className="flex items-center gap-4">
            {/* Format selector */}
            <div className="flex items-center gap-1 bg-base border border-border p-1 shrink-0">
              <button
                onClick={() => setNewFormat('VST2')}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  newFormat === 'VST2'
                    ? 'bg-border text-text'
                    : 'text-text-dark hover:text-text'
                }`}
              >
                VST2
              </button>
              <button
                onClick={() => setNewFormat('VST3')}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  newFormat === 'VST3'
                    ? 'bg-border text-text'
                    : 'text-text-dark hover:text-text'
                }`}
              >
                VST3
              </button>
            </div>

            {/* Add path button */}
            <button
              onClick={handleAddPath}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-border hover:border-border-hover text-text text-[10px] uppercase font-bold tracking-widest transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add New Path
            </button>
          </div>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
