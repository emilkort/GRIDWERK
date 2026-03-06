import { useState, useMemo, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  defaultDropAnimationSideEffects,
  type CollisionDetection
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useProjectStore, type Project } from '@/stores/project.store'
import { useStageStore } from '@/stores/stage.store'
import KanbanColumn from './KanbanColumn'
import ProjectCard from './ProjectCard'

function sortedByStage(ps: Project[], stage: string): Project[] {
  return ps.filter((p) => p.stage === stage).sort((a, b) => a.sort_order - b.sort_order)
}

function groupByStage(ps: Project[], stageSlugs: string[]): Record<string, Project[]> {
  const grouped: Record<string, Project[]> = {}
  for (const slug of stageSlugs) grouped[slug] = []
  for (const p of ps) {
    if (grouped[p.stage] !== undefined) grouped[p.stage].push(p)
  }
  for (const slug of stageSlugs) {
    grouped[slug].sort((a, b) => a.sort_order - b.sort_order)
  }
  return grouped
}

const dropAnimation = {
  duration: 150,
  easing: 'cubic-bezier(0.25, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.25' } }
  })
}

interface KanbanBoardProps {
  collapseEmpty?: boolean
  /** Override store's projects (for filtering). moveProject still targets the full store. */
  filteredProjects?: Project[]
  onQuickAdd?: (stage: string) => void
}

export default function KanbanBoard({ collapseEmpty = false, filteredProjects, onQuickAdd }: KanbanBoardProps) {
  const { projects: storeProjects, moveProject } = useProjectStore()
  const { stages } = useStageStore()
  const projects = filteredProjects ?? storeProjects
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [activeGroupCount, setActiveGroupCount] = useState(0)
  const [localProjects, setLocalProjectsState] = useState<Project[] | null>(null)
  const localProjectsRef = useRef<Project[] | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)

  // Keep a ref of stage slugs so callbacks never go stale
  const stageSlugs = useMemo(() => stages.map(s => s.slug), [stages])
  const stageSlugsRef = useRef<string[]>([])
  stageSlugsRef.current = stageSlugs

  const setLocalProjects = useCallback((val: Project[] | null) => {
    localProjectsRef.current = val
    setLocalProjectsState(val)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    })
  )

  const displayProjects = localProjects ?? projects
  const projectsByStage = useMemo(() => groupByStage(displayProjects, stageSlugs), [displayProjects, stageSlugs])

  // KEY FIX: prefer card hits over column hits so same-column reorder works.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const slugs = stageSlugsRef.current
    const hits = pointerWithin(args)
    const cardHits = hits.filter((h) => !slugs.includes(String(h.id)))
    if (cardHits.length > 0) return [cardHits[0]]
    const colHits = hits.filter((h) => slugs.includes(String(h.id)))
    if (colHits.length > 0) return [colHits[0]]
    return closestCenter(args)
  }, [])

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const p = projects.find((p) => String(p.id) === String(active.id))
    if (!p) return
    document.body.style.cursor = 'grabbing'
    setActiveProject(p)
    setLocalProjects([...projects])
    if (active.data.current?.isGroupRepresentative) {
      const gk = active.data.current.groupKey as string
      const count = projects.filter((x) => (x.group_key || x.title) === gk).length
      setActiveGroupCount(count)
    } else {
      setActiveGroupCount(0)
    }
  }, [projects, setLocalProjects])

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) { setOverColumnId(null); return }

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const current = localProjectsRef.current
    if (!current) return

    const slugs = stageSlugsRef.current
    const overIsColumn = slugs.includes(overId)
    const activeProj = current.find((p) => String(p.id) === activeId)
    if (!activeProj) return
    const activeStage = activeProj.stage

    const overStage: string | undefined = overIsColumn
      ? overId
      : current.find((p) => String(p.id) === overId)?.stage
    if (!overStage) return

    setOverColumnId(overStage)

    const dragGroupKey: string | undefined = active.data.current?.isGroupRepresentative
      ? active.data.current.groupKey
      : undefined

    const isGroupMember = (p: Project) =>
      dragGroupKey !== undefined && (p.group_key || p.title) === dragGroupKey

    if (activeStage === overStage && !overIsColumn) {
      const stageItems = sortedByStage(current, activeStage)

      if (dragGroupKey) {
        if (isGroupMember(stageItems.find((p) => String(p.id) === overId)!)) return
        const groupItems = stageItems.filter(isGroupMember)
        const rest = stageItems.filter((p) => !isGroupMember(p))
        const overIdxInRest = rest.findIndex((p) => String(p.id) === overId)
        if (overIdxInRest < 0) return
        const firstGroupIdxInFull = stageItems.findIndex(isGroupMember)
        const overIdxInFull = stageItems.findIndex((p) => String(p.id) === overId)
        const reordered = overIdxInFull < firstGroupIdxInFull
          ? [...rest.slice(0, overIdxInRest), ...groupItems, ...rest.slice(overIdxInRest)]
          : [...rest.slice(0, overIdxInRest + 1), ...groupItems, ...rest.slice(overIdxInRest + 1)]
        setLocalProjects([
          ...current.filter((p) => p.stage !== activeStage),
          ...reordered.map((p, i) => ({ ...p, sort_order: i }))
        ])
      } else {
        const oldIdx = stageItems.findIndex((p) => String(p.id) === activeId)
        const newIdx = stageItems.findIndex((p) => String(p.id) === overId)
        if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return
        const reordered = arrayMove(stageItems, oldIdx, newIdx).map((p, i) => ({ ...p, sort_order: i }))
        setLocalProjects([...current.filter((p) => p.stage !== activeStage), ...reordered])
      }
    } else if (activeStage !== overStage) {
      if (dragGroupKey) {
        const groupItems = sortedByStage(current, activeStage).filter(isGroupMember)
        const srcRest = sortedByStage(current, activeStage)
          .filter((p) => !isGroupMember(p))
          .map((p, i) => ({ ...p, sort_order: i }))
        const tgtItems = sortedByStage(current, overStage)
        const insertIdx = overIsColumn
          ? tgtItems.length
          : Math.max(0, tgtItems.findIndex((p) => String(p.id) === overId))
        const movedGroup = groupItems.map((p) => ({ ...p, stage: overStage  }))
        const updatedTgt = [...tgtItems]
        updatedTgt.splice(insertIdx, 0, ...movedGroup)
        setLocalProjects([
          ...current.filter((p) => p.stage !== activeStage && p.stage !== overStage),
          ...srcRest,
          ...updatedTgt.map((p, i) => ({ ...p, sort_order: i }))
        ])
      } else {
        const srcItems = sortedByStage(current, activeStage)
          .filter((p) => String(p.id) !== activeId)
          .map((p, i) => ({ ...p, sort_order: i }))
        const tgtItems = sortedByStage(current, overStage)
        const insertIdx = overIsColumn
          ? tgtItems.length
          : Math.max(0, tgtItems.findIndex((p) => String(p.id) === overId))
        const updated = [...tgtItems]
        updated.splice(insertIdx, 0, { ...activeProj, stage: overStage  })
        setLocalProjects([
          ...current.filter((p) => p.stage !== activeStage && p.stage !== overStage),
          ...srcItems,
          ...updated.map((p, i) => ({ ...p, sort_order: i }))
        ])
      }
    }
  }, [setLocalProjects])

  const handleDragEnd = useCallback(({ active }: DragEndEvent) => {
    const final = localProjectsRef.current
    document.body.style.cursor = ''
    setActiveProject(null)
    setActiveGroupCount(0)
    setLocalProjects(null)
    setOverColumnId(null)

    if (!final) return

    const dragGroupKey: string | undefined = active.data.current?.isGroupRepresentative
      ? active.data.current.groupKey
      : undefined

    if (dragGroupKey) {
      const activeId = Number(active.id)
      const representative = final.find((p) => p.id === activeId)
      if (!representative) return
      const destStage = representative.stage

      const allGroupMembers = storeProjects.filter((p) => (p.group_key || p.title) === dragGroupKey)
      const destStagemates = sortedByStage(final, destStage)
      allGroupMembers.forEach((member) => {
        const idx = destStagemates.findIndex((p) => p.id === member.id)
        const sortOrder = idx >= 0 ? idx : destStagemates.length
        moveProject(member.id, destStage, sortOrder)
      })
    } else {
      const activeId = Number(active.id)
      const finalProj = final.find((p) => p.id === activeId)
      if (!finalProj) return
      const stagemates = sortedByStage(final, finalProj.stage)
      const finalIndex = stagemates.findIndex((p) => p.id === activeId)
      moveProject(activeId, finalProj.stage, Math.max(0, finalIndex))
    }
  }, [moveProject, setLocalProjects, storeProjects])

  const handleDragCancel = useCallback(() => {
    document.body.style.cursor = ''
    setActiveProject(null)
    setActiveGroupCount(0)
    setLocalProjects(null)
    setOverColumnId(null)
  }, [setLocalProjects])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-2">
        {stages.map((column) => (
          <KanbanColumn
            key={column.slug}
            stage={column.slug}
            title={column.name}
            color={column.color}
            projects={projectsByStage[column.slug] || []}
            isOverColumn={overColumnId === column.slug}
            collapsed={collapseEmpty && (projectsByStage[column.slug] || []).length === 0}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeProject ? (
          activeGroupCount > 1 ? (
            <div className="relative" style={{ paddingBottom: activeGroupCount >= 3 ? 10 : 6 }}>
              {activeGroupCount >= 3 && (
                <div className="absolute inset-x-3 top-1.5 bottom-0 border border-[#1A1A1A] bg-[#080808]" />
              )}
              <div className="absolute inset-x-1.5 top-0.5 bottom-0 border border-border bg-[#0D0D0D]" />
              <div className="relative rotate-[0.5deg]">
                <ProjectCard project={activeProject} isOverlay groupCount={activeGroupCount} />
              </div>
            </div>
          ) : (
            <div className="rotate-[0.3deg]">
              <ProjectCard project={activeProject} isOverlay />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
