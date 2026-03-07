import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCollectionStore, type CollectionItem } from '@/stores/collection.store'

const STAGE_COLORS: Record<string, string> = {
  idea: '#3b82f6', in_progress: '#f97316', mixing: '#8b5cf6', done: '#22c55e'
}

function formatKey(key: string | null): string {
  if (!key) return ''
  return key.replace(' Major', 'M').replace(' Minor', 'm')
}

interface TrackerProject {
  id: number
  title: string
  stage: string
  bpm: number | null
  musical_key: string | null
  color: string | null
  group_key: string
  updated_at: number
}

interface SongGroup {
  group_key: string
  displayTitle: string
  primaryId: number
  versionCount: number
  stage: string
  bpm: number | null
  musical_key: string | null
  color: string | null
}

const STAGE_ORDER: Record<string, number> = { done: 4, mixing: 3, in_progress: 2, idea: 1 }

export default function CollectionDetail() {
  const {
    collections, selectedCollectionId, items, itemsLoading,
    updateCollection, setArtwork, removeItem, reorderItems, addItem
  } = useCollectionStore()

  const collection = collections.find(c => c.id === selectedCollectionId)

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(collection?.name ?? '')
  const [desc, setDesc] = useState(collection?.description ?? '')
  const nameRef = useRef<HTMLInputElement>(null)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [allProjects, setAllProjects] = useState<TrackerProject[]>([])
  const addInputRef = useRef<HTMLInputElement>(null)
  const addDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (collection) {
      setName(collection.name)
      setDesc(collection.description ?? '')
    }
  }, [collection?.id])

  // Fetch all projects when add-track picker opens
  useEffect(() => {
    if (showAddTrack) {
      window.api.project.list().then((projects: TrackerProject[]) => setAllProjects(projects))
      setTimeout(() => addInputRef.current?.focus(), 50)
    } else {
      setAddQuery('')
    }
  }, [showAddTrack])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showAddTrack) return
    const handler = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddTrack(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAddTrack])

  const existingIds = useMemo(() => new Set(items.map(i => i.project_id)), [items])

  const filteredSongGroups = useMemo(() => {
    // Group projects by group_key into song stacks
    const groups = new Map<string, TrackerProject[]>()
    for (const p of allProjects) {
      const key = p.group_key || p.title
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }

    const songs: SongGroup[] = []
    for (const [groupKey, members] of groups) {
      // Skip if ALL versions are already in the collection
      const available = members.filter(m => !existingIds.has(m.id))
      if (available.length === 0) continue

      // Pick the "best" version: highest stage, then most recently updated
      const primary = [...members].sort((a, b) => {
        const sd = (STAGE_ORDER[b.stage] ?? 0) - (STAGE_ORDER[a.stage] ?? 0)
        if (sd !== 0) return sd
        return (b.updated_at ?? 0) - (a.updated_at ?? 0)
      })[0]

      songs.push({
        group_key: groupKey,
        displayTitle: groupKey,
        primaryId: primary.id,
        versionCount: members.length,
        stage: primary.stage,
        bpm: primary.bpm,
        musical_key: primary.musical_key,
        color: primary.color
      })
    }

    const q = addQuery.toLowerCase().trim()
    return songs
      .filter(s => !q || s.displayTitle.toLowerCase().includes(q))
      .slice(0, 100)
  }, [allProjects, addQuery, existingIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !collection) return
    const oldIndex = items.findIndex(i => String(i.project_id) === active.id)
    const newIndex = items.findIndex(i => String(i.project_id) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(items, oldIndex, newIndex)
    reorderItems(collection.id, newOrder.map(i => i.project_id))
  }, [items, collection?.id, reorderItems])

  // Compute stats
  const bpms = items.map(i => i.bpm).filter((b): b is number => b != null)
  const avgBpm = bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null
  const keys = items.map(i => i.musical_key).filter((k): k is string => k != null)
  const keySet = [...new Set(keys)]

  if (!collection) return null

  const handleAddProject = async (projectId: number) => {
    await addItem(selectedCollectionId!, projectId)
    setAddQuery('')
  }

  const handleNameBlur = () => {
    setEditingName(false)
    if (name.trim() && name !== collection.name) {
      updateCollection(collection.id, { name: name.trim() })
    }
  }

  const handleDescBlur = () => {
    if (desc !== (collection.description ?? '')) {
      updateCollection(collection.id, { description: desc.trim() || null })
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Album header */}
      <div className="shrink-0 border-b border-border">
        <div className="flex gap-5 p-5">
          {/* Artwork */}
          <button
            onClick={() => setArtwork(collection.id)}
            className="w-36 h-36 shrink-0 bg-elevated border border-border hover:border-border-hover transition-colors group relative overflow-hidden"
            title="Set album artwork"
          >
            {collection.artwork_path ? (
              <img src={`file://${collection.artwork_path}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${collection.color}15` }}>
                <svg className="w-8 h-8 text-text-darker group-hover:text-text-dark transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Set Art</span>
            </div>
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-end pb-1">
            {/* Type badge */}
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: collection.color }}>
              {collection.type}
            </span>

            {/* Name */}
            {editingName ? (
              <input
                ref={nameRef}
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={e => { if (e.key === 'Enter') nameRef.current?.blur(); if (e.key === 'Escape') { setName(collection.name); setEditingName(false) } }}
                className="bg-transparent text-text text-2xl font-bold focus:outline-none border-b border-text-muted pb-0.5 w-full"
              />
            ) : (
              <h1
                onClick={() => setEditingName(true)}
                className="text-text text-2xl font-bold cursor-text hover:opacity-80 transition-opacity truncate"
              >
                {collection.name}
              </h1>
            )}

            {/* Description */}
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={handleDescBlur}
              placeholder="Add description..."
              rows={1}
              className="mt-2 bg-transparent text-text-secondary text-[12px] placeholder-text-darker focus:outline-none resize-none w-full"
            />

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-text-dark font-bold">
              <span>{items.length} track{items.length !== 1 ? 's' : ''}</span>
              {avgBpm && <span>{avgBpm} avg BPM</span>}
              {keySet.length > 0 && keySet.length <= 3 && <span>{keySet.map(formatKey).join(', ')}</span>}
              {keySet.length > 3 && <span>{keySet.length} keys</span>}
              <div className="relative ml-auto" ref={addDropdownRef}>
                <button
                  onClick={() => setShowAddTrack(!showAddTrack)}
                  className="flex items-center gap-1 text-[10px] font-bold text-text-dark hover:text-text transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Track
                </button>
                {showAddTrack && (
                  <div className="absolute right-0 top-full mt-1 w-80 bg-elevated border border-border shadow-xl z-50">
                    <div className="p-2 border-b border-border">
                      <input
                        ref={addInputRef}
                        value={addQuery}
                        onChange={e => setAddQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') setShowAddTrack(false)
                          if (e.key === 'Enter' && filteredSongGroups.length > 0) handleAddProject(filteredSongGroups[0].primaryId)
                        }}
                        placeholder="Search projects..."
                        className="w-full bg-base border border-border px-2.5 py-1.5 text-text text-[11px] focus:outline-none focus:border-text-muted"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredSongGroups.length === 0 ? (
                        <p className="px-3 py-4 text-[10px] text-text-darker text-center">No songs found</p>
                      ) : (
                        filteredSongGroups.map(s => {
                          const stageColor = STAGE_COLORS[s.stage] || '#666'
                          return (
                            <button
                              key={s.group_key}
                              onClick={() => handleAddProject(s.primaryId)}
                              className="w-full text-left px-3 py-2 hover:bg-surface/80 transition-colors flex items-center gap-2"
                            >
                              {s.color && <div className="w-2 h-2 shrink-0" style={{ backgroundColor: s.color }} />}
                              <span className="text-[11px] text-text font-medium truncate flex-1">{s.displayTitle}</span>
                              {s.versionCount > 1 && (
                                <span className="text-[9px] text-text-darker">{s.versionCount}v</span>
                              )}
                              {s.bpm && <span className="text-[9px] text-text-dark tabular-nums">{Math.round(s.bpm)}</span>}
                              {s.musical_key && <span className="text-[9px] text-text-dark font-bold">{formatKey(s.musical_key)}</span>}
                              <span
                                className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5"
                                style={{ color: stageColor, backgroundColor: `${stageColor}10` }}
                              >
                                {s.stage.replace('_', ' ')}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <div className="flex-1 overflow-y-auto">
        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-text-darker border-t-text animate-spin rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-2">
              <p className="text-text-dark text-[13px]">No tracks yet</p>
              <p className="text-text-darker text-[11px]">Use "Add Track" above or pick from suggestions</p>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => String(i.project_id))} strategy={verticalListSortingStrategy}>
              {/* Header row */}
              <div className="flex items-center px-5 py-2 border-b border-border text-[9px] font-bold uppercase tracking-[0.15em] text-text-darker">
                <span className="w-8 text-center">#</span>
                <span className="flex-1 ml-3">Title</span>
                <span className="w-16 text-center">BPM</span>
                <span className="w-20 text-center">Key</span>
                <span className="w-12 text-center">Tracks</span>
                <span className="w-20 text-center">Stage</span>
                <span className="w-8" />
              </div>
              {items.map((item, index) => (
                <TrackRow
                  key={item.project_id}
                  item={item}
                  index={index}
                  collectionId={collection.id}
                  onRemove={() => removeItem(collection.id, item.project_id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

function TrackRow({
  item, index, collectionId, onRemove
}: {
  item: CollectionItem
  index: number
  collectionId: number
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item.project_id)
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  const stageColor = STAGE_COLORS[item.stage] || '#666'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center px-5 py-2.5 border-b border-border/50 hover:bg-surface/50 transition-colors"
    >
      {/* Drag handle + number */}
      <div
        {...attributes}
        {...listeners}
        className="w-8 flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <span className="text-[12px] text-text-dark font-bold tabular-nums group-hover:hidden">
          {index + 1}
        </span>
        <svg className="w-3.5 h-3.5 text-text-dark hidden group-hover:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </div>

      {/* Title + DAW file */}
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex items-center gap-2">
          {item.color && <div className="w-2 h-2 shrink-0" style={{ backgroundColor: item.color }} />}
          <span className="text-[12px] text-text font-medium truncate">{item.title}</span>
        </div>
        {item.daw_file_name && (
          <p className="text-[9px] text-text-darker mt-0.5 truncate">{item.daw_file_name}</p>
        )}
      </div>

      {/* BPM */}
      <div className="w-16 text-center">
        {item.bpm ? (
          <span className="text-[11px] text-text-secondary tabular-nums font-medium">{Math.round(item.bpm)}</span>
        ) : (
          <span className="text-[11px] text-text-darker">—</span>
        )}
      </div>

      {/* Key */}
      <div className="w-20 text-center">
        {item.musical_key ? (
          <span className="text-[10px] font-bold text-text-secondary">{formatKey(item.musical_key)}</span>
        ) : (
          <span className="text-[11px] text-text-darker">—</span>
        )}
      </div>

      {/* Track count */}
      <div className="w-12 text-center">
        {item.track_count != null ? (
          <span className="text-[11px] text-text-dark tabular-nums">{item.track_count}</span>
        ) : (
          <span className="text-[11px] text-text-darker">—</span>
        )}
      </div>

      {/* Stage */}
      <div className="w-20 flex justify-center">
        <span
          className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
          style={{ backgroundColor: `${stageColor}15`, color: stageColor, border: `1px solid ${stageColor}30` }}
        >
          {item.stage.replace('_', ' ')}
        </span>
      </div>

      {/* Remove */}
      <div className="w-8 flex justify-center">
        <button
          onClick={onRemove}
          className="p-0.5 text-text-darker opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
          title="Remove from collection"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
