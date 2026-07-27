/**
 * The order the sections of a generated packing list come in.
 *
 * A section spans questions — "Toiletries" is filled by the always-needed list
 * and by two options besides — so its position cannot be read off any one
 * question, and dragging items around inside a question is the wrong gesture
 * for moving a whole section. Until this existed, the order came from
 * `CATEGORY_ORDER`: a constant, which no user could change, and which pinned
 * every section the built-in template ships ahead of every section a user
 * named. Renaming a section out of that list was the only way to move it.
 *
 * So the order is stored as its own thing — `PackingListQuestionSet.sectionOrder`,
 * a plain list of section names, independent of the questions — and edited in
 * one place on the questions page. It stays a *preference*, not a schema: names
 * it doesn't mention still appear (at the end), and names it mentions that no
 * longer exist are ignored rather than pruned, so a section that is briefly
 * empty doesn't lose the slot the user put it in.
 *
 * `CATEGORY_ORDER` keeps its job as the default. A set with no stored order
 * behaves exactly as it did before, down to the field being absent from the
 * document.
 */
import { ALWAYS_NEEDED_CATEGORY, CATEGORY_ORDER, defaultCategoryFor } from './item-sections'
import type { Item, PackingListQuestionSet } from './types'

/** Explicit order wins; items without one keep their array position. */
function inItemOrder(items: Item[]): Item[] {
    return items
        .map((item, index) => ({ item, key: item.order ?? index }))
        .sort((a, b) => a.key - b.key)
        .map(({ item }) => item)
}

function byOrder<T extends { order: number }>(a: T, b: T): number {
    return a.order - b.order
}

function isActive(item: Item): boolean {
    return !item.deletedAt
}

/**
 * Every section a generated list can show, in the order it would show them
 * were the user to express no preference.
 *
 * The walk mirrors `generatePackingListItems` — questions by their order, then
 * options, then items, with the always-needed list last, because that is the
 * order the two halves are concatenated in when a list is built. That walk
 * decides where a section a user named lands; sections the template ships are
 * then lifted to the front in `CATEGORY_ORDER`, which is what the packing list
 * view does today and so what "no preference" has to keep meaning.
 */
export function sectionLabelsOf(qs: PackingListQuestionSet): string[] {
    const labels: string[] = []
    const add = (label: string) => {
        if (label && !labels.includes(label)) labels.push(label)
    }

    const addItemList = (items: Item[], fallback: string) => {
        for (const item of inItemOrder(items.filter(isActive))) add(item.category ?? fallback)
    }

    for (const question of [...(qs.questions ?? [])].filter(q => !q.deletedAt).sort(byOrder)) {
        for (const option of [...question.options].sort(byOrder)) {
            addItemList(option.items, defaultCategoryFor(question, option))
            for (const label of option.emptySections ?? []) add(label)
        }
    }

    addItemList(qs.alwaysNeededItems ?? [], ALWAYS_NEEDED_CATEGORY)
    for (const label of qs.alwaysNeededEmptySections ?? []) add(label)

    // A stable sort by rank alone: labels `CATEGORY_ORDER` says nothing about
    // share the last rank and so keep the discovery order above.
    const rank = (label: string) => {
        const index = CATEGORY_ORDER.indexOf(label)
        return index === -1 ? CATEGORY_ORDER.length : index
    }
    return labels
        .map((label, index) => ({ label, index }))
        .sort((a, b) => (rank(a.label) - rank(b.label)) || (a.index - b.index))
        .map(({ label }) => label)
}

/**
 * The section order in effect: what the questions page shows, and what a new
 * list is stamped with.
 *
 * Stored names that no longer name a section are dropped, and sections the
 * stored order has never seen are appended in their default order — a new
 * section goes last until the user moves it, rather than appearing somewhere
 * they didn't put it.
 */
export function orderedSectionLabels(qs: PackingListQuestionSet): string[] {
    const all = sectionLabelsOf(qs)
    if (!qs.sectionOrder?.length) return all
    const stored = qs.sectionOrder.filter(label => all.includes(label))
    return [...stored, ...all.filter(label => !stored.includes(label))]
}

/** Move the entry at `from` to `to`, leaving the rest in order. */
export function moveSectionLabel(labels: string[], from: number, to: number): string[] {
    if (from === to || from < 0 || to < 0 || from >= labels.length || to >= labels.length) return labels
    const next = [...labels]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
}

/**
 * Keep a stored order in step with an edit that changed which sections exist.
 *
 * The case that matters is a rename: the section is the same section, so it
 * must keep the slot the user chose for it, but a rename reaches this code as
 * nothing more than one name disappearing while another appears. That is the
 * only shape acted on. Anything less clear-cut is left alone — a name whose
 * section is gone costs nothing (`orderedSectionLabels` ignores it) and keeping
 * it means removing a section by accident doesn't also lose its position.
 */
export function reconcileSectionOrder(
    stored: string[] | undefined,
    before: string[],
    after: string[],
): string[] | undefined {
    if (!stored?.length) return undefined
    const gone = before.filter(label => !after.includes(label))
    const fresh = after.filter(label => !before.includes(label))
    if (gone.length !== 1 || fresh.length !== 1) return stored
    return stored.map(label => label === gone[0] ? fresh[0] : label)
}
