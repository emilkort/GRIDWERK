import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectStore, type Project } from '@/stores/project.store'
import { useStageStore } from '@/stores/stage.store'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ContextMenu from '@/components/shared/ContextMenu'

interface ProjectCardProps {
  project: Project
  isOverlay?: boolean
  groupCount?: number
  isGroupRepresentative?: boolean
  groupKey?: string
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#f87171', dot: true },
  high:   { label: 'High',   color: '#fb923c', dot: true },
  normal: { label: '',       color: '',        dot: false },
  low:    { label: 'Low',    color: '#60a5fa', dot: true }
} as const


function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function ProjectCard({
  project,
  isOverlay = false,
  groupCount,
  isGroupRepresentative,
  groupKey
}: ProjectCardProps) {
  const { deleteProject, selectProject, selectedProjectId, moveProject, moveGroup } = useProjectStore()
  const { stages } = useStageStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const isSelected = selectedProjectId === project.id
  const priorityCfg = PRIORITY_CONFIG[project.priority ?? 'normal']

  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(project.id),
    disabled: isOverlay,
    data: isGroupRepresentative ? { isGroupRepresentative: true, groupKey } : undefined
  })

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition,
    willChange: transform ? 'transform' : undefined
  }

  const hasTodos  = project.todo_count > 0
  const allDone   = hasTodos && project.done_count === project.todo_count
  const progress  = hasTodos ? project.done_count / project.todo_count : 0
  const accentColor = project.color || '#8b5cf6'
  const hasTags = project.tags && project.tags.length > 0

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-select]')) return
    selectProject(isSelected ? null : project.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isOverlay) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMoveToStage = (stage: string) => {
    setCtxMenu(null)
    if (isGroupRepresentative && groupKey) {
      moveGroup(groupKey, stage)
    } else {
      moveProject(project.id, stage, 0)
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        className={`group relative bg-base border overflow-hidden transition-all duration-150 select-none ${
          isOverlay
            ? 'shadow-[0_20px_60px_rgba(0,0,0,0.95)] border-white/20 cursor-grabbing'
            : isDragging
            ? 'opacity-0 pointer-events-none'
            : isSelected
            ? 'border-white/15 cursor-grab active:cursor-grabbing'
            : 'border-border hover:border-border-hover cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex">
          {/* Accent color strip */}
          <div className="w-[3px] shrink-0" style={{ backgroundColor: accentColor }} />

          <div className="flex-1 px-3 pt-3 pb-2.5 min-w-0">

            {/* Title row */}
            <div className="flex items-start gap-1.5">
              {/* Priority dot */}
              {priorityCfg.dot && (
                <div
                  className="mt-[4px] w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: priorityCfg.color }}
                  title={priorityCfg.label}
                />
              )}

              <h4 className="text-text text-[12px] font-bold flex-1 min-w-0 leading-snug tracking-[0.03em]">
                {project.title}
                {groupCount && groupCount > 1 && (
                  <span className="ml-1.5 align-middle text-[9px] font-bold bg-white/8 text-white/30 px-1.5 py-0.5">
                    {groupCount}v
                  </span>
                )}
              </h4>

              {/* Delete */}
              <button
                data-no-select
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 mt-0.5 text-[#3a3a3a] hover:text-red-400 transition-all rounded"
                title="Delete project"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Description */}
            {project.description && (
              <p className="text-[#4a4a4a] text-[11px] mt-1.5 truncate leading-relaxed">
                {project.description}
              </p>
            )}

            {/* Tags */}
            {hasTags && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {project.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide"
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                      border: `1px solid ${tag.color}35`
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
                {project.tags.length > 3 && (
                  <span className="text-[9px] text-text-muted font-bold">+{project.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Todo progress */}
            {hasTodos && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${allDone ? 'text-green-500' : 'text-text-dark'}`}>
                    {project.done_count}/{project.todo_count}
                  </span>
                  {allDone && (
                    <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </div>
                <div className="h-px bg-border overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: allDone ? '#22c55e' : accentColor
                    }}
                  />
                </div>
              </div>
            )}

            {/* Metadata footer */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {project.bpm && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#3a3a3a] font-bold tabular-nums">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {project.bpm}
                </span>
              )}
              {project.musical_key && (
                <span className="text-[10px] text-[#3a3a3a] font-bold">{project.musical_key}</span>
              )}
              {project.track_count != null && project.track_count > 0 && (
                <span className="text-[10px] text-[#3a3a3a] font-bold">{project.track_count}t</span>
              )}

              {/* Date — right side */}
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#2e2e2e] font-bold tabular-nums">
                {project.daw_last_modified
                  ? formatDateTime(project.daw_last_modified)
                  : formatDate(project.updated_at)}
              </span>
            </div>

            {/* DAW badge row */}
            {project.daw_name && (
              <div className="flex items-center mt-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                    project.daw_name.toLowerCase().includes('ableton')
                      ? 'bg-[#d4f5a0]/8 border-[#d4f5a0]/15 text-[#d4f5a0]/50'
                      : project.daw_name.toLowerCase().includes('maschine')
                      ? 'bg-[#ff6b35]/8 border-[#ff6b35]/15 text-[#ff6b35]/50'
                      : 'bg-white/5 border-white/10 text-white/25'
                  }`}
                  title={project.daw_file_name ?? project.daw_name}
                >
                  {project.daw_name.toLowerCase().includes('ableton') ? 'Ableton'
                    : project.daw_name.toLowerCase().includes('maschine') ? 'Maschine'
                    : project.daw_name}
                </span>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Context menu */}
      {!isOverlay && (
        <ContextMenu
          position={ctxMenu}
          onClose={() => setCtxMenu(null)}
          items={[
            ...stages.filter((s) => s.slug !== project.stage).map((s) => ({
              label: `Move to ${s.name}`,
              onClick: () => handleMoveToStage(s.slug)
            })),
            {
              label: 'Delete',
              danger: true,
              onClick: () => { setCtxMenu(null); setConfirmDelete(true) }
            }
          ]}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Project"
        message={`Delete "${project.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => { await deleteProject(project.id); setConfirmDelete(false) }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
