import { useState, useEffect, useCallback, useId, useRef, useMemo, memo, Fragment } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useDatabase } from '../components/DatabaseContext'
import { SectionedItemReorder } from '../components/SectionedItemReorder'
import { ALWAYS_NEEDED_CATEGORY, addEmptySection, buildSectionGroups, defaultCategoryFor, reconcileEmptySections, sectionNamesIn, type PositionedItem } from '../edit-questions/item-sections'
import { sectionAccent } from '../edit-questions/section-accent'
import { DatabaseMigration } from '../services/migration'
import { PackingListQuestionSet, Person, Item, Option, Question, QuestionType, newDraftQuestion, renumberItemOrder, AGE_RANGE_OPTIONS } from '../edit-questions/types'
import { Link } from 'react-router-dom'
import { useSyncCoordinator } from '../hooks/useSyncCoordinator'
import { usePodSync } from '../hooks/usePodSync'
import { mergeQuestionSets } from '../utils/mergeQuestionSets'
import { POD_CONTAINERS } from '../services/solidPod'
import { questionSetToDataset, datasetToQuestionSet } from '../services/rdfSerialization'
import { useSolidPod } from '../components/SolidPodContext'
import { useForeignPod } from '../components/ForeignPodContext'
import { CustomCreatableSelect } from '../components/CreatableSelect'
import { AgePromotionCard } from '../components/AgePromotionCard'
import { TemplateUpdatesCard } from '../components/TemplateUpdatesCard'
import { LoadingState } from '../components/LoadingState'
import { AgeTransition } from '../edit-questions/age-derivation'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { appendItemToSection, applyItemEdit, tombstoneRemovedItems, withQuestionOptions } from '../edit-questions/item-edits'
import { ItemInlineEditor } from '../components/ItemInlineEditor'
import { AddQuestionItem } from '../components/AddQuestionItem'
import { ALWAYS_LIST_KEY, buildQuestionSetSuggestions, listKeyFor } from '../edit-questions/item-suggestions'
import { buildIndexOf, type SuggestionIndex } from '../utils/itemSuggestions'
import {
    AVATAR_ON,
    AVATAR_OFF,
    PersonToggles,
    QuantityPanel,
    rateBadge,
    rateLabel,
    quantityTitle,
} from '../components/ItemEditorControls'

// Stable empty default for the optional inline-editing props, so a section that
// isn't editable doesn't hand its memoized children a new array every render.
const NO_NAMES: string[] = []

function PersonDot({ person, index, selected }: { person: Person; index: number; selected: boolean }) {
    return (
        <span
            title={person.name}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold select-none shrink-0 ${selected ? AVATAR_ON[index % AVATAR_ON.length] : AVATAR_OFF}`}
        >
            {person.name.charAt(0).toUpperCase()}
        </span>
    )
}

const PersonLegend = memo(function PersonLegend({ people, onEdit }: { people: Person[]; onEdit?: () => void }) {
    if (people.length < 2 && !onEdit) return null
    return (
        <div className="flex items-center gap-2 flex-wrap mb-4">
            {people.length === 0 && onEdit && (
                <span className="text-xs text-gray-400">No people added</span>
            )}
            {people.map((person, i) => (
                <span key={person.id} className="flex items-center gap-1 text-xs text-gray-500">
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${AVATAR_ON[i % AVATAR_ON.length]}`}>
                        {person.name.charAt(0).toUpperCase()}
                    </span>
                    {person.name}
                </span>
            ))}
            {onEdit && (
                <button
                    type="button"
                    onClick={onEdit}
                    className="p-1 text-gray-300 hover:text-gray-600 rounded"
                    title="Edit people"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            )}
        </div>
    )
})

/**
 * One item, read-only. When `onOpen` is supplied the whole row becomes the
 * target that opens the inline editor — the affordance that used to be missing,
 * and the reason changing one word meant scrolling back to the option's pencil
 * and reopening the whole list in a modal.
 */
const ItemRow = memo(function ItemRow({ item, people, index, isOpen, onOpen }: {
    item: Item
    people: Person[]
    index: number
    isOpen?: boolean
    onOpen?: (index: number) => void
}) {
    const showDots = people.length > 1
    const content = (
        <>
            <span className={`flex-1 min-w-0 text-left ${item.text ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                {item.text || 'no text'}
            </span>
            {item.communal && (
                <span
                    title="Shared — packed once for the whole group"
                    className="inline-flex items-center justify-center h-5 rounded-full px-1.5 text-[10px] font-medium bg-blue-100 text-blue-700 select-none shrink-0"
                >
                    👥
                </span>
            )}
            {item.perNight !== undefined && (
                <span
                    title={quantityTitle(item)}
                    className="inline-flex items-center justify-center h-5 rounded-full px-1.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 select-none shrink-0"
                >
                    ×{rateLabel(item).replace(' per ', '/')}
                </span>
            )}
            {showDots && (
                <div className="flex gap-0.5 shrink-0">
                    {people.map((person, i) => (
                        <PersonDot
                            key={person.id}
                            person={person}
                            index={i}
                            selected={item.personSelections?.[i]?.selected ?? false}
                        />
                    ))}
                </div>
            )}
        </>
    )
    if (!onOpen) {
        return <div className="flex items-center gap-2 py-0.5 px-2 text-sm">{content}</div>
    }
    return (
        <button
            type="button"
            data-testid="item-row"
            onClick={() => onOpen(index)}
            aria-expanded={isOpen ?? false}
            title={`Edit ${item.text || 'item'}`}
            className={`group w-full flex items-center gap-2 py-1 px-2 text-sm rounded transition-colors ${isOpen ? 'bg-primary-50' : 'hover:bg-gray-100'}`}
        >
            {content}
            {/* Decorative, not a button of its own: the whole row is the target,
                and a second hit area inside it would only make the real one
                harder to hit. Sits last so it lines up down the right edge —
                a column of pencils is what says the rows are editable. */}
            <svg
                data-testid="item-edit-icon"
                aria-hidden="true"
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${isOpen ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-700'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        </button>
    )
})

/** Composer key for the one at the foot of a list, which picks its own section. */
const LIST_COMPOSER = '__list__'

const FOOT_BUTTON = 'py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors'

/**
 * Name a new section. Offers the names already used elsewhere in the set, so
 * one section doesn't end up spelled two ways and split into two groups on the
 * generated list.
 */
function AddSection({ suggestions, onAdd, onClose }: {
    suggestions: readonly string[]
    onAdd: (label: string) => void
    onClose: () => void
}) {
    const [name, setName] = useState('')
    const listId = useId()
    const commit = () => {
        const trimmed = name.trim()
        if (trimmed) onAdd(trimmed)
        else onClose()
    }
    return (
        <div
            data-testid="add-section"
            className="flex gap-2"
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget) && !name.trim()) onClose() }}
        >
            <input
                autoFocus
                list={listId}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit()
                    if (e.key === 'Escape') onClose()
                }}
                aria-label="New section name"
                placeholder="Section name (e.g. Toiletries)"
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <datalist id={listId}>
                {suggestions.map(label => <option key={label} value={label} />)}
            </datalist>
            <button
                type="button"
                onClick={commit}
                className="shrink-0 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
                Add
            </button>
        </div>
    )
}

/**
 * Everything one item list needs to add to itself. Passed as a single object so
 * a list that can't be added to (a foreign pod's, say) is `undefined` rather
 * than three separate omitted props — and so one `useMemo` keeps the whole lot
 * stable for the memoized rows below.
 */
export interface ItemAdding {
    suggestions: SuggestionIndex
    /** Which list this is, so its own names aren't offered back to it. */
    ownerKey: string
    onAdd: (text: string, category: string | undefined) => void
}

/**
 * Read-only item list, split by section the same way the editor and the
 * generated packing list are — so this page shows the grouping a list will
 * actually have without opening a modal.
 *
 * Each section is a card with a coloured heading strip (see `section-accent`):
 * a run of items under a line of grey capitals read as one undivided list, and
 * the grouping is the whole point of the page. Cards only appear once a list is
 * genuinely split; an unsectioned list renders as plain rows, as it did before.
 *
 * Every heading carries a ＋ that adds to *that* section, which is the shortest
 * way to say where an item goes: you tap it where you want the item, and it
 * lands there. The list also ends with one that picks its own section, for a
 * list with no sections yet and for sections that don't exist yet. Only one
 * composer is mounted at a time — one per heading would put an input in front
 * of every section on the page, which is the cost the read-only rows exist to
 * avoid.
 */
const SectionedItemRows = memo(function SectionedItemRows({ items, people, defaultLabel, emptySections = NO_NAMES, allItemNames = NO_NAMES, sectionNames = NO_NAMES, adding, onItemChange, onItemDelete, onSectionAdd }: {
    items: Item[]
    people: Person[]
    defaultLabel: string
    /** Sections of this list that have nothing in them yet — drawn as empty cards. */
    emptySections?: string[]
    allItemNames?: string[]
    sectionNames?: string[]
    /** Omit to leave the list read-only — no ＋ buttons, no composer. */
    adding?: ItemAdding
    /** Omit to keep the list purely read-only — rows then aren't clickable. */
    onItemChange?: (index: number, edited: Item) => void
    /** Omit to leave items undeletable. */
    onItemDelete?: (index: number) => void
    /** Omit to leave the list unable to grow a section. */
    onSectionAdd?: (label: string) => void
}) {
    // Which row is expanded, by its position in `items` — the same flat index
    // every edit is addressed by. At most one is open, so a long list never
    // costs more than one mounted editor.
    const [openIndex, setOpenIndex] = useState<number | null>(null)
    // Which composer is open, by section label (or LIST_COMPOSER for the one at
    // the foot). Same one-at-a-time rule, for the same reason.
    const [openComposer, setOpenComposer] = useState<string | null>(null)
    const closeComposer = useCallback(() => setOpenComposer(null), [])
    const [addingSection, setAddingSection] = useState(false)

    const groups = useMemo(
        () => buildSectionGroups(items, defaultLabel, emptySections),
        [items, defaultLabel, emptySections])
    // Worth drawing as cards once the list is genuinely split — or once its one
    // group is something other than the default pile, which is what a list whose
    // only section is a newly created empty one looks like.
    const hasSections = groups.length > 1 || (groups[0] !== undefined && groups[0].label !== defaultLabel)

    // Sections the foot composer can file into: the ones this list already has,
    // plus every name used elsewhere in the set — so filing an item under
    // Toiletries doesn't depend on this particular answer having used it yet.
    const sectionOptions = useMemo(
        () => [...new Set([...groups.map(group => group.label), ...sectionNames])]
            .filter(label => label !== defaultLabel),
        [groups, sectionNames, defaultLabel])

    const renderComposer = (label: string, forSection: boolean) => adding && (
        <AddQuestionItem
            category={forSection && label !== defaultLabel ? label : undefined}
            sectionOptions={forSection ? undefined : sectionOptions}
            defaultLabel={defaultLabel}
            suggestions={adding.suggestions}
            ownerKey={adding.ownerKey}
            targetLabel={label}
            // Where it is going, restated where the typing happens: the heading
            // it opened under scrolls off a phone as soon as the keyboard is up.
            placeholder={forSection ? `Add to ${label}...` : 'Add an item...'}
            onAdd={adding.onAdd}
            onClose={closeComposer}
            autoFocus
        />
    )
    // A sync or a delete can shrink the list under an open row; treat an index
    // that no longer exists as closed rather than rendering against undefined.
    const openAt = openIndex !== null && openIndex < items.length ? openIndex : null

    const handleOpen = useCallback((index: number) =>
        setOpenIndex(prev => prev === index ? null : index), [])
    const handleClose = useCallback(() => setOpenIndex(null), [])

    // The row being edited has gone, and every index after it has shifted up, so
    // the open editor is closed rather than left addressing its neighbour.
    const handleDelete = useCallback(() => {
        if (openAt === null) return
        onItemDelete?.(openAt)
        setOpenIndex(null)
    }, [openAt, onItemDelete])

    const handleChange = useCallback((edited: Item) => {
        if (openAt === null) return
        const before = items[openAt]
        if (!before) return
        // Deliberately not inside a setState updater: StrictMode double-invokes
        // those, and this one saves.
        onItemChange?.(openAt, edited)
        // Changing an item's section moves it to the bottom of that section, so
        // every index after it shifts and this one no longer names the row being
        // edited. Closing is also the clearer outcome — the row has visibly gone
        // to sit under its new heading.
        if ((edited.category ?? null) !== (before.category ?? null)) setOpenIndex(null)
    }, [openAt, items, onItemChange])

    const renderRow = (entry: PositionedItem) => (
        <Fragment key={`item-${entry.index}`}>
            <ItemRow
                item={entry.item}
                people={people}
                index={entry.index}
                isOpen={openAt === entry.index}
                onOpen={onItemChange ? handleOpen : undefined}
            />
            {openAt === entry.index && (
                <ItemInlineEditor
                    item={entry.item}
                    people={people}
                    allItemNames={allItemNames}
                    sectionNames={sectionNames}
                    sectionDefaultLabel={defaultLabel}
                    onChange={handleChange}
                    onDelete={onItemDelete ? handleDelete : undefined}
                    onClose={handleClose}
                />
            )}
        </Fragment>
    )

    // The foot of every list: one tap to a composer that asks where the item
    // goes. It replaces itself with the composer rather than sitting above it,
    // so the list never grows two add affordances at once.
    //
    // Beside it, the only place a section is made. It is deliberately a button
    // and not a typed name in some other field: a section is a thing you create,
    // and the moment that stopped being true was the moment "type a new name at
    // an item" had to double as both moving that item and renaming its section.
    const listFooter = adding && (
        openComposer === LIST_COMPOSER
            ? <div className="mt-2">{renderComposer(defaultLabel, false)}</div>
            : addingSection
                ? (
                    <div className="mt-2">
                        <AddSection
                            suggestions={sectionOptions}
                            onAdd={label => { onSectionAdd?.(label); setAddingSection(false) }}
                            onClose={() => setAddingSection(false)}
                        />
                    </div>
                )
                : (
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setOpenComposer(LIST_COMPOSER)}
                            className={`${FOOT_BUTTON} flex-1`}
                        >
                            + Add item
                        </button>
                        {onSectionAdd && (
                            <button
                                type="button"
                                onClick={() => setAddingSection(true)}
                                className={`${FOOT_BUTTON} shrink-0 px-3`}
                            >
                                + Add section
                            </button>
                        )}
                    </div>
                )
    )

    if (!hasSections) {
        return (
            <div>
                <div className="space-y-0.5">{groups.flatMap(group => group.entries).map(renderRow)}</div>
                {listFooter}
            </div>
        )
    }

    return (
        <div>
            <div className="space-y-2">
                {groups.map(group => {
                    const accent = sectionAccent(group.label, group.label === defaultLabel)
                    return (
                        <div
                            key={`section-${group.label}`}
                            data-testid="item-section"
                            // Deliberately not `overflow-hidden`: the composer's
                            // suggestion list hangs below the card and was being
                            // clipped away to nothing. The heading rounds its own
                            // top corners instead of relying on the card to crop
                            // them.
                            className={`rounded-lg border ${accent.border} bg-white`}
                        >
                            <div className={`flex items-center gap-2 rounded-t-lg px-2.5 py-1.5 ${accent.header}`}>
                                <span
                                    data-testid="item-section-heading"
                                    className={`text-sm font-semibold ${accent.text} truncate`}
                                >
                                    {group.label}
                                </span>
                                <span
                                    data-testid="item-section-count"
                                    className={`ml-auto shrink-0 text-[11px] font-medium ${accent.muted}`}
                                >
                                    {group.entries.length} item{group.entries.length === 1 ? '' : 's'}
                                </span>
                                {adding && (
                                    <button
                                        type="button"
                                        data-testid="add-to-section"
                                        onClick={() => setOpenComposer(prev => prev === group.label ? null : group.label)}
                                        aria-expanded={openComposer === group.label}
                                        aria-label={`Add an item to ${group.label}`}
                                        title={`Add an item to ${group.label}`}
                                        className={`shrink-0 -my-1 rounded p-1.5 ${accent.text} hover:bg-white/70 transition-colors`}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className="p-1 space-y-0.5">
                                {group.entries.length === 0 && openComposer !== group.label && (
                                    // A section you have just made, before anything is
                                    // in it. Says so rather than drawing a card with a
                                    // blank body, which reads as a rendering fault.
                                    <p className="px-1.5 py-1 text-xs text-gray-400 italic">
                                        Nothing here yet — use ＋ to add the first item
                                    </p>
                                )}
                                {group.entries.map(renderRow)}
                            </div>
                            {openComposer === group.label && (
                                <div className="px-1.5 pb-1.5 pt-0.5">{renderComposer(group.label, true)}</div>
                            )}
                        </div>
                    )
                })}
            </div>
            {listFooter}
        </div>
    )
})

/**
 * Set an option's empty-section list, dropping the field when there is nothing
 * to record. Nested objects don't pass through `toDocumentData`'s undefined
 * filter — only the top level does — so an option would otherwise carry an
 * `emptySections: undefined` key into storage.
 */
function withEmptySections(option: Option, emptySections: string[] | undefined): Option {
    const { emptySections: _dropped, ...rest } = option
    return emptySections?.length ? { ...rest, emptySections } : rest
}

function OptionContextMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    className="p-2 text-gray-400 hover:text-gray-700 rounded"
                    title="More actions"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                    </svg>
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50"
                >
                    <DropdownMenu.Item
                        onSelect={onEdit}
                        className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-default outline-none"
                    >
                        Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        onSelect={onDelete}
                        className="px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 cursor-default outline-none"
                    >
                        Delete
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}

export function OptionSection({ option, people, sectionDefaultLabel, allItemNames, sectionNames, questionId, suggestions, onEdit, onDelete, onItemChange, onItemAdd, onItemDelete, onSectionAdd }: {
    option: Option
    people: Person[]
    /** What the packing list will call items here that carry no category. */
    sectionDefaultLabel: string
    allItemNames?: string[]
    sectionNames?: string[]
    questionId?: string
    suggestions?: SuggestionIndex
    onEdit: () => void
    onDelete: () => void
    /** Omit to leave the item rows read-only. */
    onItemChange?: (questionId: string, optionId: string, index: number, edited: Item) => void
    /** Omit to leave the list unaddable — no ＋ buttons appear. */
    onItemAdd?: (questionId: string, optionId: string, text: string, category: string | undefined) => void
    /** Omit to leave items undeletable. */
    onItemDelete?: (questionId: string, optionId: string, index: number) => void
    /** Omit to leave the option unable to grow a section. */
    onSectionAdd?: (questionId: string, optionId: string, label: string) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    // Bound to this option's ids once, so the memoized row list isn't handed a
    // fresh callback on every render of the page around it.
    const optionId = option.id
    const handleItemChange = useMemo(
        () => onItemChange && questionId
            ? (index: number, edited: Item) => onItemChange(questionId, optionId, index, edited)
            : undefined,
        [onItemChange, questionId, optionId])
    const handleItemDelete = useMemo(
        () => onItemDelete && questionId
            ? (index: number) => onItemDelete(questionId, optionId, index)
            : undefined,
        [onItemDelete, questionId, optionId])
    const handleSectionAdd = useMemo(
        () => onSectionAdd && questionId
            ? (label: string) => onSectionAdd(questionId, optionId, label)
            : undefined,
        [onSectionAdd, questionId, optionId])
    const adding = useMemo<ItemAdding | undefined>(
        () => onItemAdd && questionId && suggestions
            ? {
                suggestions,
                ownerKey: listKeyFor(questionId, optionId),
                onAdd: (text, category) => onItemAdd(questionId, optionId, text, category),
            }
            : undefined,
        [onItemAdd, questionId, optionId, suggestions])
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    // Items aren't mounted until first expand (cheap initial render for large
    // sets), but stay mounted afterwards so re-expanding is instant.
    const hasExpandedRef = useRef(isExpanded)
    if (isExpanded) hasExpandedRef.current = true
    // Nothing to reveal when an answer has no items, so drop the chevron and the
    // toggle entirely and say so inline — an expander that opens onto nothing
    // just reads as broken. Once items can be added it no longer opens onto
    // nothing, and an answer with no items is exactly the one most in need of
    // somewhere to put the first.
    const isEmpty = option.items.length === 0
    // A section with nothing in it yet is still something to open onto.
    const canExpand = !isEmpty || adding !== undefined || (option.emptySections?.length ?? 0) > 0
    const heading = (
        <>
            {!canExpand ? (
                // Spacer keeps the text aligned with the chevroned siblings.
                <span className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            ) : (
                <svg
                    data-testid="option-expand-chevron"
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            )}
            <span className="text-sm font-medium text-gray-800 flex-1 min-w-0">
                {option.text || <em className="text-gray-400 font-normal">Untitled option</em>}
            </span>
            {isEmpty ? (
                <span className="text-xs text-gray-400 italic flex-shrink-0 mr-1">No items</span>
            ) : (
                <span className="hidden sm:inline text-xs text-gray-400 flex-shrink-0 mr-1">{option.items.length} items</span>
            )}
        </>
    )
    return (
        <div data-testid="option-section" className="bg-gray-50 rounded-lg p-3">
            <div className={`flex items-center${isExpanded ? ' mb-2' : ''}`}>
                {!canExpand ? (
                    <div className="flex items-center gap-2 flex-1 text-left min-w-0">
                        {heading}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(e => !e)}
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                        {heading}
                    </button>
                )}
                <div className="flex items-center flex-shrink-0">
                    {/* Mobile: context menu */}
                    <div className="sm:hidden">
                        <OptionContextMenu
                            onEdit={onEdit}
                            onDelete={() => setShowDeleteModal(true)}
                        />
                    </div>
                    {/* Desktop: inline buttons */}
                    <div className="hidden sm:flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={onEdit}
                            className="p-1 text-gray-300 hover:text-gray-600 rounded"
                            title="Edit option"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDeleteModal(true)}
                            className="p-1 text-gray-300 hover:text-red-400 rounded"
                            title="Delete option"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            {hasExpandedRef.current && (
                <div className={isExpanded ? undefined : 'hidden'}>
                    <SectionedItemRows
                        items={option.items}
                        people={people}
                        defaultLabel={sectionDefaultLabel}
                        emptySections={option.emptySections}
                        allItemNames={allItemNames}
                        sectionNames={sectionNames}
                        adding={adding}
                        onItemChange={handleItemChange}
                        onItemDelete={handleItemDelete}
                        onSectionAdd={handleSectionAdd}
                    />
                </div>
            )}
            {showDeleteModal && (
                <DeleteConfirmModal
                    onConfirm={() => { onDelete(); setShowDeleteModal(false) }}
                    onCancel={() => setShowDeleteModal(false)}
                />
            )}
        </div>
    )
}

function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={onCancel}
            onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete question?</h2>
                <p className="text-sm text-gray-500 mb-6">This will permanently remove the question and all its options.</p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

function QuestionContextMenu({ onMoveUp, onMoveDown, onEdit, onDelete }: {
    onMoveUp?: () => void
    onMoveDown?: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    return (
        <>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <button
                        type="button"
                        className="p-2 text-gray-400 hover:text-gray-700 rounded"
                        title="More actions"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                        </svg>
                    </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        className="w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50"
                    >
                        <DropdownMenu.Item
                            onSelect={onEdit}
                            className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-default outline-none"
                        >
                            Edit
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                            onSelect={onMoveUp}
                            disabled={!onMoveUp}
                            className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-default outline-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none"
                        >
                            Move Up
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                            onSelect={onMoveDown}
                            disabled={!onMoveDown}
                            className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-default outline-none data-[disabled]:text-gray-300 data-[disabled]:pointer-events-none"
                        >
                            Move Down
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                            onSelect={e => { e.preventDefault(); setShowDeleteModal(true) }}
                            className="px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 cursor-default outline-none"
                        >
                            Delete
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {showDeleteModal && (
                <DeleteConfirmModal
                    onConfirm={() => { onDelete(); setShowDeleteModal(false) }}
                    onCancel={() => setShowDeleteModal(false)}
                />
            )}
        </>
    )
}

// Memoized with id-based handlers whose identity survives page re-renders, so
// opening a modal (or a background sync tick) doesn't re-render every question.
const QuestionSection = memo(function QuestionSection({ question, people, canMoveUp, canMoveDown, allItemNames, sectionNames, suggestions, onEdit, onDelete, onAddOption, onEditOption, onDeleteOption, onMove, onItemChange, onItemAdd, onItemDelete, onSectionAdd }: {
    question: Question
    people: Person[]
    canMoveUp: boolean
    canMoveDown: boolean
    allItemNames: string[]
    sectionNames: string[]
    suggestions: SuggestionIndex
    onEdit: (question: Question) => void
    onDelete: (id: string) => void
    onAddOption: (questionId: string) => void
    onEditOption: (questionId: string, option: Option) => void
    onDeleteOption: (questionId: string, optionId: string) => void
    onMove: (id: string, direction: 'up' | 'down') => void
    onItemChange: (questionId: string, optionId: string, index: number, edited: Item) => void
    onItemAdd: (questionId: string, optionId: string, text: string, category: string | undefined) => void
    onItemDelete: (questionId: string, optionId: string, index: number) => void
    onSectionAdd: (questionId: string, optionId: string, label: string) => void
}) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    // Once expanded, keep the options mounted (hidden) so re-expanding is instant.
    const hasExpandedRef = useRef(isExpanded)
    if (isExpanded) hasExpandedRef.current = true
    const handleEdit = () => onEdit(question)
    const handleDelete = () => onDelete(question.id)
    const moveUp = canMoveUp ? () => onMove(question.id, 'up') : undefined
    const moveDown = canMoveDown ? () => onMove(question.id, 'down') : undefined
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-stretch">
                <button
                    type="button"
                    onClick={() => setIsExpanded(e => !e)}
                    className="flex items-center gap-3 flex-1 text-left px-4 py-4 sm:px-6 min-w-0 hover:bg-gray-50 transition-colors duration-150"
                >
                    <svg
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="font-medium text-gray-900 flex-1 min-w-0">
                        {question.text || <em className="text-gray-400 font-normal">Untitled question</em>}
                    </span>
                    <span className="hidden sm:inline text-xs text-gray-400 flex-shrink-0 mr-2">{question.options.length} options</span>
                </button>
                <div className="flex items-center pr-3 flex-shrink-0">
                    {/* Mobile: context menu */}
                    <div className="sm:hidden">
                        <QuestionContextMenu
                            onMoveUp={moveUp}
                            onMoveDown={moveDown}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    </div>
                    {/* Desktop: inline buttons */}
                    <div className="hidden sm:flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={moveUp}
                            disabled={!canMoveUp}
                            className={`p-1.5 rounded ${canMoveUp ? 'text-gray-300 hover:text-gray-600' : 'text-gray-100 cursor-not-allowed'}`}
                            title="Move up"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={moveDown}
                            disabled={!canMoveDown}
                            className={`p-1.5 rounded ${canMoveDown ? 'text-gray-300 hover:text-gray-600' : 'text-gray-100 cursor-not-allowed'}`}
                            title="Move down"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={handleEdit}
                            className="p-1.5 text-gray-300 hover:text-gray-600 rounded"
                            title="Edit question"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDeleteModal(true)}
                            className="p-1.5 text-gray-300 hover:text-red-400 rounded"
                            title="Delete question"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            {hasExpandedRef.current && (
                <div className={isExpanded ? 'px-4 sm:px-6 pb-4 sm:pb-6 space-y-2' : 'hidden'}>
                    {question.options.map((option) => (
                        <OptionSection
                            key={option.id}
                            option={option}
                            people={people}
                            sectionDefaultLabel={defaultCategoryFor(question, option)}
                            allItemNames={allItemNames}
                            sectionNames={sectionNames}
                            questionId={question.id}
                            suggestions={suggestions}
                            onEdit={() => onEditOption(question.id, option)}
                            onDelete={() => onDeleteOption(question.id, option.id)}
                            onItemChange={onItemChange}
                            onItemAdd={onItemAdd}
                            onItemDelete={onItemDelete}
                            onSectionAdd={onSectionAdd}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => onAddOption(question.id)}
                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                        + Add Option
                    </button>
                </div>
            )}
            {showDeleteModal && (
                <DeleteConfirmModal
                    onConfirm={() => { handleDelete(); setShowDeleteModal(false) }}
                    onCancel={() => setShowDeleteModal(false)}
                />
            )}
        </div>
    )
})

const AlwaysSection = memo(function AlwaysSection({ items, people, emptySections, allItemNames, sectionNames, suggestions, onEdit, onItemChange, onItemAdd, onItemDelete, onSectionAdd }: {
    items: Item[]
    people: Person[]
    emptySections?: string[]
    allItemNames: string[]
    sectionNames: string[]
    suggestions: SuggestionIndex
    onEdit: () => void
    onItemChange: (index: number, edited: Item) => void
    onItemAdd: (text: string, category: string | undefined) => void
    onItemDelete: (index: number) => void
    onSectionAdd: (label: string) => void
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const adding = useMemo<ItemAdding>(
        () => ({ suggestions, ownerKey: ALWAYS_LIST_KEY, onAdd: onItemAdd }),
        [suggestions, onItemAdd])
    // Same lazy-mount-then-keep pattern as the sections above.
    const hasExpandedRef = useRef(isExpanded)
    if (isExpanded) hasExpandedRef.current = true
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center">
                <button
                    type="button"
                    onClick={() => setIsExpanded(e => !e)}
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                >
                    <svg
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-900">Always Needed Items</span>
                        <span className="hidden sm:inline text-sm font-normal text-gray-500">{items.length} items</span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={onEdit}
                    className="p-4 -m-2 text-gray-300 hover:text-gray-600 rounded flex-shrink-0"
                    title="Edit always needed items"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
            {hasExpandedRef.current && (
                <div className={`mt-3${isExpanded ? '' : ' hidden'}`}>
                    <SectionedItemRows
                        items={items}
                        people={people}
                        defaultLabel={ALWAYS_NEEDED_CATEGORY}
                        emptySections={emptySections}
                        allItemNames={allItemNames}
                        sectionNames={sectionNames}
                        adding={adding}
                        onItemChange={onItemChange}
                        onItemDelete={onItemDelete}
                        onSectionAdd={onSectionAdd}
                    />
                </div>
            )}
        </div>
    )
})

function useItemListState(initialItems: Item[], people: Person[]) {
    const [items, setItems] = useState<Item[]>(initialItems)
    const scrollRef = useRef<HTMLDivElement>(null)
    const prevCountRef = useRef(initialItems.length)

    useEffect(() => {
        if (items.length > prevCountRef.current) {
            requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
            })
        }
        prevCountRef.current = items.length
    }, [items.length])

    // All handlers are useCallback'd so the memoized per-item rows only
    // re-render when their own item changes, not on every keystroke or toggle.
    const updateItemText = useCallback((idx: number, text: string) =>
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, text } : item)), [])

    const togglePerson = useCallback((itemIdx: number, personIdx: number) =>
        setItems(prev => prev.map((item, i) => {
            if (i !== itemIdx) return item
            const selections = people.map((p, pi) => ({
                personId: p.id,
                selected: item.personSelections?.[pi]?.selected ?? false,
            }))
            selections[personIdx] = { ...selections[personIdx], selected: !selections[personIdx].selected }
            return { ...item, personSelections: selections }
        })), [people])

    const toggleCommunal = useCallback((itemIdx: number) =>
        setItems(prev => prev.map((item, i) =>
            i === itemIdx ? { ...item, communal: item.communal ? undefined : true } : item
        )), [])

    const updatePerNight = useCallback((itemIdx: number, perNight: number | undefined) =>
        setItems(prev => prev.map((item, i) =>
            i === itemIdx ? { ...item, perNight } : item
        )), [])

    const updatePerNights = useCallback((itemIdx: number, perNights: number | undefined) =>
        setItems(prev => prev.map((item, i) =>
            i === itemIdx ? { ...item, perNights } : item
        )), [])

    const updateMaxQuantity = useCallback((itemIdx: number, maxQuantity: number | undefined) =>
        setItems(prev => prev.map((item, i) =>
            i === itemIdx ? { ...item, maxQuantity } : item
        )), [])

    const removeItem = useCallback((idx: number) =>
        setItems(prev => prev.filter((_, i) => i !== idx)), [])

    const moveItem = useCallback((idx: number, direction: 'up' | 'down') =>
        setItems(prev => {
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1
            if (swapIdx < 0 || swapIdx >= prev.length) return prev
            const next = [...prev]
            ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
            return next
        }), [])

    // Pull the item at `from` out and reinsert it at `to` — used by drag to
    // reorder; up/down buttons stay as the discrete, keyboard-friendly path.
    const reorderItem = useCallback((from: number, to: number) =>
        setItems(prev => {
            if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
            const next = [...prev]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return next
        }), [])

    // The new row inherits the last item's section so it appears at the bottom,
    // next to the button that made it. Without this an uncategorised item falls
    // into the default section, which `buildSectionSequence` puts first — so in
    // a fully sectioned list the row would appear at the very top instead.
    const addItem = useCallback(() =>
        setItems(prev => [...prev, {
            text: '',
            ...(prev.length > 0 && prev[prev.length - 1].category !== undefined
                ? { category: prev[prev.length - 1].category }
                : {}),
            personSelections: people.map(p => ({ personId: p.id, selected: true })),
        }]), [people])

    // Whole-list replacement, used when a sectioned drag re-stamps categories
    // and reorders in one go (see applySectionLayout).
    const replaceItems = useCallback((next: Item[]) => setItems(next), [])

    return { items, scrollRef, updateItemText, togglePerson, toggleCommunal, updatePerNight, updatePerNights, updateMaxQuantity, removeItem, moveItem, reorderItem, addItem, replaceItems }
}

// One editable item row. Memoized (with stable handlers from useItemListState)
// so toggling a person or typing in one row doesn't re-render every other row —
// with dozens of items and a large family that re-render is what made the
// editor modals feel sluggish on phones. Renders only the variant for the
// current form factor instead of both (CSS-hidden DOM is still DOM).
const ItemEditorRow = memo(function ItemEditorRow({ item, itemIdx, people, allItemNames, isDesktop, quantityOpen, onToggleQuantity, updateItemText, togglePerson, toggleCommunal, updatePerNight, updatePerNights, updateMaxQuantity, removeItem }: {
    item: Item
    itemIdx: number
    people: Person[]
    allItemNames: string[]
    isDesktop: boolean
    quantityOpen: boolean
    onToggleQuantity: (idx: number) => void
    updateItemText: (idx: number, text: string) => void
    togglePerson: (itemIdx: number, personIdx: number) => void
    toggleCommunal: (itemIdx: number) => void
    updatePerNight: (itemIdx: number, perNight: number | undefined) => void
    updatePerNights: (itemIdx: number, perNights: number | undefined) => void
    updateMaxQuantity: (itemIdx: number, maxQuantity: number | undefined) => void
    removeItem: (idx: number) => void
}) {
    const isCommunal = item.communal === true
    const hasRate = item.perNight !== undefined
    return (
        // content-visibility lets the browser skip layout/paint for rows that
        // are scrolled out of view — noticeable when a list has dozens of items.
        <div
            className="sm:flex sm:flex-wrap sm:items-center sm:gap-2 rounded-lg border border-gray-200 sm:border-transparent p-2 sm:p-0"
            style={{ contentVisibility: 'auto', containIntrinsicSize: isDesktop ? 'auto 44px' : 'auto 132px' }}
        >
            {/* Item name + desktop people + remove */}
            <div className="flex items-center gap-2 sm:flex-1 sm:min-w-0">
                <div className="flex-1 min-w-0">
                    <CustomCreatableSelect
                        value={item.text}
                        onChange={val => updateItemText(itemIdx, val)}
                        options={allItemNames}
                        placeholder="Item name"
                        menuPortalTarget={document.body}
                    />
                </div>
                {/* Desktop: shared toggle + inline avatars */}
                {isDesktop && (
                    <PersonToggles
                        item={item}
                        people={people}
                        layout="avatars"
                        onTogglePerson={personIdx => togglePerson(itemIdx, personIdx)}
                        onToggleCommunal={() => toggleCommunal(itemIdx)}
                    />
                )}
                <button
                    type="button"
                    onClick={() => onToggleQuantity(itemIdx)}
                    title={quantityTitle(item)}
                    aria-label={`Set suggested quantity for ${item.text || 'item'}`}
                    aria-expanded={quantityOpen}
                    className={`inline-flex items-center justify-center h-5 rounded-full px-1.5 text-[10px] font-medium shrink-0 transition-colors ${hasRate ? 'bg-emerald-600 text-white' : AVATAR_OFF}`}
                >
                    {hasRate ? rateBadge(item) : '×n'}
                </button>
                <button
                    type="button"
                    onClick={() => removeItem(itemIdx)}
                    className="shrink-0 text-gray-300 hover:text-red-400 text-xl leading-none"
                    title="Remove item"
                >
                    ×
                </button>
            </div>
            {/* Mobile: shared toggle + people on their own row as large labelled tiles */}
            {!isDesktop && (
                <div className="mt-2">
                    <PersonToggles
                        item={item}
                        people={people}
                        layout="tiles"
                        onTogglePerson={personIdx => togglePerson(itemIdx, personIdx)}
                        onToggleCommunal={() => toggleCommunal(itemIdx)}
                    />
                </div>
            )}
            {!isDesktop && isCommunal && people.length > 1 && (
                <div className="mt-1 text-[11px] text-blue-600 px-1">
                    Packed once for the group — included when a highlighted person is going
                </div>
            )}
            {quantityOpen && (
                <div className="mt-2 sm:mt-0 w-full">
                    <QuantityPanel
                        item={item}
                        onPerNight={value => updatePerNight(itemIdx, value)}
                        onPerNights={value => updatePerNights(itemIdx, value)}
                        onMaxQuantity={value => updateMaxQuantity(itemIdx, value)}
                    />
                </div>
            )}
        </div>
    )
})

function ItemListEditor({ items, people, allItemNames, scrollRef, sectionDefaultLabel, suggestedSectionNames, updateItemText, togglePerson, toggleCommunal, updatePerNight, updatePerNights, updateMaxQuantity, removeItem, addItem, replaceItems }: {
    items: Item[]
    people: Person[]
    allItemNames: string[]
    scrollRef: React.RefObject<HTMLDivElement | null>
    /** What the packing list will call items that carry no category of their own. */
    sectionDefaultLabel: string
    suggestedSectionNames: string[]
    updateItemText: (idx: number, text: string) => void
    togglePerson: (itemIdx: number, personIdx: number) => void
    toggleCommunal: (itemIdx: number) => void
    updatePerNight: (itemIdx: number, perNight: number | undefined) => void
    updatePerNights: (itemIdx: number, perNights: number | undefined) => void
    updateMaxQuantity: (itemIdx: number, maxQuantity: number | undefined) => void
    removeItem: (idx: number) => void
    addItem: () => void
    replaceItems: (items: Item[]) => void
}) {
    const [openQuantityIdx, setOpenQuantityIdx] = useState<number | null>(null)
    const [reorderMode, setReorderMode] = useState(false)
    const isDesktop = useIsDesktop()
    const toggleQuantity = useCallback((idx: number) =>
        setOpenQuantityIdx(prev => prev === idx ? null : idx), [])
    // Reorder mode only makes sense with something to reorder; if there aren't
    // at least two items the toggle is hidden and we render the normal editor.
    const canReorder = items.length > 1
    const inReorder = reorderMode && canReorder

    // Normal editing mode shows the same section cards as the read-only list on
    // the page behind, so the editor always previews how the packing list will
    // group these items — and the same section is the same colour in both.
    const groups = useMemo(() => buildSectionGroups(items, sectionDefaultLabel), [items, sectionDefaultLabel])

    // Only worth drawing the cards once the list is actually split.
    const hasSections = groups.length > 1

    const renderRow = (entry: PositionedItem) => (
        <ItemEditorRow
            key={`item-${entry.index}`}
            item={entry.item}
            itemIdx={entry.index}
            people={people}
            allItemNames={allItemNames}
            isDesktop={isDesktop}
            quantityOpen={openQuantityIdx === entry.index}
            onToggleQuantity={toggleQuantity}
            updateItemText={updateItemText}
            togglePerson={togglePerson}
            toggleCommunal={toggleCommunal}
            updatePerNight={updatePerNight}
            updatePerNights={updatePerNights}
            updateMaxQuantity={updateMaxQuantity}
            removeItem={removeItem}
        />
    )

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
            {items.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Items</div>
                    {canReorder && (
                        <button
                            type="button"
                            onClick={() => setReorderMode(m => !m)}
                            aria-pressed={reorderMode}
                            className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${reorderMode ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-50'}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                            {reorderMode ? 'Finish organising' : 'Organise items'}
                        </button>
                    )}
                </div>
            )}
            {inReorder && (
                <div className="space-y-2">
                    <SectionedItemReorder
                        items={items}
                        defaultLabel={sectionDefaultLabel}
                        suggestedSectionNames={suggestedSectionNames}
                        scrollRef={scrollRef}
                        onChange={replaceItems}
                    />
                </div>
            )}
            {!inReorder && !hasSections && (
                <div className="space-y-2">
                    {groups.flatMap(group => group.entries).map(renderRow)}
                </div>
            )}
            {!inReorder && hasSections && (
                <div className="space-y-3">
                    {groups.map(group => {
                        const accent = sectionAccent(group.label, group.label === sectionDefaultLabel)
                        return (
                            <div
                                key={`section-${group.label}`}
                                data-testid="editor-item-section"
                                className={`rounded-lg border ${accent.border} overflow-hidden`}
                            >
                                <div className={`flex items-center gap-2 px-3 py-2 ${accent.header}`}>
                                    <span className={`text-sm font-semibold ${accent.text} truncate`}>
                                        {group.label}
                                    </span>
                                    <span className={`ml-auto shrink-0 text-[11px] font-medium ${accent.muted}`}>
                                        {group.entries.length} item{group.entries.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="p-2 space-y-2">{group.entries.map(renderRow)}</div>
                            </div>
                        )
                    })}
                </div>
            )}
            {!inReorder && (
                <button
                    type="button"
                    onClick={addItem}
                    className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                >
                    + Add Item
                </button>
            )}
        </div>
    )
}

// Lock background page scroll while a modal is open. Besides being correct
// modal behaviour, on mobile it keeps the page — and the browser's URL bar —
// from moving while a drag is happening inside the modal, which was the source
// of the touch-drag jank (dnd-kit's own auto-scroll is already confined to the
// item list; this stops the window scrolling underneath it).
function useBodyScrollLock() {
    useEffect(() => {
        const body = document.body
        const html = document.documentElement
        const prev = { body: body.style.overflow, html: html.style.overflow, overscroll: body.style.overscrollBehavior }
        // Lock both — the scrolling element is <body> on some browsers and
        // <html> on others (notably mobile) — and stop scroll chaining.
        body.style.overflow = 'hidden'
        html.style.overflow = 'hidden'
        body.style.overscrollBehavior = 'none'
        return () => {
            body.style.overflow = prev.body
            html.style.overflow = prev.html
            body.style.overscrollBehavior = prev.overscroll
        }
    }, [])
}

function OptionEditModal({ option, question, people, allItemNames, suggestedSectionNames, onSave, onClose }: {
    option: Option | null
    question: Question | undefined
    people: Person[]
    allItemNames: string[]
    suggestedSectionNames: string[]
    onSave: (updated: Option) => void
    onClose: () => void
}) {
    useBodyScrollLock()
    const [text, setText] = useState(option?.text ?? '')
    const { items, scrollRef, updateItemText, togglePerson, toggleCommunal, updatePerNight, updatePerNights, updateMaxQuantity, removeItem, addItem, replaceItems } = useItemListState(option?.items ?? [], people)

    // Tracks the option text as it's typed, so the default section heading shows
    // the name the generated list will actually use.
    const sectionDefaultLabel = question
        ? defaultCategoryFor(question, { id: option?.id ?? '', text, order: option?.order ?? 0, items: [] })
        : text

    const handleSave = () => onSave({
        id: option?.id ?? crypto.randomUUID(),
        order: option?.order ?? 0,
        text: text.trim(),
        items: renumberItemOrder(items, new Date().toISOString()),
    })

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">
                        {option ? 'Edit Option' : 'Add Option'}
                    </h2>
                    <input
                        autoFocus
                        type="text"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Option text (e.g. Yes)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        onKeyDown={e => { if (e.key === 'Enter') addItem() }}
                    />
                    {people.length > 1 && (
                        <div className="flex items-center gap-3 flex-wrap mt-3">
                            {people.map((person, i) => (
                                <span key={person.id} className="flex items-center gap-1 text-xs text-gray-400">
                                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${AVATAR_ON[i % AVATAR_ON.length]}`}>
                                        {person.name.charAt(0).toUpperCase()}
                                    </span>
                                    {person.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <ItemListEditor
                    items={items} people={people} allItemNames={allItemNames}
                    scrollRef={scrollRef} updateItemText={updateItemText}
                    sectionDefaultLabel={sectionDefaultLabel} suggestedSectionNames={suggestedSectionNames}
                    togglePerson={togglePerson} toggleCommunal={toggleCommunal}
                    updatePerNight={updatePerNight} updatePerNights={updatePerNights} updateMaxQuantity={updateMaxQuantity}
                    removeItem={removeItem} addItem={addItem} replaceItems={replaceItems}
                />
                <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-2 justify-end">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        {option ? 'Save changes' : 'Add option'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function AlwaysNeededModal({ initialItems, people, allItemNames, suggestedSectionNames, onSave, onClose }: {
    initialItems: Item[]
    people: Person[]
    allItemNames: string[]
    suggestedSectionNames: string[]
    onSave: (items: Item[]) => void
    onClose: () => void
}) {
    useBodyScrollLock()
    const { items, scrollRef, updateItemText, togglePerson, toggleCommunal, updatePerNight, updatePerNights, updateMaxQuantity, removeItem, addItem, replaceItems } = useItemListState(initialItems, people)

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900">Always Needed Items</h2>
                    {people.length > 1 && (
                        <div className="flex items-center gap-3 flex-wrap mt-2">
                            {people.map((person, i) => (
                                <span key={person.id} className="flex items-center gap-1 text-xs text-gray-400">
                                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${AVATAR_ON[i % AVATAR_ON.length]}`}>
                                        {person.name.charAt(0).toUpperCase()}
                                    </span>
                                    {person.name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <ItemListEditor
                    items={items} people={people} allItemNames={allItemNames}
                    scrollRef={scrollRef} updateItemText={updateItemText}
                    sectionDefaultLabel={ALWAYS_NEEDED_CATEGORY} suggestedSectionNames={suggestedSectionNames}
                    togglePerson={togglePerson} toggleCommunal={toggleCommunal}
                    updatePerNight={updatePerNight} updatePerNights={updatePerNights} updateMaxQuantity={updateMaxQuantity}
                    removeItem={removeItem} addItem={addItem} replaceItems={replaceItems}
                />
                <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-2 justify-end">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                        Cancel
                    </button>
                    <button type="button" onClick={() => onSave(renumberItemOrder(items, new Date().toISOString()))} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        Save changes
                    </button>
                </div>
            </div>
        </div>
    )
}

function PeopleModal({ people, onSave, onClose }: {
    people: Person[]
    onSave: (newPeople: Person[]) => void
    onClose: () => void
}) {
    const [localPeople, setLocalPeople] = useState<Person[]>(
        people.length > 0 ? people : [{ id: crypto.randomUUID(), name: '' }]
    )

    const addPerson = () => setLocalPeople(prev => [...prev, { id: crypto.randomUUID(), name: '' }])
    const removePerson = (idx: number) => {
        if (localPeople.length <= 1) return
        setLocalPeople(prev => prev.filter((_, i) => i !== idx))
    }
    const updateName = (idx: number, name: string) =>
        setLocalPeople(prev => prev.map((p, i) => i === idx ? { ...p, name } : p))
    const updateDob = (idx: number, dateOfBirth: string) =>
        setLocalPeople(prev => prev.map((p, i) => i === idx
            ? { ...p, dateOfBirth: dateOfBirth || undefined }
            : p))
    const updateAgeRange = (idx: number, value: string) =>
        setLocalPeople(prev => prev.map((p, i) => i === idx
            ? { ...p, ageRange: value === '' ? undefined : value as Person['ageRange'] }
            : p))

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit People</h2>
                    <div className="space-y-2 mb-3">
                        {localPeople.map((person, i) => (
                            <div key={person.id}>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${AVATAR_ON[i % AVATAR_ON.length]}`}>
                                        {person.name.charAt(0).toUpperCase() || '?'}
                                    </span>
                                    <input
                                        autoFocus={i === 0}
                                        type="text"
                                        value={person.name}
                                        onChange={e => updateName(i, e.target.value)}
                                        placeholder={`Person ${i + 1}`}
                                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        onKeyDown={e => { if (e.key === 'Enter') addPerson() }}
                                    />
                                    {localPeople.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePerson(i)}
                                            className="text-gray-300 hover:text-red-400 text-xl leading-none shrink-0"
                                            title="Remove person"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                {!person.species && (
                                    <div className="ml-9 mt-1 flex items-center gap-2">
                                        <input
                                            type="date"
                                            aria-label={`Birthday for ${person.name || `Person ${i + 1}`} (optional)`}
                                            title="Birthday (optional) — used to keep age-based items up to date"
                                            value={person.dateOfBirth ?? ''}
                                            onChange={e => updateDob(i, e.target.value)}
                                            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                        <select
                                            aria-label={`Age group for ${person.name || `Person ${i + 1}`}`}
                                            title="Age group — change it manually if they're ready for the next one early"
                                            value={person.ageRange ?? ''}
                                            onChange={e => updateAgeRange(i, e.target.value)}
                                            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="">Age group…</option>
                                            {AGE_RANGE_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Birthdays are optional — add one and we'll suggest packing-item updates as they grow. You can also bump the age group early if they're ready for it.</p>
                    <button
                        type="button"
                        onClick={addPerson}
                        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors mb-4"
                    >
                        + Add Person
                    </button>
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">
                            Cancel
                        </button>
                        <button type="button" onClick={() => onSave(localPeople)} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function reconcileItems(items: Item[], oldPeople: Person[], newPeople: Person[]): Item[] {
    return items.map(item => ({
        ...item,
        personSelections: newPeople.map(person => {
            const oldIdx = oldPeople.findIndex(p => p.id === person.id)
            const selected = oldIdx >= 0
                ? (item.personSelections?.[oldIdx]?.selected ?? true)
                : true
            return { personId: person.id, selected }
        }),
    }))
}

function QuestionModal({ question, onSave, onClose }: {
    question: Question | null
    onSave: (text: string, type: QuestionType) => void
    onClose: () => void
}) {
    const [text, setText] = useState(question?.text ?? '')
    const [type, setType] = useState<QuestionType>(question?.questionType ?? 'single-choice')

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {question ? 'Edit Question' : 'Add Question'}
                    </h2>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question text</label>
                    <input
                        autoFocus
                        type="text"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="e.g. Are you going to a hot climate?"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) onSave(text.trim(), type) }}
                    />
                    <label className="block text-sm font-medium text-gray-700 mb-2">Answer type</label>
                    <div className="flex gap-2 mb-5">
                        {(['single-choice', 'multiple-choice'] as QuestionType[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`flex-1 py-2 rounded-lg text-sm border-2 transition-colors ${type === t ? 'border-primary-400 bg-primary-50 text-primary-900 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                                {t === 'single-choice' ? 'Single choice' : 'Multiple choice'}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => onSave(text.trim(), type)}
                            disabled={!text.trim()}
                            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {question ? 'Save changes' : 'Add question'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function QuestionsPage() {
    const { db, loginSyncInProgress } = useDatabase()
    const { isLoggedIn } = useSolidPod()
    const foreignPodCtx = useForeignPod()
    const foreignPodUrl = foreignPodCtx?.foreignPodUrl
    const isForeign = !!foreignPodUrl

    const [data, setData] = useState<PackingListQuestionSet | null>(null)
    // Render-time snapshot of `data` so section handlers can read the latest
    // value without depending on it — keeps their identity stable across data
    // changes, which is what lets the memoized QuestionSections skip renders.
    const dataRef = useRef<PackingListQuestionSet | null>(null)
    dataRef.current = data
    const [rev, setRev] = useState<string | undefined>(undefined)
    const [error, setError] = useState<string | null>(null)
    const [questionModal, setQuestionModal] = useState<{ question: Question | null } | null>(null)
    const [optionModal, setOptionModal] = useState<{ questionId: string; option: Option | null } | null>(null)
    const [peopleModal, setPeopleModal] = useState(false)
    const [alwaysModal, setAlwaysModal] = useState(false)
    // Bracket changes made by hand in the people modal; offered the same
    // item-review flow as birthday-driven transitions, then cleared.
    const [manualPromotions, setManualPromotions] = useState<AgeTransition[]>([])

    const saveToPodRef = useRef<((data: PackingListQuestionSet) => Promise<boolean>) | undefined>(undefined)

    const { saveWithSyncPrevention, handleSyncSuccess, handleSyncError } = useSyncCoordinator<PackingListQuestionSet>({
        currentData: data,
        saveToLocalDb: async (d) => db.saveQuestionSet({ _id: '1', ...d, _rev: rev }),
        updateFormAndState: (d, newRev) => {
            setRev(newRev)
            setData({ ...d, _rev: newRev })
        },
        conflictStrategy: 'fallback-to-pod',
        mergeFunction: mergeQuestionSets,
        saveToPod: saveToPodRef.current,
    })

    const { saveToPod } = usePodSync<PackingListQuestionSet>({
        pathConfig: { container: POD_CONTAINERS.ROOT, filename: 'packing-list-questions.ttl', podUrl: foreignPodUrl },
        rdf: { serialize: questionSetToDataset, deserialize: datasetToQuestionSet },
        pollInterval: 5000,
        enabled: isLoggedIn || isForeign,
        onSyncSuccess: handleSyncSuccess,
        onSyncError: handleSyncError,
    })

    // Keep saveToPodRef in sync so useSyncCoordinator can push merge results back to pod
    useEffect(() => { saveToPodRef.current = saveToPod }, [saveToPod])

    useEffect(() => {
        if (loginSyncInProgress) return
        const load = async () => {
            try {
                const migration = await DatabaseMigration.checkMigrationNeeded(db)
                if (migration.needed) await DatabaseMigration.performMigration(db)
                const d = await db.getQuestionSet()
                setData(d)
                setRev(d._rev)
            } catch (err: unknown) {
                if (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'not_found') {
                    setData({ _id: '1', questions: [], people: [], alwaysNeededItems: [] })
                } else {
                    setError(String(err))
                }
            }
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loginSyncInProgress])

    const saveData = useCallback(async (updated: PackingListQuestionSet) => {
        const previous = dataRef.current
        setData(updated)
        const saved = await saveWithSyncPrevention(updated, saveToPod)
        if (saved) setData(saved)
        else setData(previous)
    }, [saveWithSyncPrevention, saveToPod])

    const handleQuestionModalSave = useCallback(async (text: string, type: QuestionType) => {
        if (!data || questionModal === null) return
        const questions = data.questions ?? []
        const now = new Date().toISOString()
        let newQuestions: Question[]
        if (questionModal.question) {
            newQuestions = questions.map(q =>
                q.id === questionModal.question!.id ? { ...q, text, questionType: type, lastModified: now } : q
            )
        } else {
            const maxOrder = questions.reduce((max, q) => Math.max(max, q.order), -1)
            newQuestions = [...questions, { ...newDraftQuestion(maxOrder + 1), text, questionType: type, lastModified: now }]
        }
        setQuestionModal(null)
        await saveData({ ...data, questions: newQuestions })
    }, [data, questionModal, saveData])

    const handleDeleteQuestion = useCallback(async (id: string) => {
        const data = dataRef.current
        if (!data) return
        const now = new Date().toISOString()
        await saveData({
            ...data,
            questions: data.questions.map(q => q.id === id ? { ...q, deletedAt: now } : q),
        })
    }, [saveData])

    const handleMoveQuestion = useCallback(async (id: string, direction: 'up' | 'down') => {
        const data = dataRef.current
        if (!data) return
        const active = data.questions.filter(q => !q.deletedAt)
        const idx = active.findIndex(q => q.id === id)
        if (idx < 0) return
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= active.length) return
        const newActive = [...active]
        ;[newActive[idx], newActive[swapIdx]] = [newActive[swapIdx], newActive[idx]]
        // Renumber order to match the new positions and stamp lastModified on
        // moved questions, so the reorder survives pod round-trips (deserialize
        // sorts by order) and wins per-question LWW during sync merges.
        const now = new Date().toISOString()
        const renumbered = newActive.map((q, i) =>
            q.order === i ? q : { ...q, order: i, lastModified: now }
        )
        // Rebuild full questions array preserving deleted ones
        const deletedQuestions = data.questions.filter(q => q.deletedAt)
        await saveData({ ...data, questions: [...renumbered, ...deletedQuestions] })
    }, [saveData])

    const handleOptionModalSave = useCallback(async (updatedOption: Option) => {
        if (!data || optionModal === null) return
        const newQuestions = withQuestionOptions(data.questions, optionModal.questionId, options => {
            if (optionModal.option) {
                return options.map(o => o.id === optionModal.option!.id ? updatedOption : o)
            }
            const maxOrder = options.reduce((max, o) => Math.max(max, o.order), -1)
            return [...options, { ...updatedOption, order: maxOrder + 1 }]
        }, new Date().toISOString())
        setOptionModal(null)
        await saveData({ ...data, questions: newQuestions })
    }, [data, optionModal, saveData])

    // An edit made inline on one item, rather than through the option's modal.
    // The whole option is still what gets written — the question set is a single
    // document — but only the edited item changes, so every other row keeps its
    // identity and skips re-rendering.
    const handleOptionItemChange = useCallback(async (questionId: string, optionId: string, index: number, edited: Item) => {
        const data = dataRef.current
        if (!data) return
        const question = data.questions.find(q => q.id === questionId)
        const option = question?.options.find(o => o.id === optionId)
        if (!question || !option) return
        const now = new Date().toISOString()
        const items = applyItemEdit(option.items, index, edited, defaultCategoryFor(question, option), now)
        await saveData({
            ...data,
            questions: withQuestionOptions(data.questions, questionId, options =>
                options.map(o => o.id === optionId
                    ? withEmptySections({ ...o, items }, reconcileEmptySections(o.items, items, o.emptySections))
                    : o), now),
        })
    }, [saveData])

    // A new item goes to everyone on the list, which is what the editor modal's
    // "+ Add Item" has always done. Who it's for and how many are a tap away in
    // the row it just landed in, so the composer doesn't have to ask.
    const newItem = useCallback((text: string): Item => ({
        id: crypto.randomUUID(),
        text,
        personSelections: (dataRef.current?.people ?? [])
            .filter(person => !person.deletedAt)
            .map(person => ({ personId: person.id, selected: true })),
    }), [])

    const handleOptionItemAdd = useCallback(async (questionId: string, optionId: string, text: string, category: string | undefined) => {
        const data = dataRef.current
        if (!data) return
        const question = data.questions.find(q => q.id === questionId)
        const option = question?.options.find(o => o.id === optionId)
        if (!question || !option) return
        const now = new Date().toISOString()
        const items = appendItemToSection(option.items, newItem(text), category, defaultCategoryFor(question, option), now)
        await saveData({
            ...data,
            questions: withQuestionOptions(data.questions, questionId, options =>
                options.map(o => o.id === optionId
                    ? withEmptySections({ ...o, items }, reconcileEmptySections(o.items, items, o.emptySections))
                    : o), now),
        })
    }, [saveData, newItem])

    const handleAlwaysItemAdd = useCallback(async (text: string, category: string | undefined) => {
        const data = dataRef.current
        if (!data) return
        const stored = data.alwaysNeededItems ?? []
        // Same split as handleAlwaysItemChange: the rows show the active items, so
        // that is the list being added to, and the tombstones ride along untouched.
        const active = stored.filter(i => !i.deletedAt)
        const deleted = stored.filter(i => i.deletedAt)
        const now = new Date().toISOString()
        const items = appendItemToSection(active, newItem(text), category, ALWAYS_NEEDED_CATEGORY, now)
        await saveData({
            ...data,
            alwaysNeededItems: [...items, ...deleted],
            alwaysNeededEmptySections: reconcileEmptySections(active, items, data.alwaysNeededEmptySections),
        })
    }, [saveData, newItem])

    // An option's items are merged whole-question, so a delete here can simply
    // remove the row — there is no per-item merge to resurrect it, which is why
    // this needs no tombstone where the always-needed list below does.
    const handleOptionItemDelete = useCallback(async (questionId: string, optionId: string, index: number) => {
        const data = dataRef.current
        if (!data) return
        const question = data.questions.find(q => q.id === questionId)
        const option = question?.options.find(o => o.id === optionId)
        if (!question || !option || !option.items[index]) return
        const now = new Date().toISOString()
        const items = renumberItemOrder(option.items.filter((_, i) => i !== index), now)
        await saveData({
            ...data,
            questions: withQuestionOptions(data.questions, questionId, options =>
                options.map(o => o.id === optionId
                    ? withEmptySections({ ...o, items }, reconcileEmptySections(o.items, items, o.emptySections))
                    : o), now),
        })
    }, [saveData])

    // Creating a section stores nothing but its name — there is nothing else to
    // store until something is in it, and `addEmptySection` refuses a name that
    // already exists rather than making a second section wearing it.
    const handleOptionSectionAdd = useCallback(async (questionId: string, optionId: string, label: string) => {
        const data = dataRef.current
        if (!data) return
        const question = data.questions.find(q => q.id === questionId)
        const option = question?.options.find(o => o.id === optionId)
        if (!question || !option) return
        const now = new Date().toISOString()
        const emptySections = addEmptySection(
            option.emptySections, option.items, label, defaultCategoryFor(question, option))
        if (emptySections === option.emptySections) return
        await saveData({
            ...data,
            questions: withQuestionOptions(data.questions, questionId, options =>
                options.map(o => o.id === optionId ? withEmptySections(o, emptySections) : o), now),
        })
    }, [saveData])

    const handleAlwaysSectionAdd = useCallback(async (label: string) => {
        const data = dataRef.current
        if (!data) return
        const active = (data.alwaysNeededItems ?? []).filter(i => !i.deletedAt)
        const emptySections = addEmptySection(
            data.alwaysNeededEmptySections, active, label, ALWAYS_NEEDED_CATEGORY)
        if (emptySections === data.alwaysNeededEmptySections) return
        await saveData({ ...data, alwaysNeededEmptySections: emptySections })
    }, [saveData])

    const handleAlwaysItemDelete = useCallback(async (index: number) => {
        const data = dataRef.current
        if (!data) return
        const stored = data.alwaysNeededItems ?? []
        const active = stored.filter(i => !i.deletedAt)
        if (!active[index]) return
        const now = new Date().toISOString()
        // Tombstoned, not dropped: always-needed items merge per id, so an item
        // that simply vanished from this side would come back from the pod.
        const kept = renumberItemOrder(active.filter((_, i) => i !== index), now)
        const items = tombstoneRemovedItems(stored, kept, now)
        await saveData({
            ...data,
            alwaysNeededItems: items,
            alwaysNeededEmptySections: reconcileEmptySections(active, kept, data.alwaysNeededEmptySections),
        })
    }, [saveData])

    const handleAlwaysItemChange = useCallback(async (index: number, edited: Item) => {
        const data = dataRef.current
        if (!data) return
        const stored = data.alwaysNeededItems ?? []
        // The rows render the active items only, so that is what the index
        // addresses; the tombstones are carried through untouched so a delete
        // made on another device still propagates.
        const active = stored.filter(i => !i.deletedAt)
        const deleted = stored.filter(i => i.deletedAt)
        const now = new Date().toISOString()
        const items = applyItemEdit(active, index, edited, ALWAYS_NEEDED_CATEGORY, now)
        await saveData({
            ...data,
            alwaysNeededItems: [...items, ...deleted],
            alwaysNeededEmptySections: reconcileEmptySections(active, items, data.alwaysNeededEmptySections),
        })
    }, [saveData])

    // The modal is handed the active items only, so anything it hands back
    // missing was deleted in it — and the tombstones it never saw have to be put
    // back. Saving its list verbatim did neither, which meant a delete made here
    // came straight back on the next pod merge; see `tombstoneRemovedItems`.
    const handleAlwaysSave = useCallback(async (newItems: Item[]) => {
        if (!data) return
        setAlwaysModal(false)
        await saveData({
            ...data,
            alwaysNeededItems: tombstoneRemovedItems(data.alwaysNeededItems ?? [], newItems, new Date().toISOString()),
        })
    }, [data, saveData])

    const handlePeopleSave = useCallback(async (newPeople: Person[]) => {
        if (!data) return
        const oldPeople = data.people ?? []
        const oldPeopleMap = new Map(oldPeople.map(p => [p.id, p]))
        const newPeopleIds = new Set(newPeople.map(p => p.id))
        const now = new Date().toISOString()

        // Stamp lastModified on new or changed people
        const stamped: Person[] = newPeople.map(p => {
            const existing = oldPeopleMap.get(p.id)
            const changed = !existing || existing.name !== p.name ||
                existing.ageRange !== p.ageRange || existing.gender !== p.gender ||
                existing.dateOfBirth !== p.dateOfBirth
            return changed ? { ...p, lastModified: now } : p
        })

        // Mark removed people as deleted; preserve previously-deleted people
        const previouslyDeleted = oldPeople.filter(p => p.deletedAt)
        const nowDeleted = oldPeople
            .filter(p => !p.deletedAt && !newPeopleIds.has(p.id))
            .map(p => ({ ...p, deletedAt: now }))
        const allPeople = [...stamped, ...nowDeleted, ...previouslyDeleted]

        const manual: AgeTransition[] = stamped
            .filter(p => !p.species && p.ageRange)
            .flatMap(p => {
                const oldRange = oldPeopleMap.get(p.id)?.ageRange
                return oldPeopleMap.has(p.id) && oldRange !== p.ageRange
                    ? [{ person: p, from: oldRange, to: p.ageRange! }]
                    : []
            })
        setManualPromotions(manual)

        const reconcile = (items: Item[]) => reconcileItems(items, oldPeople.filter(p => !p.deletedAt), stamped)
        const newData: PackingListQuestionSet = {
            ...data,
            people: allPeople,
            alwaysNeededItems: reconcile(data.alwaysNeededItems ?? []),
            questions: data.questions.map(q => ({
                ...q,
                options: q.options.map(o => ({ ...o, items: reconcile(o.items) }))
            }))
        }
        setPeopleModal(false)
        await saveData(newData)
    }, [data, saveData])

    const handleDeleteOption = useCallback(async (questionId: string, optionId: string) => {
        const data = dataRef.current
        if (!data) return
        const newQuestions = withQuestionOptions(data.questions, questionId,
            options => options.filter(o => o.id !== optionId), new Date().toISOString())
        await saveData({ ...data, questions: newQuestions })
    }, [saveData])

    // Stable modal openers — inline closures here would defeat the sections' memo.
    const openEditQuestion = useCallback((question: Question) => setQuestionModal({ question }), [])
    const openAddOption = useCallback((questionId: string) => setOptionModal({ questionId, option: null }), [])
    const openEditOption = useCallback((questionId: string, option: Option) => setOptionModal({ questionId, option }), [])
    const openPeopleModal = useCallback(() => setPeopleModal(true), [])
    const openAlwaysModal = useCallback(() => setAlwaysModal(true), [])

    // The set as a dictionary of its own item names: what the add composers
    // offer as you type, and what the name fields offer as existing options.
    // One scan serves both, and the names arrive deduped and alphabetical.
    const suggestions = useMemo(
        () => data ? buildQuestionSetSuggestions(data) : buildIndexOf([]),
        [data])
    const allItemNames = useMemo(() => suggestions.all.map(s => s.text), [suggestions])

    // Section names already in use anywhere in the question set, offered as
    // suggestions so the same section spelled two ways doesn't split into two
    // groups on the packing list.
    const suggestedSectionNames = useMemo(() => data ? sectionNamesIn(data) : [], [data])

    // Memoized so their identity is stable across re-renders that don't change
    // the data (modal opens, sync ticks) — they feed the memoized sections.
    const people = useMemo(() => (data?.people ?? []).filter(p => !p.deletedAt), [data])
    const activeQuestions = useMemo(() => (data?.questions ?? []).filter(q => !q.deletedAt), [data])
    const activeAlwaysNeededItems = useMemo(() => (data?.alwaysNeededItems ?? []).filter(i => !i.deletedAt), [data])

    if (error) return <div className="p-8 text-red-600">Error: {error}</div>
    if (!data) return (
        <div className="w-full flex flex-col items-center py-8 px-4">
            <div className="w-full max-w-3xl">
                <LoadingState message="Loading questions & items..." rows={3} />
            </div>
        </div>
    )

    return (
        <div className="w-full flex flex-col items-center py-8 px-4">
            <div className="w-full max-w-3xl space-y-4">
                <div className="mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">{isForeign ? 'Questions & Items' : 'My Questions & Items'}</h1>
                    <p className="mt-1 text-gray-600 text-sm">Customise the questions and packing items that generate your lists. Changes here affect all future packing lists you create.</p>
                    {!isForeign && <p className="mt-1 text-xs text-gray-400">Want to start from scratch? <Link to="/wizard" className="text-primary-600 hover:underline">Redo the setup wizard</Link> to regenerate your questions.</p>}
                </div>
                {!isForeign && (
                    <AgePromotionCard
                        questionSet={data}
                        onApply={saveData}
                        manualTransitions={manualPromotions}
                        onManualHandled={() => setManualPromotions([])}
                    />
                )}
                {!isForeign && <TemplateUpdatesCard questionSet={data} onApply={saveData} />}
                <PersonLegend people={people} onEdit={openPeopleModal} />
                <AlwaysSection
                    items={activeAlwaysNeededItems}
                    people={people}
                    emptySections={data.alwaysNeededEmptySections}
                    allItemNames={allItemNames}
                    sectionNames={suggestedSectionNames}
                    suggestions={suggestions}
                    onEdit={openAlwaysModal}
                    onItemChange={handleAlwaysItemChange}
                    onItemAdd={handleAlwaysItemAdd}
                    onItemDelete={handleAlwaysItemDelete}
                    onSectionAdd={handleAlwaysSectionAdd}
                />
                {activeQuestions.map((q, qi) => (
                    <QuestionSection
                        key={q.id}
                        question={q}
                        people={people}
                        canMoveUp={qi > 0}
                        canMoveDown={qi < activeQuestions.length - 1}
                        allItemNames={allItemNames}
                        sectionNames={suggestedSectionNames}
                        suggestions={suggestions}
                        onEdit={openEditQuestion}
                        onDelete={handleDeleteQuestion}
                        onAddOption={openAddOption}
                        onEditOption={openEditOption}
                        onDeleteOption={handleDeleteOption}
                        onMove={handleMoveQuestion}
                        onItemChange={handleOptionItemChange}
                        onItemAdd={handleOptionItemAdd}
                        onItemDelete={handleOptionItemDelete}
                        onSectionAdd={handleOptionSectionAdd}
                    />
                ))}
                <button
                    type="button"
                    onClick={() => setQuestionModal({ question: null })}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                >
                    + Add Question
                </button>
            </div>
            {questionModal !== null && (
                <QuestionModal
                    question={questionModal.question}
                    onSave={handleQuestionModalSave}
                    onClose={() => setQuestionModal(null)}
                />
            )}
            {optionModal !== null && (
                <OptionEditModal
                    option={optionModal.option}
                    question={data?.questions.find(q => q.id === optionModal.questionId)}
                    people={people}
                    allItemNames={allItemNames}
                    suggestedSectionNames={suggestedSectionNames}
                    onSave={handleOptionModalSave}
                    onClose={() => setOptionModal(null)}
                />
            )}
            {alwaysModal && (
                <AlwaysNeededModal
                    initialItems={activeAlwaysNeededItems}
                    people={people}
                    allItemNames={allItemNames}
                    suggestedSectionNames={suggestedSectionNames}
                    onSave={handleAlwaysSave}
                    onClose={() => setAlwaysModal(false)}
                />
            )}
            {peopleModal && (
                <PeopleModal
                    people={people}
                    onSave={handlePeopleSave}
                    onClose={() => setPeopleModal(false)}
                />
            )}
        </div>
    )
}
