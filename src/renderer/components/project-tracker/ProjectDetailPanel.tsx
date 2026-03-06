import { useState, useEffect, useRef, useCallback } from 'react'
import { useProjectStore, type Project, type ProjectTodo } from '@/stores/project.store'
import { useStageStore } from '@/stores/stage.store'

interface ProjectPlugin {
  id: number
  plugin_name: string
  format: string | null
  file_name: string | null
}

interface MatchingSample {
  id: number
  file_name: string
  bpm: number | null
  musical_key: string | null
  category: string | null
}

const COLOR_SWATCHES = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#ef4444'
]

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MUSICAL_KEYS = NOTES.flatMap((n) => [`${n} Major`, `${n} Minor`])

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

interface Props {
  project: Project
  onClose: () => void
}

export default function ProjectDetailPanel({ project, onClose }: Props) {
  const { projects, todos, todosLoading, updateProject, moveProject, createTodo, toggleTodo, updateTodoText, deleteTodo } =
    useProjectStore()
  const { stages } = useStageStore()

  // Version siblings — all other projects with the same group_key
  const siblings = project.group_key
    ? projects.filter((p) => p.id !== project.id && p.group_key === project.group_key)
        .sort((a, b) => (b.daw_last_modified ?? b.updated_at) - (a.daw_last_modified ?? a.updated_at))
    : []

  // ── Local editable state ─────────────────────────────────────────────────
  const [title, setTitle]           = useState(project.title)
  const [description, setDescription] = useState(project.description ?? '')
  const [bpm, setBpm]               = useState(project.bpm?.toString() ?? '')
  const [musicalKey, setMusicalKey] = useState(project.musical_key ?? '')
  const [color, setColor]           = useState(project.color ?? '#8b5cf6')

  // Sync when a different project is selected
  useEffect(() => {
    setTitle(project.title)
    setDescription(project.description ?? '')
    setBpm(project.bpm?.toString() ?? '')
    setMusicalKey(project.musical_key ?? '')
    setColor(project.color ?? '#8b5cf6')
  }, [project.id])

  // ── Debounced field saves ────────────────────────────────────────────────
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleFieldSave = useCallback((changes: Record<string, any>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => updateProject(project.id, changes), 600)
  }, [project.id, updateProject])

  const handleTitleBlur = () => {
    if (title.trim() && title !== project.title)
      scheduleFieldSave({ title: title.trim() })
  }
  const handleDescriptionBlur = () => {
    if (description !== (project.description ?? ''))
      scheduleFieldSave({ description: description || null })
  }
  const handleBpmBlur = () => {
    const val = bpm === '' ? null : Number(bpm)
    if (val !== project.bpm) scheduleFieldSave({ bpm: val })
  }
  const handleKeyChange = (k: string) => {
    setMusicalKey(k)
    updateProject(project.id, { musical_key: k || null })
  }
  const handleColorChange = (c: string) => {
    setColor(c)
    updateProject(project.id, { color: c })
  }
  const handleStageChange = (stage: string) => {
    moveProject(project.id, stage, project.sort_order)
  }

  // ── Todos ────────────────────────────────────────────────────────────────
  const [newTodo, setNewTodo] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const newTodoRef = useRef<HTMLInputElement>(null)

  const handleAddTodo = async () => {
    const text = newTodo.trim()
    if (!text) return
    setNewTodo('')
    await createTodo(project.id, text)
  }

  const handleTodoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAddTodo()
    if (e.key === 'Escape') setNewTodo('')
  }

  const startEditTodo = (todo: ProjectTodo) => {
    setEditingTodoId(todo.id)
    setEditingText(todo.text)
  }

  const commitEditTodo = async (todoId: number) => {
    const text = editingText.trim()
    if (text) await updateTodoText(todoId, text)
    setEditingTodoId(null)
  }

  const todosDone  = todos.filter((t) => t.done === 1).length
  const todosTotal = todos.length

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Plugins from DAW project ────────────────────────────────────────────
  const [plugins, setPlugins] = useState<ProjectPlugin[]>([])
  useEffect(() => {
    if (project.daw_project_id) {
      window.api.project.getPlugins(project.id).then(setPlugins).catch(() => setPlugins([]))
    } else {
      setPlugins([])
    }
  }, [project.id, project.daw_project_id])

  // ── Matching samples (BPM/key aware) ──────────────────────────────────
  const [matchingSamples, setMatchingSamples] = useState<MatchingSample[]>([])
  useEffect(() => {
    if (project.bpm || project.musical_key) {
      window.api.sample.findMatching(project.bpm ?? null, project.musical_key ?? null)
        .then((samples: MatchingSample[]) => setMatchingSamples(samples.slice(0, 8)))
        .catch(() => setMatchingSamples([]))
    } else {
      setMatchingSamples([])
    }
  }, [project.id, project.bpm, project.musical_key])

  const stageInfo = stages.find((s) => s.slug === project.stage) ?? stages[0]

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border w-[440px] shrink-0 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-base shrink-0">
        {/* Color dot */}
        <div className="w-3 h-3 shrink-0" style={{ backgroundColor: color }} />
        {/* Stage badge */}
        {stageInfo && (
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
            style={{ backgroundColor: `${stageInfo.color}22`, color: stageInfo.color, border: `1px solid ${stageInfo.color}55` }}
          >
            {stageInfo.name}
          </span>
        )}
        <div className="flex-1" />
        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text transition-colors"
          title="Close (Esc)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Title */}
        <div className="px-5 pt-5 pb-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full bg-transparent text-text text-xl font-bold placeholder-text-dark focus:outline-none border-b border-transparent focus:border-text-muted transition-colors pb-1"
            placeholder="Project title…"
          />
        </div>

        {/* Stage pills */}
        <div className="px-5 pb-4 flex gap-1.5 flex-wrap">
          {stages.map((s) => (
            <button
              key={s.slug}
              onClick={() => handleStageChange(s.slug)}
              className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-150"
              style={
                project.stage === s.slug
                  ? { backgroundColor: `${s.color}22`, color: s.color, border: `1px solid ${s.color}66` }
                  : { backgroundColor: '#242424', color: '#666', border: '1px solid transparent' }
              }
            >
              <div className="w-1.5 h-1.5 " style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>

        {/* Description */}
        <div className="px-5 pb-5 border-b border-border">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Add a description…"
            rows={3}
            className="w-full bg-transparent text-[#ccc] text-[13px] leading-relaxed placeholder-text-dark focus:outline-none resize-none border border-transparent hover:border-text-darker focus:border-text-muted rounded px-2 py-1.5 transition-colors"
          />
        </div>

        {/* ── Properties ─────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-border space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Properties</p>

          {/* BPM + Key row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">BPM</label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                onBlur={handleBpmBlur}
                placeholder="—"
                min={20} max={300}
                className="w-full bg-surface border border-border hover:border-border-hover focus:border-text rounded px-3 py-1.5 text-text text-[13px] focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Key</label>
              <select
                value={musicalKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                className="w-full bg-surface border border-border hover:border-border-hover focus:border-text rounded px-3 py-1.5 text-text text-[13px] focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">—</option>
                {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className="w-6 h-6  transition-all duration-150"
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {color === c && (
                    <span className="flex items-center justify-center w-full h-full">
                      <svg className="w-3 h-3 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── DAW file ───────────────────────────────────────────────────── */}
        {project.daw_file_name && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">DAW Project</p>
            <div className="flex items-center gap-2 bg-surface border border-border-hover rounded px-3 py-2">
              <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-text text-[12px] font-medium truncate">{project.daw_file_name}</p>
                {project.daw_last_modified && (
                  <p className="text-text-muted text-[10px] mt-0.5">
                    Last saved {formatDate(project.daw_last_modified)}
                  </p>
                )}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-dark bg-[#222] px-1.5 py-0.5 rounded shrink-0">
                read-only
              </span>
            </div>
          </div>
        )}

        {/* ── Version History ─────────────────────────────────────────────── */}
        {siblings.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Versions ({siblings.length + 1})
            </p>
            <div className="space-y-1">
              {/* Current version */}
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded bg-white/5 border border-white/8">
                <div className="w-1.5 h-1.5  bg-green-400 shrink-0" />
                <span className="text-[12px] text-text font-medium truncate flex-1">{project.title}</span>
                <span className="text-[9px] font-bold text-green-400/70 uppercase tracking-wider shrink-0">current</span>
              </div>
              {/* Sibling versions */}
              {siblings.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-surface transition-colors">
                  <div className="w-1.5 h-1.5  bg-[#3a3a3a] shrink-0" />
                  <span className="text-[12px] text-text-secondary truncate flex-1">{s.title}</span>
                  {s.daw_last_modified && (
                    <span className="text-[10px] text-text-dark shrink-0 tabular-nums">
                      {formatDate(s.daw_last_modified)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Plugins Used ──────────────────────────────────────────────── */}
        {plugins.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Plugins Used ({plugins.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plugins.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated border border-border text-[10px]"
                  title={p.file_name ?? p.plugin_name}
                >
                  <span className="text-text font-medium truncate max-w-[180px]">{p.plugin_name}</span>
                  {p.format && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 shrink-0"
                      style={{
                        color: p.format === 'VST3' ? '#3b82f6' : '#f97316',
                        background: p.format === 'VST3' ? '#3b82f610' : '#f9731610',
                        border: `1px solid ${p.format === 'VST3' ? '#3b82f630' : '#f9731630'}`
                      }}
                    >{p.format}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Matching Samples ────────────────────────────────────────────── */}
        {matchingSamples.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Matching Samples
            </p>
            <p className="text-[9px] text-text-dark mb-2">
              Samples that match {project.bpm ? `${project.bpm} BPM` : ''}{project.bpm && project.musical_key ? ' + ' : ''}{project.musical_key ?? ''}
            </p>
            <div className="space-y-1">
              {matchingSamples.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface transition-colors">
                  <svg className="w-3 h-3 text-text-dark shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                  </svg>
                  <span className="text-[10px] text-text truncate flex-1">{s.file_name}</span>
                  {s.bpm && <span className="text-[9px] text-text-dark shrink-0">{Math.round(s.bpm)} bpm</span>}
                  {s.musical_key && <span className="text-[9px] text-text-dark shrink-0">{s.musical_key}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Todos ──────────────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Tasks</p>
            {todosTotal > 0 && (
              <span className="text-[10px] text-text-muted font-bold">
                {todosDone}/{todosTotal}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {todosTotal > 0 && (
            <div className="h-1 bg-[#222]  mb-3 overflow-hidden">
              <div
                className="h-full  transition-all duration-300"
                style={{
                  width: `${Math.round((todosDone / todosTotal) * 100)}%`,
                  backgroundColor: todosDone === todosTotal ? '#22c55e' : '#8b5cf6'
                }}
              />
            </div>
          )}

          {/* Todo list */}
          {todosLoading ? (
            <div className="py-4 flex justify-center">
              <div className="w-4 h-4 border-2 border-text-darker border-t-text  animate-spin" />
            </div>
          ) : (
            <div className="space-y-1 mb-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="group flex items-start gap-2.5 px-2 py-1.5 rounded hover:bg-surface transition-colors"
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTodo(todo.id, todo.done === 0)}
                    className="mt-0.5 shrink-0 w-4 h-4 rounded border transition-all duration-150 flex items-center justify-center"
                    style={{
                      borderColor: todo.done ? '#22c55e' : '#444',
                      backgroundColor: todo.done ? '#22c55e' : 'transparent'
                    }}
                  >
                    {todo.done === 1 && (
                      <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Text / edit */}
                  {editingTodoId === todo.id ? (
                    <input
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={() => commitEditTodo(todo.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEditTodo(todo.id)
                        if (e.key === 'Escape') setEditingTodoId(null)
                      }}
                      className="flex-1 bg-[#242424] border border-text-muted rounded px-2 py-0.5 text-[13px] text-text focus:outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startEditTodo(todo)}
                      className={`flex-1 text-[13px] leading-relaxed cursor-default select-none ${
                        todo.done ? 'line-through text-text-dark' : 'text-[#ccc]'
                      }`}
                    >
                      {todo.text}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-text-dark hover:text-red-400 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add todo input */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 shrink-0 rounded border border-border flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <input
              ref={newTodoRef}
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={handleTodoKeyDown}
              placeholder="Add a task…"
              className="flex-1 bg-transparent text-[13px] text-text-secondary placeholder-[#3a3a3a] focus:text-text focus:outline-none transition-colors py-1"
            />
            {newTodo.trim() && (
              <button
                onClick={handleAddTodo}
                className="text-[11px] text-[#8b5cf6] hover:text-text font-bold transition-colors"
              >
                Add
              </button>
            )}
          </div>
        </div>

        {/* ── Footer meta ─────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-border">
          <div className="flex items-center justify-between text-[10px] text-text-dark font-bold uppercase tracking-wider">
            <span>Created {formatDate(project.created_at)}</span>
            <span>Updated {formatDate(project.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
