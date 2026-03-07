import { useEffect, useState, useCallback } from 'react'
import { useServiceStore, type ServiceConnection } from '@/stores/service.store'

function formatDate(ts: number | null): string {
  if (!ts) return 'Never'
  return new Date(ts * 1000).toLocaleString()
}

function ServiceCard({
  service,
  connection,
  onDetect,
  onSync,
  onUpdate,
  syncing
}: {
  service: 'splice' | 'tracklib'
  connection: ServiceConnection | undefined
  onDetect: () => Promise<{ found: boolean; folderPath: string | null; dbPath?: string | null }>
  onSync: () => Promise<{ synced: number }>
  onUpdate: (service: string, changes: Record<string, any>) => Promise<void>
  syncing: string | null
}) {
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const isSplice = service === 'splice'
  const enabled = connection?.enabled === 1
  const isSyncing = syncing === service

  const handleDetect = useCallback(async () => {
    setDetecting(true)
    setDetectResult(null)
    try {
      const result = await onDetect()
      if (result.found) {
        const changes: Record<string, any> = { local_folder: result.folderPath, enabled: 1 }
        if ('dbPath' in result && result.dbPath) changes.metadata_db_path = result.dbPath
        await onUpdate(service, changes)
        setDetectResult(`Found at ${result.folderPath}`)
      } else {
        setDetectResult('Not found. Set folder manually below.')
      }
    } catch {
      setDetectResult('Detection failed')
    }
    setDetecting(false)
    setTimeout(() => setDetectResult(null), 4000)
  }, [onDetect, onUpdate, service])

  const handleSync = useCallback(async () => {
    setSyncResult(null)
    try {
      const result = await onSync()
      setSyncResult(`Synced ${result.synced} samples`)
    } catch {
      setSyncResult('Sync failed')
    }
    setTimeout(() => setSyncResult(null), 4000)
  }, [onSync])

  const handlePickFolder = useCallback(async () => {
    const folder = await window.api.dialog.pickFolder()
    if (folder) {
      await onUpdate(service, { local_folder: folder, enabled: 1 })
    }
  }, [onUpdate, service])

  const handleToggle = useCallback(async () => {
    await onUpdate(service, { enabled: enabled ? 0 : 1 })
  }, [onUpdate, service, enabled])

  const color = isSplice ? 'orange' : 'cyan'
  const colorClasses = isSplice
    ? { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' }
    : { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' }

  return (
    <div className={`${colorClasses.bg} border ${colorClasses.border} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${colorClasses.dot}`} />
          <h3 className={`text-[14px] font-bold uppercase tracking-wider ${colorClasses.text}`}>
            {service}
          </h3>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            enabled ? `bg-${color}-500` : 'bg-surface'
          }`}
          style={enabled ? { backgroundColor: isSplice ? '#f97316' : '#06b6d4' } : undefined}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Folder path */}
      <div className="mb-3">
        <label className="text-[9px] font-bold uppercase tracking-widest text-text-darker mb-1 block">
          Local Folder
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-base border border-border px-3 py-1.5 text-[11px] text-text-secondary truncate">
            {connection?.local_folder || 'Not configured'}
          </div>
          <button
            onClick={handlePickFolder}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-text-dark hover:text-text transition-colors"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={handleDetect}
          disabled={detecting}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-surface border border-border text-text-dark hover:text-text transition-colors disabled:opacity-50"
        >
          {detecting ? 'Detecting...' : 'Auto-Detect'}
        </button>
        <button
          onClick={handleSync}
          disabled={isSyncing || !enabled}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-50 ${colorClasses.text} ${colorClasses.border} hover:bg-white/5`}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Status messages */}
      {detectResult && (
        <p className="text-[10px] text-text-secondary mb-1">{detectResult}</p>
      )}
      {syncResult && (
        <p className={`text-[10px] ${colorClasses.text} mb-1`}>{syncResult}</p>
      )}

      {/* Last synced */}
      <p className="text-[9px] text-text-darker uppercase tracking-wider">
        Last synced: {formatDate(connection?.last_synced ?? null)}
      </p>
    </div>
  )
}

export default function SettingsPage() {
  const { connections, syncing, fetchConnections, updateConnection, detectSplice, detectTracklib, syncSplice, syncTracklib } = useServiceStore()

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const spliceConn = connections.find((c) => c.service === 'splice')
  const tracklibConn = connections.find((c) => c.service === 'tracklib')

  return (
    <div className="flex-1 overflow-y-auto bg-base">
      <div className="max-w-2xl mx-auto py-10 px-6">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-text text-[18px] font-bold tracking-tight">Settings</h1>
          <p className="text-text-dark text-[11px] mt-1">Configure service integrations and preferences</p>
        </div>

        {/* Service Integrations section */}
        <div className="mb-8">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-darker mb-4">
            Service Integrations
          </h2>
          <div className="space-y-4">
            <ServiceCard
              service="splice"
              connection={spliceConn}
              onDetect={detectSplice}
              onSync={syncSplice}
              onUpdate={updateConnection}
              syncing={syncing}
            />
            <ServiceCard
              service="tracklib"
              connection={tracklibConn}
              onDetect={detectTracklib}
              onSync={syncTracklib}
              onUpdate={updateConnection}
              syncing={syncing}
            />
          </div>
        </div>

        {/* Info */}
        <div className="bg-surface border border-border p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-dark mb-2">How it works</h3>
          <ul className="text-[10px] text-text-secondary space-y-1.5 list-disc list-inside">
            <li><strong className="text-orange-400">Splice</strong> — Auto-detects your Splice folder and syncs downloaded samples. Search the Splice catalog to browse cloud samples.</li>
            <li><strong className="text-cyan-400">Tracklib</strong> — Watches your Tracklib download folder for new samples and imports them with metadata parsed from filenames.</li>
            <li>Cloud samples show a download icon. Downloaded samples can be dragged to your DAW.</li>
            <li>Use the source filter in the Sample Library sidebar to filter by service.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
