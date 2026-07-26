/**
 * How the user last left a particular packing list: which view they were in,
 * whether packed items were showing, and which sections they had folded away.
 *
 * A big family list is only manageable once you can put away the parts you
 * aren't packing right now — and that's worthless if the app forgets the moment
 * you navigate back to the lists index. This is per-list rather than global
 * because "everyone collapsed except Ellie" is a fact about one trip, not a
 * preference about the app.
 *
 * Kept in localStorage rather than on the list itself: it's a device-local view
 * state, not list data, and pushing it to the pod would have one person's
 * folded sections rearrange the list under a collaborator who is packing a
 * different bag.
 */

export type ListViewMode = 'person' | 'question'

export interface ListViewPreferences {
    viewMode: ListViewMode
    showPacked: boolean
    /** Keys of folded top-level sections — a person, a category, or the shared section. */
    collapsedSections: string[]
    /** Keys of folded groups within a section, in `sectionKey::groupLabel` form. */
    collapsedGroups: string[]
}

export const DEFAULT_LIST_VIEW_PREFERENCES: ListViewPreferences = {
    viewMode: 'person',
    showPacked: false,
    collapsedSections: [],
    collapsedGroups: [],
}

const KEY_PREFIX = 'pack-me-up:list-view:'

export function listViewPreferencesKey(listId: string): string {
    return `${KEY_PREFIX}${listId}`
}

function stringsOnly(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function isDefault(prefs: ListViewPreferences): boolean {
    return prefs.viewMode === DEFAULT_LIST_VIEW_PREFERENCES.viewMode
        && prefs.showPacked === DEFAULT_LIST_VIEW_PREFERENCES.showPacked
        && prefs.collapsedSections.length === 0
        && prefs.collapsedGroups.length === 0
}

/**
 * Never throws and never returns a partial object: a corrupt or half-written
 * entry costs the user their folded sections, which is not worth failing a list
 * render over. Storage itself can throw outright (Safari private browsing), so
 * every access is guarded rather than feature-detected.
 */
export function loadListViewPreferences(listId: string | undefined): ListViewPreferences {
    if (!listId) return DEFAULT_LIST_VIEW_PREFERENCES

    let raw: string | null = null
    try {
        raw = localStorage.getItem(listViewPreferencesKey(listId))
    } catch {
        return DEFAULT_LIST_VIEW_PREFERENCES
    }
    if (!raw) return DEFAULT_LIST_VIEW_PREFERENCES

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return DEFAULT_LIST_VIEW_PREFERENCES
    }
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LIST_VIEW_PREFERENCES

    const stored = parsed as Partial<Record<keyof ListViewPreferences, unknown>>
    return {
        viewMode: stored.viewMode === 'question' ? 'question' : 'person',
        showPacked: stored.showPacked === true,
        collapsedSections: stringsOnly(stored.collapsedSections),
        collapsedGroups: stringsOnly(stored.collapsedGroups),
    }
}

export function saveListViewPreferences(listId: string | undefined, prefs: ListViewPreferences): void {
    if (!listId) return
    try {
        // A list sitting at the defaults has nothing worth remembering, so it
        // leaves no entry behind — otherwise every list ever opened would
        // accumulate one.
        if (isDefault(prefs)) {
            localStorage.removeItem(listViewPreferencesKey(listId))
            return
        }
        localStorage.setItem(listViewPreferencesKey(listId), JSON.stringify(prefs))
    } catch {
        // Storage full or blocked — the list still works, it just won't
        // remember how it was left.
    }
}
