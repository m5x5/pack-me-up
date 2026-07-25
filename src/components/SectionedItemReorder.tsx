/**
 * Reorder view for an item list, split into sections.
 *
 * Position is the interaction — you drag an item under a header to put it in
 * that section — but nothing positional is stored. Every drop runs the sequence
 * back through `applySectionLayout`, which stamps each item with the nearest
 * header above it. See `item-sections.ts` for why the storage is stamped.
 */
import { useRef, useState } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type Modifier,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '../edit-questions/types'
import {
    applySectionLayout,
    buildSectionSequence,
    type SectionSequenceEntry,
} from '../edit-questions/item-sections'

// Drags only ever move rows up and down the list.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

function SectionHeaderRow({ id, label, isDefault, onRename, onRemove }: {
    id: string
    label: string
    isDefault: boolean
    onRename: (label: string) => void
    onRemove: () => void
}) {
    // Headers sit in the sortable context so items can be dropped across them,
    // but they aren't draggable themselves — a section moves by moving its items.
    const { setNodeRef, transform, transition } = useSortable({ id, disabled: true })
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(label)

    const commit = () => {
        const trimmed = draft.trim()
        if (trimmed && trimmed !== label) onRename(trimmed)
        else setDraft(label)
        setEditing(false)
    }

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className="flex items-center gap-2 pt-3 pb-1"
        >
            {editing ? (
                <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commit()
                        if (e.key === 'Escape') { setDraft(label); setEditing(false) }
                    }}
                    aria-label={`Rename section ${label}`}
                    className="flex-1 min-w-0 border border-primary-300 rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            ) : (
                <>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
                        {label}
                    </span>
                    <span className="flex-1 h-px bg-gray-200" />
                    {!isDefault && (
                        <>
                            <button
                                type="button"
                                onClick={() => { setDraft(label); setEditing(true) }}
                                aria-label={`Rename section ${label}`}
                                className="text-[11px] text-gray-400 hover:text-primary-600 px-1"
                            >
                                Rename
                            </button>
                            <button
                                type="button"
                                onClick={onRemove}
                                aria-label={`Remove section ${label}`}
                                className="text-[11px] text-gray-400 hover:text-red-600 px-1"
                            >
                                Remove
                            </button>
                        </>
                    )}
                </>
            )}
        </div>
    )
}

function SortableSectionItem({ id, item, canMoveUp, canMoveDown, onMove }: {
    id: string
    item: Item
    canMoveUp: boolean
    canMoveDown: boolean
    onMove: (direction: 'up' | 'down') => void
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            data-reorder-row
            className={`flex items-center gap-1 rounded-lg border bg-white p-2 ${isDragging ? 'relative z-10 border-primary-400 shadow-md opacity-95' : 'border-gray-200'}`}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 cursor-grab active:cursor-grabbing touch-none"
                title="Drag to reorder or move between sections"
                aria-label={`Drag ${item.text || 'item'} to reorder`}
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z" />
                </svg>
            </button>
            <span className="flex-1 min-w-0 truncate text-sm text-gray-800 px-1">
                {item.text || <span className="text-gray-400 italic">Unnamed item</span>}
            </span>
            <div className="flex gap-1 shrink-0">
                <button
                    type="button"
                    onClick={() => onMove('up')}
                    disabled={!canMoveUp}
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-lg border transition-colors ${!canMoveUp ? 'text-gray-200 border-gray-100 cursor-not-allowed' : 'text-gray-600 border-gray-200 hover:bg-gray-50 active:bg-gray-100'}`}
                    title="Move item up"
                    aria-label={`Move ${item.text || 'item'} up`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
                <button
                    type="button"
                    onClick={() => onMove('down')}
                    disabled={!canMoveDown}
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-lg border transition-colors ${!canMoveDown ? 'text-gray-200 border-gray-100 cursor-not-allowed' : 'text-gray-600 border-gray-200 hover:bg-gray-50 active:bg-gray-100'}`}
                    title="Move item down"
                    aria-label={`Move ${item.text || 'item'} down`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>
        </div>
    )
}

export function SectionedItemReorder({ items, defaultLabel, suggestedSectionNames, scrollRef, onChange }: {
    items: Item[]
    /** Section name for items carrying no category — what the list will call them. */
    defaultLabel: string
    suggestedSectionNames: string[]
    scrollRef: React.RefObject<HTMLDivElement | null>
    onChange: (items: Item[]) => void
}) {
    // Sections the user has created but not yet filled. They can't be stored
    // (a section is only its items' stamps), so they live here until something
    // lands in them — and are simply forgotten if nothing does.
    const [draftSections, setDraftSections] = useState<string[]>([])
    const [addingSection, setAddingSection] = useState(false)
    const [newSectionName, setNewSectionName] = useState('')

    const sequence = buildSectionSequence(items, defaultLabel, draftSections)

    // dnd-kit needs a stable id per row across reorders. Items may have no `id`
    // yet (defaults not saved), so map each object to a client-only drag id.
    const dragIdMap = useRef(new WeakMap<Item, string>())
    const dragIdSeq = useRef(0)
    const entryId = (entry: SectionSequenceEntry): string => {
        if (entry.kind === 'header') return `header:${entry.label}`
        let id = dragIdMap.current.get(entry.item)
        if (!id) {
            id = `item-${dragIdSeq.current++}`
            dragIdMap.current.set(entry.item, id)
        }
        return id
    }
    const entryIds = sequence.map(entryId)

    const applySequence = (next: SectionSequenceEntry[]) => {
        const updated = applySectionLayout(next, defaultLabel, new Date().toISOString())
        // A section that still has a header but no items stays a draft, so the
        // user can keep dragging into it; one that gained items no longer needs
        // to be remembered here.
        const filled = new Set(updated.map(i => i.category).filter(Boolean) as string[])
        setDraftSections(prev => prev.filter(label => !filled.has(label)))
        onChange(updated)
    }

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e
        if (!over || active.id === over.id) return
        const from = entryIds.indexOf(String(active.id))
        const to = entryIds.indexOf(String(over.id))
        if (from === -1 || to === -1) return
        const next = [...sequence]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        applySequence(next)
    }

    // The arrows are the keyboard//no-pointer equivalent of dragging: stepping
    // an item past a header moves it into the neighbouring section, exactly as
    // dragging across that header would.
    const moveEntry = (seqIndex: number, direction: 'up' | 'down') => {
        const target = direction === 'up' ? seqIndex - 1 : seqIndex + 1
        if (target < 0 || target >= sequence.length) return
        const next = [...sequence]
        ;[next[seqIndex], next[target]] = [next[target], next[seqIndex]]
        applySequence(next)
    }

    const addSection = () => {
        const name = newSectionName.trim()
        setNewSectionName('')
        setAddingSection(false)
        if (!name) return
        const existing = new Set(sequence.filter(e => e.kind === 'header').map(e => e.kind === 'header' && e.label))
        if (existing.has(name)) return
        setDraftSections(prev => [...prev, name])
    }

    const renameSectionAt = (from: string, to: string) => {
        setDraftSections(prev => prev.map(label => label === from ? to : label))
        onChange(items.map(item =>
            item.category === from ? { ...item, category: to, lastModified: new Date().toISOString() } : item
        ))
    }

    const removeSectionAt = (label: string) => {
        setDraftSections(prev => prev.filter(l => l !== label))
        onChange(items.map(item => {
            if (item.category !== label) return item
            const { category: _dropped, ...rest } = item
            return { ...rest, lastModified: new Date().toISOString() }
        }))
    }

    const firstItemIndex = sequence.findIndex(e => e.kind === 'item')
    const lastItemIndex = sequence.map(e => e.kind).lastIndexOf('item')

    return (
        <>
            <div className="text-[11px] text-gray-400 mb-2 px-0.5">
                Drag the handle (press and hold on touch), or use the arrows, to reorder.
                Move an item under a section heading to put it in that section.
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                // Only ever auto-scroll the modal's own scroll area — see the
                // note on the unsectioned editor for why.
                autoScroll={{ canScroll: (el) => el === scrollRef.current }}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {sequence.map((entry, i) => entry.kind === 'header' ? (
                            <SectionHeaderRow
                                key={entryIds[i]}
                                id={entryIds[i]}
                                label={entry.label}
                                isDefault={entry.label === defaultLabel}
                                onRename={to => renameSectionAt(entry.label, to)}
                                onRemove={() => removeSectionAt(entry.label)}
                            />
                        ) : (
                            <SortableSectionItem
                                key={entryIds[i]}
                                id={entryIds[i]}
                                item={entry.item}
                                canMoveUp={i > firstItemIndex}
                                canMoveDown={i < lastItemIndex}
                                onMove={direction => moveEntry(i, direction)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            {addingSection ? (
                <div className="mt-3 flex gap-2">
                    <input
                        autoFocus
                        list="section-name-suggestions"
                        value={newSectionName}
                        onChange={e => setNewSectionName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') addSection()
                            if (e.key === 'Escape') { setNewSectionName(''); setAddingSection(false) }
                        }}
                        placeholder="Section name (e.g. Toiletries)"
                        aria-label="New section name"
                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {/* Suggest names already in use so the same section spelled two
                        ways doesn't split into two groups on the list. */}
                    <datalist id="section-name-suggestions">
                        {suggestedSectionNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                    <button
                        type="button"
                        onClick={addSection}
                        className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        Add
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAddingSection(true)}
                    className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                >
                    + Add section
                </button>
            )}
        </>
    )
}
