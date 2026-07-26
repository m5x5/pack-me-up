import { PackingListItem } from './types'

/**
 * Identity for a generated row: who it's for, plus its text ignoring case and
 * surrounding whitespace. Communal items carry personId '', so they only ever
 * collapse against each other — never against somebody's personal copy.
 */
export function itemIdentityKey(personId: string, itemText: string): string {
    return `${personId}::${itemText.trim().toLowerCase()}`
}

/**
 * Collapse the same item reaching one person from more than one answer — a towel
 * asked for by both the self-catering and the camping option, say.
 *
 * The surviving row keeps its position and section, but takes the **largest**
 * suggested quantity among the copies rather than whichever happened to come
 * first. Without that, the answer that sorted first silently decided how much
 * you packed: a rated `Towels` behind a rateless one meant one towel for a
 * fortnight, so the whole cost of an arbitrary choice fell on under-packing.
 *
 * Sections can't be resolved the same way — there is no "larger" of two
 * categories — so the first copy's category wins and keeping them consistent
 * stays a content concern.
 */
export function deduplicateItems(items: PackingListItem[]): PackingListItem[] {
    const largest = new Map<string, number>()
    for (const item of items) {
        if (item.quantity === undefined) continue
        const key = itemIdentityKey(item.personId, item.itemText)
        const seen = largest.get(key)
        largest.set(key, seen === undefined ? item.quantity : Math.max(seen, item.quantity))
    }

    const seen = new Set<string>()
    const result: PackingListItem[] = []
    for (const item of items) {
        const key = itemIdentityKey(item.personId, item.itemText)
        if (seen.has(key)) continue
        seen.add(key)
        const quantity = largest.get(key)
        result.push(quantity === undefined ? item : { ...item, quantity })
    }
    return result
}
