import { useState } from 'react'
import { useDawStore, type Daw, type DawProject } from '@/stores/daw.store'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

interface DawCardProps {
  daw: Daw
  projects: DawProject[]
}

const DAW_COLORS: Record<string, string> = {
  'Ableton Live': '#00D8A0',
  'Maschine': '#FF3300',
  'FL Studio': '#FF8800',
  'Logic Pro': '#A855F7',
  'Bitwig Studio': '#EF6C00',
  'Studio One': '#3B82F6',
  'Reaper': '#22C55E',
  'Cubase': '#E11D48',
  'Pro Tools': '#6366F1'
}

function getDawColor(name: string): string {
  return DAW_COLORS[name] || '#8b5cf6'
}

function truncatePath(filePath: string, maxLen = 45): string {
  if (filePath.length <= maxLen) return filePath
  const start = filePath.slice(0, 15)
  const end = filePath.slice(-1 * (maxLen - 18))
  return `${start}...${end}`
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '--'
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default function DawCard({ daw, projects }: DawCardProps) {
  const { launchDaw, scanProjects, deleteDaw, refreshIcon } = useDawStore()

  const [expanded, setExpanded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [refreshingIcon, setRefreshingIcon] = useState(false)

  const color = getDawColor(daw.name)

  const handleLaunch = async () => {
    setLaunching(true)
    try {
      await launchDaw(daw.id)
    } finally {
      setTimeout(() => setLaunching(false), 1500)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      await scanProjects(daw.id)
    } finally {
      setScanning(false)
    }
  }

  const handleDelete = async () => {
    await deleteDaw(daw.id)
    setConfirmDelete(false)
  }

  const handleRefreshIcon = async () => {
    setRefreshingIcon(true)
    try {
      await refreshIcon(daw.id)
    } finally {
      setRefreshingIcon(false)
    }
  }

  return (
    <>
      <div className="bg-surface border border-border overflow-hidden hover:border-border-hover transition-all duration-200 group">
        {/* Color accent bar */}
        <div className="h-[2px]" style={{ backgroundColor: color }} />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="relative w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden"
                style={{ backgroundColor: `${color}12` }}
              >
                {daw.icon_data ? (
                  <img src={daw.icon_data} alt="" className="w-7 h-7 object-contain" />
                ) : (
                  <svg
                    className="w-5 h-5"
                    style={{ color }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                    />
                  </svg>
                )}
                {/* Refresh icon button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRefreshIcon() }}
                  disabled={refreshingIcon}
                  className="absolute inset-0 flex items-center justify-center bg-base/70 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Refresh icon"
                >
                  <svg
                    className={`w-4 h-4 text-white ${refreshingIcon ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                  </svg>
                </button>
              </div>
              <div>
                <h3 className="text-text font-bold text-[13px] tracking-[0.08em] uppercase">{daw.name}</h3>
                <p className="text-text-dark text-[10px] mt-0.5 tracking-wider font-mono truncate max-w-[160px]" title={daw.executable_path}>
                  {truncatePath(daw.executable_path)}
                </p>
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-text-darker hover:text-accent transition-colors opacity-0 group-hover:opacity-100 p-1"
              title="Remove DAW"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] text-text-muted tracking-wider uppercase font-bold">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </span>
            <span className="text-text-darker">·</span>
            <span className="text-[10px] text-text-darker tracking-wider uppercase font-bold">
              {daw.project_extension}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-[#e0e0e0] disabled:opacity-40 text-[10px] font-bold uppercase tracking-widest transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              {launching ? 'Launching' : 'Launch'}
            </button>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-transparent text-text hover:bg-elevated border border-border-hover hover:border-[#3A3A3A] text-[10px] font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40"
            >
              <svg
                className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
              {scanning ? 'Scanning' : 'Scan'}
            </button>
          </div>

          {/* Expand toggle for projects */}
          {projects.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 mt-4 text-[9px] text-text-dark hover:text-text-secondary transition-colors w-full font-bold uppercase tracking-[0.2em]"
            >
              <svg
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              {expanded ? 'Hide' : 'Show'} projects
            </button>
          )}
        </div>

        {/* Expanded project list */}
        {expanded && projects.length > 0 && (
          <div className="border-t border-border bg-base">
            <div className="max-h-64 overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors border-b border-border last:border-b-0"
                >
                  <svg className="w-3.5 h-3.5 text-text-darker shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text font-bold truncate tracking-wide">{project.file_name}</p>
                    <p className="text-[10px] text-text-dark truncate font-mono" title={project.file_path}>
                      {project.file_path}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-text-secondary font-bold tabular-nums">{formatFileSize(project.file_size)}</p>
                    <p className="text-[10px] text-text-dark">{formatDate(project.last_modified)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove DAW"
        message={`Are you sure you want to remove "${daw.name}"? This will also remove all scanned project records for this DAW.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
