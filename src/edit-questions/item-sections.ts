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
