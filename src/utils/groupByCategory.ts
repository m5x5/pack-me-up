/**
 * Grouping items into categories (the "sections" a packing list is split into).
 *
 * Shared by the packing list view and the question-set editor so the two can't
 * drift: what you arrange in the editor is what you get on the list. Both sides
 * store the category by stamping it onto each item, so grouping is just a
 * bucket-by-label — there is no positional boundary state to reconstruct.
 *
 * Categories are ordered by their earliest item so they follow the order the
 * user arranged their items in, with optional pinned labels for the list view's
 * "Essentials first, Other last" convention.
 */

export interface CategoryAccessors<T> {
    category: (item: T) => string | undefined
    order: (item: T) => number | undefined
    /** Used only as a tie-break when two items have no order. */
    text: (item: T) => string
}

export interface CategoryGroupingOptions {
    /** Label for items carrying no category of their own. */
    uncategorisedLabel: string
    /**
     * Labels to place in this exact order, ahead of everything else. Labels not
     * listed keep the default behaviour — ordered by their earliest item — and
     * sort after the listed ones. Use this when a section spans several
     * questions, so its position can't be inferred from item order.
     */
    order?: readonly string[]
    /** Label always sorted to the back, whatever its items' order. */
    pinLast?: string
}

export interface CategoryGroup<T> {
    label: string
    items: T[]
}

/**
 * Items carry an `order` stamped from the question set; sort by it so lists
 * mirror how the user arranged their items. Items without one (legacy data,
 * custom additions) fall back to alphabetical at the end.
 */
export function sortByOrder<T>(items: T[], accessors: CategoryAccessors<T>): T[] {
    return items.sort((a, b) =>
        ((accessors.order(a) ?? Infinity) - (accessors.order(b) ?? Infinity))
        || accessors.text(a).localeCompare(accessors.text(b))
    )
}

export function groupItemsByCategory<T>(
    items: T[],
    accessors: CategoryAccessors<T>,
    options: CategoryGroupingOptions,
): CategoryGroup<T>[] {
    const { uncategorisedLabel, order, pinLast } = options

    const map = new Map<string, T[]>()
    for (const item of items) {
        const label = accessors.category(item) ?? uncategorisedLabel
        if (!map.has(label)) map.set(label, [])
        map.get(label)!.push(item)
    }

    const minOrder = (groupItems: T[]) =>
        Math.min(...groupItems.map(i => accessors.order(i) ?? Infinity))

    // Listed labels rank by position; unlisted ones share a rank after them and
    // fall back to item order, so a partly-categorised list still reads sensibly.
    const rank = (label: string) => {
        const index = order?.indexOf(label) ?? -1
        return index === -1 ? Infinity : index
    }

    return [...map.entries()]
        .sort(([a, aItems], [b, bItems]) => {
            if (pinLast !== undefined) {
                if (a === pinLast) return 1
                if (b === pinLast) return -1
            }
            const byRank = rank(a) - rank(b)
            if (byRank !== 0 && !Number.isNaN(byRank)) return byRank
            return (minOrder(aItems) - minOrder(bItems)) || a.localeCompare(b)
        })
        .map(([label, groupItems]) => ({
            label,
            items: sortByOrder(groupItems, accessors),
        }))
}
