/**
 * Sections within a single item list (the always-needed list, or one option's
 * items). A section is just a `category` stamped on each of its items — see the
 * note on `ItemSchema.category`. There is no section entity and no boundary
 * marker, which is what keeps the feature safe across per-item LWW merges and
 * old clients.
 *
 * Items with no category of their own belong to the list's default section,
 * named by `defaultCategoryFor` / `ALWAYS_NEEDED_CATEGORY` — the same values
 * `generatePackingListItems` falls back to, so the editor shows exactly the
 * grouping the generated packing list will have.
 */
import { groupItemsByCategory, type CategoryAccessors, type CategoryGroup } from '../utils/groupByCategory'
import type { Item, Option, PackingListQuestionSet, Question } from './types'

/** Default section name for items in the always-needed list. */
export const ALWAYS_NEEDED_CATEGORY = 'Essentials'

/**
 * The section an item falls into when it carries no category of its own:
 * the option text for multiple-choice questions (each option is already its
 * own group), the question text otherwise.
 */
export function defaultCategoryFor(question: Question, option: Option): string {
    return question.questionType === 'multiple-choice' ? option.text : question.text
}

const ITEM_ACCESSORS: CategoryAccessors<Item> = {
    category: item => item.category,
    order: item => item.order,
    text: item => item.text,
}

/**
 * Group an item list into its sections, ordered by each section's earliest
 * item. Grouping is by label rather than by walking positions, so a section
 * stays contiguous — and appears exactly once — even if a merge leaves an
 * item's order and category disagreeing.
 */
export function groupItemsIntoSections(items: Item[], defaultLabel: string): CategoryGroup<Item>[] {
    return groupItemsByCategory(items, ITEM_ACCESSORS, { uncategorisedLabel: defaultLabel })
}

/**
 * A section list flattened for display: a header before each section, then its
 * items. This is the only place position carries meaning — it's what the editor
 * drags against, and `applySectionLayout` turns it straight back into stamped
 * categories. Nothing positional is ever stored.
 */
export type SectionSequenceEntry =
    | { kind: 'header'; label: string }
    | { kind: 'item'; item: Item }

/**
 * Build the display sequence for the editor. `draftSections` are sections the
 * user has created but not yet dragged anything into; they exist only in editor
 * state, since a section with no items has nothing to stamp and so cannot be
 * stored.
 *
 * Unlike `groupItemsIntoSections` — which the packing list uses, and which sorts
 * by the stamped `order` — this groups by *array position*. Inside the editor
 * the array is the source of truth: `order` is deliberately left stale until
 * `renumberItemOrder` runs at save, because that staleness is exactly how a
 * reorder earns its `lastModified` bump. Both paths share the same bucketing by
 * label, so the sections themselves can't drift; only the basis for ordering
 * within them differs, and saving makes the two agree.
 */
export function buildSectionSequence(
    items: Item[],
    defaultLabel: string,
    draftSections: string[],
): SectionSequenceEntry[] {
    const buckets = new Map<string, Item[]>()
    // The default section always leads, so the "main pile" stays the top of the
    // list even if a categorised item happens to sit first in the array.
    buckets.set(defaultLabel, [])
    for (const item of items) {
        const label = item.category ?? defaultLabel
        if (!buckets.has(label)) buckets.set(label, [])
        buckets.get(label)!.push(item)
    }
    for (const draft of draftSections) {
        if (!buckets.has(draft)) buckets.set(draft, [])
    }
    return [...buckets.entries()]
        // An empty default section has no header to show; drafts do, since their
        // header is the drop target that brings them into existence.
        .filter(([label, bucket]) => bucket.length > 0 || label !== defaultLabel)
        .flatMap(([label, bucket]) => [
            { kind: 'header' as const, label },
            ...bucket.map(item => ({ kind: 'item' as const, item })),
        ])
}

/**
 * Turn a dragged sequence back into a flat item list, stamping each item with
 * the nearest header above it. Items under the default header (or above the
 * first header) carry no category at all, so "back to the main pile" stores
 * nothing rather than storing the default name.
 *
 * Only items whose section actually changed get a fresh `lastModified` —
 * position changes are stamped separately by `renumberItemOrder` at save.
 */
export function applySectionLayout(
    sequence: SectionSequenceEntry[],
    defaultLabel: string,
    now: string,
): Item[] {
    let current: string | undefined
    const result: Item[] = []
    for (const entry of sequence) {
        if (entry.kind === 'header') {
            current = entry.label === defaultLabel ? undefined : entry.label
            continue
        }
        const item = entry.item
        if (item.category === current) {
            result.push(item)
            continue
        }
        const { category: _dropped, ...rest } = item
        result.push({ ...rest, ...(current !== undefined ? { category: current } : {}), lastModified: now })
    }
    return result
}

/** Every distinct section name in use, for offering existing names as suggestions. */
export function sectionNamesIn(qs: PackingListQuestionSet): string[] {
    const names = new Set<string>()
    for (const item of qs.alwaysNeededItems ?? []) {
        if (item.category) names.add(item.category)
    }
    for (const question of qs.questions ?? []) {
        for (const option of question.options) {
            for (const item of option.items) {
                if (item.category) names.add(item.category)
            }
        }
    }
    return [...names]
}

/**
 * Move items into a section (or back to the default section with `undefined`).
 * Only items whose category actually changes get a fresh `lastModified`, so a
 * no-op drag doesn't churn sync or win unrelated merges.
 */
export function assignItemsToSection(
    items: Item[],
    itemIds: string[],
    category: string | undefined,
    now: string,
): Item[] {
    const ids = new Set(itemIds)
    return items.map(item => {
        if (!item.id || !ids.has(item.id) || item.category === category) return item
        const { category: _dropped, ...rest } = item
        return { ...rest, ...(category !== undefined ? { category } : {}), lastModified: now }
    })
}

/**
 * Rename a section by restamping every item in it. Soft-deleted items are
 * renamed too, so an item restored later rejoins the renamed section instead of
 * reappearing under a name that no longer exists.
 */
export function renameSection(items: Item[], from: string, to: string, now: string): Item[] {
    if (from === to) return items
    return items.map(item =>
        item.category === from ? { ...item, category: to, lastModified: now } : item
    )
}

/**
 * Remove a section, keeping its items — they fall back to the list's default
 * section. Removing a grouping should never destroy what was grouped.
 */
export function removeSection(items: Item[], label: string, now: string): Item[] {
    return items.map(item => {
        if (item.category !== label) return item
        const { category: _dropped, ...rest } = item
        return { ...rest, lastModified: now }
    })
}
