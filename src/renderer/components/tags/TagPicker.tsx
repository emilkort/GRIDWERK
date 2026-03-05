import { useCallback, useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import TagBadge from './TagBadge'

interface Tag {
  id: number
  name: string
  color: string
}

interface TagPickerProps {
  entityType: 'sample' | 'vst' | 'project' | 'daw_project'
  entityId: number
}

const TAG_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#ef4444'
]

export default function TagPicker({ entityType, entityId }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [entityTags, setEntityTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  const fetchTags = useCallback(async () => {
    const [all, attached] = await Promise.all([
      window.api.tag.list(),
      window.api.tag.getForEntity(entityType, entityId)
    ])
    setAllTags(all)
    setEntityTags(attached)
  }, [entityType, entityId])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const handleToggleTag = useCallback(async (tag: Tag) => {
    const isAttached = entityTags.some((t) => t.id === tag.id)
    if (isAttached) {
      await window.api.tag.detach(tag.id, entityType, entityId)
    } else {
      await window.api.tag.attach(tag.id, entityType, entityId)
    }
    await fetchTags()
  }, [entityType, entityId, entityTags, fetchTags])

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim()
    if (!name) return
    const tag = await window.api.tag.create({ name, color: newTagColor })
    await window.api.tag.attach(tag.id, entityType, entityId)
    setNewTagName('')
    await fetchTags()
  }, [newTagName, newTagColor, entityType, entityId, fetchTags])

  const handleRemoveTag = useCallback(async (tagId: number) => {
    await window.api.tag.detach(tagId, entityType, entityId)
    await fetchTags()
  }, [entityType, entityId, fetchTags])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateTag()
    }
  }, [handleCreateTag])

  return (
    <div>
      {/* Attached tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {entityTags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            onRemove={() => handleRemoveTag(tag.id)}
          />
        ))}
      </div>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="text-[10px] font-bold uppercase tracking-widest text-text-dark hover:text-text transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Tag
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-50 bg-base border border-border p-3 space-y-2 w-52 shadow-2xl shadow-black/90 focus:outline-none"
          >
            {/* Existing tags */}
            {allTags.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {allTags.map((tag) => {
                  const isAttached = entityTags.some((t) => t.id === tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag)}
                      className="w-full flex items-center gap-2 px-2 py-1 hover:bg-elevated transition-colors text-left"
                    >
                      <span
                        className="w-3 h-3 flex-shrink-0 border border-border flex items-center justify-center"
                        style={{ backgroundColor: isAttached ? tag.color : 'transparent' }}
                      >
                        {isAttached && (
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-[11px] text-text-muted">{tag.name}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Divider */}
            {allTags.length > 0 && <div className="border-t border-border" />}

            {/* Create new tag */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="New tag..."
                className="flex-1 bg-transparent border-b border-border focus:border-text text-[11px] text-text placeholder-text-dark py-1 px-1 focus:outline-none"
              />
              <div className="flex gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className="w-3.5 h-3.5 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: newTagColor === c ? 'scale(1.3)' : 'scale(1)',
                      outline: newTagColor === c ? '2px solid white' : 'none',
                      outlineOffset: '1px'
                    }}
                  />
                ))}
              </div>
            </div>

            {newTagName.trim() && (
              <button
                onClick={handleCreateTag}
                className="w-full text-[10px] font-bold uppercase tracking-widest text-center py-1.5 bg-accent text-white hover:bg-red-600 transition-colors"
              >
                Create "{newTagName.trim()}"
              </button>
            )}

            <Popover.Arrow className="fill-border" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
