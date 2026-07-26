/**
 * Suggestions for the "add an item" composers.
 *
 * A collection of items is its own best dictionary: by the time someone is
 * adding things by hand, their packing list — or their question set — already
 * knows how "Sun cream" is spelled and which section it belongs in, usually
 * because somebody else on the trip has one. So the catalogue is built from
 * what is already there (including items deleted earlier, which are exactly the
 * things people put back), and picking a suggestion carries its category
 * across. That is what turns "add to a particular section" from a chore into a
 * single tap.
 *
 * The index is built once per collection and filtered per keystroke, so the
 * work that happens while someone is typing is a scan of distinct names, not of
 * items.
 *
 * `buildIndexOf` is the shape-agnostic core: an owner is whatever "already has
 * this one" means for the page — a person on a packing list, one option's item
 * list in a question set — and the two pages differ only in how they name it.
 */
import type { PackingListItem } from '../create-packing-list/types'

/** Owner key for communal items, which belong to no one in particular. */
export const SHARED_OWNER_KEY = '__shared__'

const DEFAULT_LIMIT = 6

export interface ItemSuggestion {
    text: string
    /** Section the name is usually filed under; absent = uncategorised. */
    category?: string
}

export interface SuggestionIndex {
    /** Every distinct name on the list, alphabetically. */
    all: ItemSuggestion[]
    /** Lowercased names each owner already has, so we don't offer duplicates. */
    ownedBy: Map<string, Set<string>>
}

export interface SuggestionOwner {
    personName: string
    personId: string
    communal?: boolean
}

export function ownerKeyFor(owner: SuggestionOwner): string {
    return owner.communal ? SHARED_OWNER_KEY : owner.personName
}

/** Case-insensitive but deterministic — locale collation orders "Sun cream"
 *  against "Sunglasses" differently between engines, and the suggestion order
 *  is asserted in tests. */
const byName = (a: string, b: string) => {
    const x = a.toLowerCase()
    const y = b.toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
}

/** One name going into the catalogue, reduced to what the index cares about. */
export interface SuggestionSource {
    text: string
    category?: string
    /**
     * The list that already holds this name, so it isn't offered back to it.
     * Omit for names that only stock the catalogue — deleted items, which are
     * exactly the things people add back.
     */
    owner?: string
}

export function buildIndexOf(sources: Iterable<SuggestionSource>): SuggestionIndex {
    // name (lowercased) -> the name as first seen, and how often each category
    // has been used for it. A name filed two ways takes the majority verdict so
    // one stray uncategorised copy doesn't lose the section.
    const names = new Map<string, { text: string; categories: Map<string | undefined, number> }>()
    const ownedBy = new Map<string, Set<string>>()

    for (const source of sources) {
        const text = source.text.trim()
        if (!text) continue
        const key = text.toLowerCase()
        const entry = names.get(key) ?? { text, categories: new Map() }
        entry.categories.set(source.category, (entry.categories.get(source.category) ?? 0) + 1)
        names.set(key, entry)
        if (source.owner === undefined) continue
        const set = ownedBy.get(source.owner) ?? new Set<string>()
        set.add(key)
        ownedBy.set(source.owner, set)
    }

    const all = [...names.values()]
        .map(({ text, categories }) => {
            const [category] = [...categories.entries()]
                .sort(([, a], [, b]) => b - a)[0]
            return category === undefined ? { text } : { text, category }
        })
        .sort((a, b) => byName(a.text, b.text))

    return { all, ownedBy }
}

/** The catalogue a packing list makes of itself, owned per person. */
export function buildSuggestionIndex(
    items: readonly PackingListItem[],
    deletedItems: readonly PackingListItem[] = [],
): SuggestionIndex {
    const source = (item: PackingListItem, owned: boolean): SuggestionSource => ({
        text: item.itemText,
        category: item.category,
        ...(owned ? { owner: ownerKeyFor(item) } : {}),
    })
    return buildIndexOf([
        ...items.map(item => source(item, true)),
        // Deleted items stock the catalogue but are not "owned" — the whole
        // point is that they can be added back.
        ...deletedItems.map(item => source(item, false)),
    ])
}

/**
 * Names worth offering for `query`, best first: names starting with what was
 * typed lead, then names containing it. Anything the owner already has is left
 * out, as is an exact match — by then the typing is done.
 */
export function suggestFor(
    index: SuggestionIndex,
    ownerKey: string,
    query: string,
    limit = DEFAULT_LIMIT,
): ItemSuggestion[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const owned = index.ownedBy.get(ownerKey)

    const starts: ItemSuggestion[] = []
    const contains: ItemSuggestion[] = []
    for (const suggestion of index.all) {
        const name = suggestion.text.toLowerCase()
        if (name === needle) continue
        if (owned?.has(name)) continue
        if (name.startsWith(needle)) starts.push(suggestion)
        else if (name.includes(needle)) contains.push(suggestion)
        if (starts.length >= limit) break
    }
    return [...starts, ...contains].slice(0, limit)
}
