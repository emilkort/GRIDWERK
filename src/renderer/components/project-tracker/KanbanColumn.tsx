import { useState, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Project } from '@/stores/project.store'
import ProjectCard from './ProjectCard'

interface KanbanColumnProps {
  stage: string
  title: string
  color: string
  projects: Project[]
  isOverColumn: boolean
  collapsed?: boolean
  onQuickAdd?: (stage: string) => void
}

interface ProjectGroup {
  key: string
  representative: Project   // most recently modified version
  projects: Project[]       // all versions, newest first
}

function buildGroups(projects: Project[]): ProjectGroup[] {
  const groups: ProjectGroup[] = []
  const map = new Map<string, ProjectGroup>()

  for (const p of projects) {
    const key = p.group_key || p.title
    let group = map.get(key)
    if (!group) {
      group = { key, representative: p, projects: [] }
      map.set(key, group)
      groups.push(group)
    }
    group.projects.push(p)
  }

  // Sort members newest-first so representative = latest version
  for (const g of groups) {
    g.projects.sort((a, b) =>
      (b.daw_last_modified ?? b.updated_at) - (a.daw_last_modified ?? a.updated_at)
    )
    g.representative = g.projects[0]
  }

  return groups
}

export default function KanbanColumn({ stage, title, color, projects, isOverColumn, collapsed = false, onQuickAdd }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  // Track which groups the user has explicitly expanded (default = all collapsed)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const highlighted = isOver || isOverColumn

  // Collapsed (empty column) — render as a thin droppable strip
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={`flex flex-col items-center w-12 min-w-12 shrink-0 border py-4 gap-3 transition-colors duration-200 ${
          highlighted ? 'border-accent/40 bg-surface' : 'border-border bg-surface'
        }`}
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span
          className="text-[9px] font-bold uppercase tracking-widest text-text-dark"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {title}
        </span>
      </div>
    )
  }

  const groups = useMemo(() => buildGroups(projects), [projects])

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Only IDs of rendered cards — hidden versions in collapsed groups are excluded
  // so dnd-kit never tries to find a DOM node that isn't mounted
  const sortableIds = useMemo(() => {
    const ids: string[] = []
    for (const group of groups) {
      if (group.projects.length <= 1 || !expandedGroups.has(group.key)) {
        ids.push(String(group.representative.id))
      } else {
        for (const p of group.projects) ids.push(String(p.id))
      }
    }
    return ids
  }, [groups, expandedGroups])

  // Header shows unique song count, not raw file count
  const songCount = groups.length

  return (
    <div
      className={`flex flex-col w-[280px] min-w-[280px] shrink-0 border transition-colors duration-200 ${
        highlighted
          ? 'border-accent/40 bg-surface'
          : 'border-border bg-surface'
      }`}
    >
      {/* Column header */}
      <div className="group/header flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 shrink-0" style={{ backgroundColor: color }} />
          <h3 className="text-text font-bold text-[10px] tracking-[0.15em] uppercase">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onQuickAdd && (
            <button
              onClick={() => onQuickAdd(stage)}
              className="opacity-0 group-hover/header:opacity-100 p-0.5 text-text-dark hover:text-text transition-all"
              title={`Add to ${title}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
          <span className="text-[10px] text-text-dark bg-elevated px-1.5 py-0.5 font-bold tabular-nums">
            {songCount}
          </span>
        </div>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[120px]"
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-8 h-8 border border-dashed border-border flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#222]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-[9px] text-[#222] font-bold uppercase tracking-widest">Drop here</span>
            </div>
          ) : (
            groups.map((group) => {
              if (group.projects.length === 1) {
                return <ProjectCard key={group.representative.id} project={group.representative} />
              }

              const isExpanded = expandedGroups.has(group.key)

              return (
                <div key={group.key} className="space-y-1">
                  {isExpanded ? (
                    <>
                      <div className="ml-1 pl-2 border-l border-border space-y-1.5">
                        {group.projects.map((p) => (
                          <ProjectCard key={p.id} project={p} />
                        ))}
                      </div>
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-elevated transition-colors group/collapse"
                      >
                        <svg className="w-3 h-3 text-text-darker group-hover/collapse:text-white/40 transition-colors rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                        <span className="text-[9px] text-text-darker group-hover/collapse:text-white/40 transition-colors uppercase tracking-wider">
                          Hide {group.projects.length} versions
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="relative" style={{ paddingBottom: group.projects.length >= 3 ? 8 : 4 }}>
                        {group.projects.length >= 3 && (
                          <div className="absolute inset-x-2.5 top-1 bottom-0 border border-th-hover bg-[#080808]" />
                        )}
                        <div className="absolute inset-x-1 top-0.5 bottom-0 border border-[#1A1A1A] bg-[#0D0D0D]" />
                        <div className="relative">
                          <ProjectCard
                            project={group.representative}
                            groupCount={group.projects.length}
                            isGroupRepresentative={true}
                            groupKey={group.key}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="flex items-center gap-1.5 w-full px-2 py-0.5 hover:bg-elevated transition-colors group/expand"
                      >
                        <svg className="w-3 h-3 text-[#2A2A2A] group-hover/expand:text-white/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                        <span className="text-[9px] text-[#2A2A2A] group-hover/expand:text-white/40 transition-colors uppercase tracking-wider">
                          {group.projects.length} versions
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )
            })
          )}
        </SortableContext>
      </div>
    </div>
  )
}
