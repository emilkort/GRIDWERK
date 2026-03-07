import { useCallback, useMemo, useState } from 'react'
import { useSampleStore } from '@/stores/sample.store'
import type { SampleFolder, SubfolderEntry } from '@/stores/sample.store'

export default function SampleBrowser() {
  const folders = useSampleStore((s) => s.folders)
  const samples = useSampleStore((s) => s.samples)
  const filters = useSampleStore((s) => s.filters)
  const scanning = useSampleStore((s) => s.scanning)
  const analyzing = useSampleStore((s) => s.analyzing)
  const analysisProgress = useSampleStore((s) => s.analysisProgress)
  const completionMsg = useSampleStore((s) => s.completionMsg)
  const setFilters = useSampleStore((s) => s.setFilters)
  const addFolder = useSampleStore((s) => s.addFolder)
  const deleteFolder = useSampleStore((s) => s.deleteFolder)
  const scanFolder = useSampleStore((s) => s.scanFolder)
  const analyzeFolderAction = useSampleStore((s) => s.analyzeFolder)
  const subfolderTree = useSampleStore((s) => s.subfolderTree)
  const totalSampleCount = useSampleStore((s) => s.totalSampleCount)

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Build hierarchical tree from flat subfolder entries
  const subfolderNodes = useMemo(() => {
    if (!subfolderTree.length) return []
    return buildTree(subfolderTree)
  }, [subfolderTree])

  // Get the active folder's base path for constructing full subfolder paths
  const activeFolder = useMemo(
    () => folders.find((f) => f.id === filters.folderId),
    [folders, filters.folderId]
  )

  const handleSubfolderClick = useCallback(
    (subPath: string | null) => {
      if (!activeFolder) return
      if (subPath === null) {
        setFilters({ subfolderPath: null })
      } else {
        // Use forward slashes — sample.service normalizes for DB matching
        const base = activeFolder.folder_path.replace(/\\/g, '/').replace(/\/$/, '')
        const fullPath = `${base}/${subPath}`
        setFilters({ subfolderPath: fullPath })
      }
    },
    [activeFolder, setFilters]
  )

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleAddFolder = useCallback(async () => {
    try {
      const result = await window.api.dialog.pickFolder()
      if (result) {
        await addFolder(result)
      }
    } catch (err) {
      console.error('Failed to add folder:', err)
    }
  }, [addFolder])

  const handleFolderClick = useCallback(
    (folderId: number | null) => {
      setExpandedPaths(new Set())
      setFilters({ folderId })
    },
    [setFilters]
  )

  const handleScanFolder = useCallback(
    async (e: React.MouseEvent, folderId: number) => {
      e.stopPropagation()
      await scanFolder(folderId)
    },
    [scanFolder]
  )

  const handleDeleteFolder = useCallback(
    async (e: React.MouseEvent, folderId: number) => {
      e.stopPropagation()
      await deleteFolder(folderId)
    },
    [deleteFolder]
  )

  const handleAnalyzeFolder = useCallback(
    async (e: React.MouseEvent, folderId: number) => {
      e.stopPropagation()
      await analyzeFolderAction(folderId)
    },
    [analyzeFolderAction]
  )

  return (
    <div className="w-64 border-r border-border bg-surface flex flex-col overflow-hidden z-10">
      {/* Header */}
      <div className="px-5 py-5 shrink-0">
        <h2 className="text-text-muted text-[10px] font-bold uppercase tracking-[0.15em]">Folders</h2>
      </div>

      {/* Analysis progress bar */}
      {analyzing && analysisProgress && (
        <div className="px-5 py-3 border-b border-border bg-accent/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase text-accent font-bold tracking-wider">Analyzing</span>
            <span className="text-[10px] text-text-muted font-medium">
              {analysisProgress.current}/{analysisProgress.total}
            </span>
          </div>
          <div className="w-full bg-border h-px overflow-hidden">
            <div
              className="bg-accent h-px transition-all duration-300"
              style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-text-dark text-[10px] truncate mt-1.5 font-mono">{analysisProgress.currentFile}</p>
        </div>
      )}

      {/* Analysis completion message */}
      {completionMsg && (
        <div className="px-5 py-2 border-b border-border bg-emerald-500/10">
          <p className="text-emerald-400 text-[10px] font-bold">{completionMsg}</p>
        </div>
      )}

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* All Samples option */}
        <button
          onClick={() => handleFolderClick(null)}
          className={`w-full flex items-center gap-3 px-5 py-2 text-left transition-all duration-200 ${
            filters.folderId === null && !filters.isFavorites
              ? 'bg-elevated text-text font-medium'
              : 'text-text-muted hover:text-text font-medium'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="text-[11px] truncate flex-1 uppercase tracking-wider">All Samples</span>
          <span className="text-[10px] text-text-dark">
            {filters.folderId === null && !filters.isFavorites ? samples.length : totalSampleCount}
          </span>
        </button>

        {/* Favorites option */}
        <button
          onClick={() => setFilters({ isFavorites: !filters.isFavorites })}
          className={`w-full flex items-center gap-3 px-5 py-2 text-left transition-all duration-200 ${
            filters.isFavorites
              ? 'bg-elevated text-accent font-medium'
              : 'text-text-muted hover:text-text font-medium'
          }`}
        >
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill={filters.isFavorites ? 'currentColor' : 'none'}
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <span className="text-[11px] truncate flex-1 uppercase tracking-wider">Favorites</span>
          {filters.isFavorites && (
            <span className="text-[10px] text-accent">{samples.length}</span>
          )}
        </button>

        {/* Individual folders */}
        {folders.map((folder) => (
          <div key={folder.id}>
            <FolderItem
              folder={folder}
              isActive={filters.folderId === folder.id}
              scanning={scanning}
              analyzing={analyzing}
              onClick={() => handleFolderClick(folder.id)}
              onScan={(e) => handleScanFolder(e, folder.id)}
              onAnalyze={(e) => handleAnalyzeFolder(e, folder.id)}
              onDelete={(e) => handleDeleteFolder(e, folder.id)}
            />
            {/* Subfolder tree (only for active folder) */}
            {filters.folderId === folder.id && subfolderNodes.length > 0 && (
              <div className="ml-3">
                {/* Show All (root) */}
                <button
                  onClick={() => handleSubfolderClick(null)}
                  className={`w-full flex items-center gap-2 pl-6 pr-3 py-1 text-left text-[11px] transition-colors ${
                    filters.subfolderPath === null
                      ? 'text-text font-medium'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <span className="truncate flex-1 uppercase tracking-wider">All</span>
                </button>
                <SubfolderTree
                  nodes={subfolderNodes}
                  depth={0}
                  expandedPaths={expandedPaths}
                  activeSubPath={
                    filters.subfolderPath && activeFolder
                      ? filters.subfolderPath
                          .replace(/\\/g, '/')
                          .slice(activeFolder.folder_path.replace(/\\/g, '/').length + 1)
                      : null
                  }
                  onToggle={toggleExpand}
                  onClick={handleSubfolderClick}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Services section */}
      <div className="border-t border-border px-5 py-3 shrink-0">
        <h2 className="text-text-muted text-[9px] font-bold uppercase tracking-[0.15em] mb-2">Sources</h2>
        {(['all', 'local', 'splice', 'tracklib'] as const).map((src) => {
          const isActive = filters.sourceFilter === src
          const labelMap = { all: 'All Sources', local: 'Local', splice: 'Splice', tracklib: 'Tracklib' }
          const colorMap = { all: 'text-text-muted', local: 'text-text-muted', splice: 'text-orange-400', tracklib: 'text-cyan-400' }
          return (
            <button
              key={src}
              onClick={() => setFilters({ sourceFilter: src })}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-all ${
                isActive ? 'text-text font-medium bg-elevated' : 'text-text-muted hover:text-text'
              }`}
            >
              {src !== 'all' && src !== 'local' && (
                <span className={`w-1.5 h-1.5 rounded-full ${src === 'splice' ? 'bg-orange-400' : 'bg-cyan-400'}`} />
              )}
              <span className={`flex-1 uppercase tracking-wider ${isActive && src !== 'all' && src !== 'local' ? colorMap[src] : ''}`}>
                {labelMap[src]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Add folder button */}
      <div className="px-5 py-4 bg-surface">
        <button
          onClick={handleAddFolder}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-border hover:border-border-hover text-text text-[10px] font-bold uppercase tracking-widest transition-all duration-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Folder
        </button>
      </div>
    </div>
  )
}

function FolderItem({
  folder,
  isActive,
  scanning,
  analyzing,
  onClick,
  onScan,
  onAnalyze,
  onDelete
}: {
  folder: SampleFolder
  isActive: boolean
  scanning: boolean
  analyzing: boolean
  onClick: () => void
  onScan: (e: React.MouseEvent) => void
  onAnalyze: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const folderName = folder.label || folder.folder_path.split(/[/\\]/).pop() || folder.folder_path

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 px-5 py-2 cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-elevated text-text font-medium'
          : 'text-text-muted hover:text-text font-medium'
      }`}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>

      <span className="text-[11px] truncate flex-1" title={folder.folder_path}>
        {folderName}
      </span>

      {/* Action buttons (visible on hover) */}
      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
        {/* Scan button */}
        <button
          onClick={onScan}
          disabled={scanning}
          className="p-1 hover:bg-elevated text-text-dark hover:text-text transition-colors disabled:opacity-50"
          title="Scan folder"
        >
          {scanning ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
            </svg>
          )}
        </button>

        {/* Analyze button */}
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="p-1 hover:bg-elevated text-text-dark hover:text-accent transition-colors disabled:opacity-50"
          title="Analyze all samples (BPM, key, waveform)"
        >
          {analyzing ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
        </button>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="p-1 hover:bg-elevated text-text-dark hover:text-accent transition-colors"
          title="Remove folder"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Tree helpers ──

interface SubfolderNode {
  name: string
  fullPath: string
  count: number
  children: SubfolderNode[]
}

function buildTree(entries: SubfolderEntry[]): SubfolderNode[] {
  const nodeMap = new Map<string, SubfolderNode>()

  for (const { subPath, count } of entries) {
    const parts = subPath.split('/')
    nodeMap.set(subPath, {
      name: parts[parts.length - 1],
      fullPath: subPath,
      count,
      children: []
    })
  }

  const roots: SubfolderNode[] = []
  for (const [fullPath, node] of nodeMap) {
    const lastSlash = fullPath.lastIndexOf('/')
    if (lastSlash === -1) {
      roots.push(node)
    } else {
      const parentPath = fullPath.slice(0, lastSlash)
      const parent = nodeMap.get(parentPath)
      if (parent) parent.children.push(node)
    }
  }

  return roots
}

function SubfolderTree({
  nodes,
  depth,
  expandedPaths,
  activeSubPath,
  onToggle,
  onClick
}: {
  nodes: SubfolderNode[]
  depth: number
  expandedPaths: Set<string>
  activeSubPath: string | null
  onToggle: (path: string) => void
  onClick: (subPath: string) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedPaths.has(node.fullPath)
        const isActive = activeSubPath === node.fullPath

        return (
          <div key={node.fullPath}>
            <button
              className={`w-full flex items-center gap-1.5 pr-3 py-1 text-left text-[11px] transition-colors ${
                isActive
                  ? 'text-text font-medium'
                  : 'text-text-muted hover:text-text'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
              onClick={() => {
                onClick(node.fullPath)
                if (hasChildren && !isExpanded) onToggle(node.fullPath)
              }}
            >
              {hasChildren ? (
                <span
                  className="flex-shrink-0 w-3 h-3 flex items-center justify-center text-text-dark hover:text-text"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(node.fullPath)
                  }}
                >
                  <svg
                    className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              ) : (
                <span className="flex-shrink-0 w-3" />
              )}
              <span className="truncate flex-1">{node.name}</span>
              <span className="flex-shrink-0 text-[10px] text-text-dark">{node.count}</span>
            </button>
            {hasChildren && isExpanded && (
              <SubfolderTree
                nodes={node.children}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                activeSubPath={activeSubPath}
                onToggle={onToggle}
                onClick={onClick}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
