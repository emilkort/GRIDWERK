import { useEffect, useState, useMemo, useCallback } from 'react'
import { useProjectStore, type Project } from '@/stores/project.store'
import { useStageStore, type Stage } from '@/stores/stage.store'
import KanbanBoard from './KanbanBoard'
import NewProjectDialog from './NewProjectDialog'
import ProjectDetailPanel from './ProjectDetailPanel'
import LoadingSpinner from '@/components/shared/LoadingSpinner'

type ViewMode = 'kanban' | 'list'
type DawFilter = 'all' | 'ableton' | 'maschine' | 'other'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#f87171', high: '#fb923c', normal: '', low: '#60a5fa'
}

const STAGE_COLOR_OPTIONS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#64748b'
]

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function matchesDaw(p: Project, filter: DawFilter): boolean {
  if (filter === 'all') return true
  if (!p.daw_name) return filter === 'other'
  const name = p.daw_name.toLowerCase()
  if (filter === 'ableton') return name.includes('ableton')
  if (filter === 'maschine') return name.includes('maschine')
  return !name.includes('ableton') && !name.includes('maschine')
}

type SortCol = 'title' | 'stage' | 'priority' | 'bpm' | 'key' | 'tasks' | 'updated'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER = ['urgent', 'high', 'normal', 'low']

function sortProjects(projects: Project[], col: SortCol, dir: SortDir, stageOrder: string[]): Project[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...projects].sort((a, b) => {
    let cmp = 0
    switch (col) {
      case 'title':    cmp = a.title.localeCompare(b.title); break
      case 'stage':    cmp = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage); break
      case 'priority': cmp = PRIORITY_ORDER.indexOf(a.priority ?? 'normal') - PRIORITY_ORDER.indexOf(b.priority ?? 'normal'); break
      case 'bpm':      cmp = (a.bpm ?? -1) - (b.bpm ?? -1); break
      case 'key':      cmp = (a.musical_key ?? '').localeCompare(b.musical_key ?? ''); break
      case 'tasks': {
        const ra = a.todo_count > 0 ? a.done_count / a.todo_count : -1
        const rb = b.todo_count > 0 ? b.done_count / b.todo_count : -1
        cmp = ra - rb; break
      }
      case 'updated':  cmp = (a.daw_last_modified ?? a.updated_at) - (b.daw_last_modified ?? b.updated_at); break
    }
    return cmp * mul
  })
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg className={`inline w-2.5 h-2.5 ml-1 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-30'}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      {dir === 'asc' || !active
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />}
    </svg>
  )
}

function ProjectListView({
  projects,
  selectedProjectId,
  onSelect
}: {
  projects: Project[]
  selectedProjectId: number | null
  onSelect: (id: number | null) => void
}) {
  const { stages } = useStageStore()
  const stageLabels = useMemo(() => Object.fromEntries(stages.map(s => [s.slug, s.name])), [stages])
  const stageColors = useMemo(() => Object.fromEntries(stages.map(s => [s.slug, s.color])), [stages])
  const stageOrder  = useMemo(() => stages.map(s => s.slug), [stages])

  const [sortCol, setSortCol] = useState<SortCol>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = useCallback((col: SortCol) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col }
      setSortDir(col === 'updated' || col === 'priority' ? 'desc' : 'asc')
      return col
    })
  }, [])

  const sorted = useMemo(() => sortProjects(projects, sortCol, sortDir, stageOrder), [projects, sortCol, sortDir, stageOrder])

  function Th({ col, align = 'left', children }: { col: SortCol; align?: 'left' | 'center' | 'right'; children: React.ReactNode }) {
    const active = sortCol === col
    return (
      <th
        onClick={() => handleSort(col)}
        className={`group/th px-3 py-2 text-${align} text-[9px] uppercase tracking-[0.15em] font-bold cursor-pointer select-none transition-colors ${
          active ? 'text-text' : 'text-text-dark hover:text-text-secondary'
        }`}
      >
        {children}
        <SortIcon active={active} dir={active ? sortDir : 'asc'} />
      </th>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border sticky top-0 bg-base">
            <Th col="title" align="left">Title</Th>
            <Th col="stage" align="left">Stage</Th>
            <Th col="priority" align="left">Priority</Th>
            <Th col="bpm" align="center">BPM</Th>
            <Th col="key" align="center">Key</Th>
            <Th col="tasks" align="center">Tasks</Th>
            <Th col="updated" align="right">Updated</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const isSelected = p.id === selectedProjectId
            const stageColor = stageColors[p.stage] ?? '#666'
            const progress = p.todo_count > 0 ? p.done_count / p.todo_count : null
            const prioColor = PRIORITY_COLORS[p.priority ?? 'normal']
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(isSelected ? null : p.id)}
                className={`border-b border-border cursor-pointer transition-colors ${
                  isSelected ? 'bg-elevated' : 'hover:bg-surface'
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? stageColor }} />
                    <span className="text-text font-medium truncate max-w-[220px]">{p.title}</span>
                    {p.tags.length > 0 && (
                      <div className="flex gap-1">
                        {p.tags.slice(0, 2).map(tag => (
                          <span key={tag.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 tracking-wider"
                    style={{ backgroundColor: `${stageColor}15`, color: stageColor, border: `1px solid ${stageColor}30` }}>
                    {stageLabels[p.stage] ?? p.stage}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {prioColor && (
                    <span className="flex items-center gap-1 text-[10px] font-bold"
                      style={{ color: prioColor }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: prioColor }} />
                      {p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-[11px] text-text-muted tabular-nums">{p.bpm ?? '—'}</td>
                <td className="px-3 py-2.5 text-center text-[11px] text-text-muted">{p.musical_key ?? '—'}</td>
                <td className="px-3 py-2.5 text-center">
                  {p.todo_count > 0 ? (
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="w-16 h-px bg-border overflow-hidden">
                        <div className="h-full" style={{
                          width: `${Math.round((progress ?? 0) * 100)}%`,
                          backgroundColor: progress === 1 ? '#22c55e' : stageColor
                        }} />
                      </div>
                      <span className="text-[10px] text-text-muted tabular-nums">{p.done_count}/{p.todo_count}</span>

                    </div>
                  ) : <span className="text-[11px] text-[#222]">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-[10px] text-text-muted tabular-nums">
                  {formatDate(p.daw_last_modified ?? p.updated_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Manage Stages Modal ────────────────────────────────────────────────────
function ManageStagesModal({ onClose }: { onClose: () => void }) {
  const { stages, createStage, updateStage, deleteStage, reorderStages } = useStageStore()
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState('')
  const [addName, setAddName]         = useState('')
  const [addColor, setAddColor]       = useState('#8b5cf6')
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const startEdit = (stage: Stage) => {
    setEditingId(stage.id)
    setEditingName(stage.name)
    setEditingColor(stage.color)
    setError(null)
  }

  const commitEdit = async () => {
    if (!editingId || !editingName.trim()) { setEditingId(null); return }
    try {
      await updateStage(editingId, { name: editingName.trim(), color: editingColor })
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update stage')
    }
    setEditingId(null)
  }

  const handleDelete = async (id: number) => {
    setError(null)
    try {
      const result = await deleteStage(id)
      if (!result.ok) setError(result.error ?? 'Cannot delete stage')
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete stage')
    }
  }

  const handleAdd = async () => {
    if (!addName.trim()) return
    setError(null)
    try {
      await createStage({ name: addName.trim(), color: addColor })
      setAddName('')
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create stage — try restarting the app')
    }
  }

  const handleReorder = async (idx: number, dir: 'up' | 'down') => {
    const newIds = stages.map(s => s.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= newIds.length) return
    ;[newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]]
    await reorderStages(newIds)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-base/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-base border border-border w-[460px] max-h-[80vh] flex flex-col shadow-2xl shadow-black/90"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-text font-bold text-[11px] tracking-[0.2em] uppercase">Manage Stages</h2>
          <button onClick={onClose} className="p-1 text-text-dark hover:text-text transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stage list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="group">
              <div className="flex items-center gap-2.5 px-2 py-2 hover:bg-surface transition-colors">
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full shrink-0 cursor-pointer ring-offset-[#1a1a1a] hover:ring-2 hover:ring-white/20"
                  style={{ backgroundColor: editingId === stage.id ? editingColor : stage.color }}
                  onClick={() => editingId !== stage.id && startEdit(stage)}
                  title="Click to edit"
                />

                {/* Name / input */}
                {editingId === stage.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="flex-1 bg-surface border border-border-hover px-2 py-0.5 text-text text-[11px] tracking-wide focus:outline-none focus:border-[#444]"
                  />
                ) : (
                  <span
                    className="flex-1 text-[11px] text-text-secondary cursor-pointer hover:text-text transition-colors tracking-wide uppercase"
                    onClick={() => startEdit(stage)}
                  >
                    {stage.name}
                  </span>
                )}

                {/* Up / Down / Delete */}
                <div className={`flex items-center gap-0.5 transition-opacity ${
                  editingId === stage.id ? 'invisible' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <button
                    onClick={() => handleReorder(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-text-muted hover:text-text disabled:opacity-20 rounded transition-colors"
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleReorder(idx, 'down')}
                    disabled={idx === stages.length - 1}
                    className="p-1 text-text-muted hover:text-text disabled:opacity-20 rounded transition-colors"
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(stage.id)}
                    className="p-1 text-text-muted hover:text-red-400 rounded transition-colors ml-0.5"
                    title="Delete stage"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Color swatches — shown while editing this stage */}
              {editingId === stage.id && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                  {STAGE_COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditingColor(c)}
                      className="w-5 h-5 rounded-full transition-all"
                      style={{
                        backgroundColor: c,
                        outline: editingColor === c ? '2px solid white' : '2px solid transparent',
                        outlineOffset: '2px'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new stage */}
        <div className="border-t border-border px-4 py-4 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-dark">Add Stage</p>
          <div className="flex items-center gap-2">
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Stage name…"
              className="flex-1 bg-base border border-border hover:border-border-hover focus:border-[#3A3A3A] px-3 py-1.5 text-text text-[11px] placeholder-text-darker tracking-wider focus:outline-none transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!addName.trim()}
              className="px-3 py-1.5 bg-accent hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 transition-colors shrink-0"
            >
              Add
            </button>
          </div>
          {/* Color swatches for new stage */}
          <div className="flex flex-wrap gap-1.5">
            {STAGE_COLOR_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => setAddColor(c)}
                className="w-5 h-5 rounded-full transition-all"
                style={{
                  backgroundColor: c,
                  outline: addColor === c ? '2px solid white' : '2px solid transparent',
                  outlineOffset: '2px'
                }}
              />
            ))}
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ProjectTrackerPage() {
  const { projects, loading, fetchProjects, selectedProjectId, selectProject, pendingDawNotification, dismissDawNotification } = useProjectStore()
  const { fetchStages, loaded: stagesLoaded } = useStageStore()

  const [newProjectOpen, setNewProjectOpen]         = useState(false)
  const [newProjectStage, setNewProjectStage]       = useState<string | undefined>(undefined)
  const [viewMode, setViewMode]                     = useState<ViewMode>('kanban')
  const [collapseEmpty, setCollapseEmpty]           = useState(false)
  const [search, setSearch]                         = useState('')
  const [dawFilter, setDawFilter]                   = useState<DawFilter>('all')
  const [manageStagesOpen, setManageStagesOpen]     = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchStages()
  }, [fetchProjects, fetchStages])

  useEffect(() => {
    if (!pendingDawNotification) return
    const t = setTimeout(dismissDawNotification, 5000)
    return () => clearTimeout(t)
  }, [pendingDawNotification, dismissDawNotification])

  const availableDaws = useMemo(() => {
    const has = { ableton: false, maschine: false, other: false }
    for (const p of projects) {
      if (!p.daw_name) { has.other = true; continue }
      const name = p.daw_name.toLowerCase()
      if (name.includes('ableton')) has.ableton = true
      else if (name.includes('maschine')) has.maschine = true
      else has.other = true
    }
    return has
  }, [projects])

  const filteredProjects = useMemo(() => {
    let result = projects
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags.some((t) => t.name.toLowerCase().includes(q))
      )
    }
    if (dawFilter !== 'all') {
      result = result.filter((p) => matchesDaw(p, dawFilter))
    }
    return result
  }, [projects, search, dawFilter])

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  const handleQuickAdd = (stage: string) => {
    setNewProjectStage(stage)
    setNewProjectOpen(true)
  }

  const isFiltered = search.trim() !== '' || dawFilter !== 'all'

  if ((loading && projects.length === 0) || !stagesLoaded) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-[0.05em] uppercase">Project Tracker</h1>
          <p className="text-text-muted text-[10px] mt-1.5 tracking-wider uppercase">
            {isFiltered
              ? `${filteredProjects.length} of ${projects.length} projects`
              : `${projects.length} project${projects.length !== 1 ? 's' : ''} across all stages`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Manage Stages */}
          <button
            onClick={() => setManageStagesOpen(true)}
            title="Manage stages"
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] bg-transparent text-text-muted hover:text-text border border-border hover:border-border-hover transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Stages
          </button>

          {/* Collapse empty (kanban only) */}
          {viewMode === 'kanban' && (
            <button
              onClick={() => setCollapseEmpty((v) => !v)}
              title={collapseEmpty ? 'Show all columns' : 'Collapse empty columns'}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
                collapseEmpty
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'bg-transparent text-text-muted hover:text-text border border-border hover:border-border-hover'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5M3.75 12h16.5M3.75 18.75h16.5" />
              </svg>
              Collapse empty
            </button>
          )}

          {/* View mode toggle */}
          <div className="flex items-center border border-border p-0.5">
            <button onClick={() => setViewMode('kanban')} title="Kanban view"
              className={`p-2 transition-all ${viewMode === 'kanban' ? 'bg-border text-text' : 'text-text-dark hover:text-text'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </button>
            <button onClick={() => setViewMode('list')} title="List view"
              className={`p-2 transition-all ${viewMode === 'list' ? 'bg-border text-text' : 'text-text-dark hover:text-text'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.015H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.015H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.015H3.75v-.015zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => { setNewProjectStage(undefined); setNewProjectOpen(true) }}
            className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-red-600 text-white text-[11px] font-bold uppercase tracking-widest transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dark pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter projects..."
            className="w-full bg-base border border-border pl-8 pr-3 py-1.5 text-[11px] text-text placeholder-text-darker tracking-wider focus:outline-none focus:border-border-hover transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dark hover:text-text transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* DAW filter pills */}
        {(availableDaws.ableton || availableDaws.maschine) && (
          <div className="flex items-center gap-1.5">
            {(['all', ...(availableDaws.ableton ? ['ableton'] : []), ...(availableDaws.maschine ? ['maschine'] : [])] as DawFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDawFilter(f === dawFilter ? 'all' : f)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                  dawFilter === f
                    ? f === 'all' ? 'bg-white/10 text-white'
                      : f === 'ableton' ? 'bg-[#d4f5a0]/15 text-[#d4f5a0]/80 border border-[#d4f5a0]/25'
                      : 'bg-[#ff6b35]/15 text-[#ff6b35]/80 border border-[#ff6b35]/25'
                    : 'text-text-muted hover:text-text-secondary border border-transparent'
                }`}
              >
                {f === 'all' ? 'All DAWs' : f === 'ableton' ? 'Ableton' : 'Maschine'}
              </button>
            ))}
          </div>
        )}

        {isFiltered && (
          <button
            onClick={() => { setSearch(''); setDawFilter('all') }}
            className="text-[9px] font-bold text-text-muted hover:text-text uppercase tracking-[0.15em] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* DAW sync toast */}
      {pendingDawNotification && (
        <div className="absolute top-0 right-0 z-50 flex items-center gap-2.5 bg-base border border-border px-4 py-3 shadow-2xl text-[11px]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            pendingDawNotification.event === 'add' ? 'bg-green-400' :
            pendingDawNotification.event === 'unlink' ? 'bg-red-400' : 'bg-yellow-400'
          }`} />
          <span className="text-text font-medium flex-1 truncate" style={{ maxWidth: 260 }}>
            {pendingDawNotification.event === 'add' ? `New project detected: ${pendingDawNotification.fileName}`
              : pendingDawNotification.event === 'unlink' ? `File removed: ${pendingDawNotification.fileName}`
              : `Updated: ${pendingDawNotification.fileName}`}
          </span>
          <button onClick={dismissDawNotification} className="text-text-muted hover:text-text transition-colors ml-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Board / list + detail panel */}
      <div className="flex flex-1 min-h-0">
        {viewMode === 'kanban' ? (
          <div className="flex-1 min-w-0 overflow-x-auto">
            <KanbanBoard
              collapseEmpty={collapseEmpty}
              filteredProjects={filteredProjects}
              onQuickAdd={handleQuickAdd}
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <ProjectListView
              projects={filteredProjects}
              selectedProjectId={selectedProjectId}
              onSelect={selectProject}
            />
          </div>
        )}
        {selectedProject && (
          <ProjectDetailPanel
            project={selectedProject}
            onClose={() => selectProject(null)}
          />
        )}
      </div>

      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        initialStage={newProjectStage}
      />

      {manageStagesOpen && <ManageStagesModal onClose={() => setManageStagesOpen(false)} />}
    </div>
  )
}
