import { PackingListQuestionSet } from '../edit-questions/types'
import { PackingList, PackingListItem } from './types'
import { generateQuestionBasedItems, generateAlwaysNeededItems } from './generatePackingListItems'
// Identity and collapsing are shared with the creation flow, so an item arriving
// from two answers behaves the same whether the list is being created or
// updated — including taking the larger of the two suggested quantities.
import { deduplicateItems, itemIdentityKey as itemKey } from './deduplicate'

// The sentinel questionId used for always-needed items; such items carry no real
// question/option ids to reconstruct answers from.
const ALWAYS_NEEDED_QUESTION_ID = 'always-needed'

interface GenerationInputs {
    questionAnswers: Array<{ questionId: string; selectedOptionIds: string[] }>
    selectedPeopleIds: string[]
}


// Legacy lists (created before generation inputs were persisted) have neither
// `questionAnswers` nor `selectedPeopleIds`. Rebuild what we can from the items
// that were generated: the distinct (questionId → optionId) pairs become the
// answers, and the distinct non-empty personIds become the travellers. This is
// lossy — an option that generated no instances, or whose items were all
// deleted-and-purged, is invisible — but safe for additions: at worst it misses
// some additions, it never invents wrong ones.
export function reconstructGenerationInputs(list: PackingList): GenerationInputs {
    const optionIdsByQuestion = new Map<string, Set<string>>()
    const peopleIds = new Set<string>()

    for (const item of [...list.items, ...(list.deletedItems ?? [])]) {
        if (item.personId) peopleIds.add(item.personId)
        if (!item.questionId || item.questionId === ALWAYS_NEEDED_QUESTION_ID) continue
        if (!item.optionId) continue
        if (!optionIdsByQuestion.has(item.questionId)) {
            optionIdsByQuestion.set(item.questionId, new Set())
        }
        optionIdsByQuestion.get(item.questionId)!.add(item.optionId)
    }

    const questionAnswers = [...optionIdsByQuestion.entries()].map(([questionId, optionIds]) => ({
        questionId,
        selectedOptionIds: [...optionIds],
    }))

    return { questionAnswers, selectedPeopleIds: [...peopleIds] }
}

function resolveGenerationInputs(list: PackingList): GenerationInputs {
    if (list.questionAnswers !== undefined || list.selectedPeopleIds !== undefined) {
        return {
            questionAnswers: list.questionAnswers ?? [],
            selectedPeopleIds: list.selectedPeopleIds ?? [],
        }
    }
    return reconstructGenerationInputs(list)
}

// Re-runs the generator for the list's stored (or reconstructed) inputs against
// the current question set, and returns only the items that are genuinely new:
// not already on the list, and not previously deleted from it. Additions carry
// a fresh id and lastModified so the item-level merge can track them.
export function computeQuestionSetAdditions(
    list: PackingList,
    questionSet: PackingListQuestionSet,
): PackingListItem[] {
    return computeQuestionSetChanges(list, questionSet)
        .filter((c): c is Extract<QuestionSetChange, { type: 'add' }> => c.type === 'add')
        .map(c => c.item)
}

export type UpdateKind = 'renamed' | 'moved' | 'quantity'

/**
 * The full diff between a list and what its questions would generate today.
 *
 *  - `add`     — a genuinely new item (fresh id, unpacked).
 *  - `remove`  — a question-generated item on the list the questions no longer
 *                produce (deleted, or its option/question removed).
 *  - `update`  — the same item, changed in place: renamed, moved to another
 *                section, or given a different suggested quantity. `after`
 *                keeps the id and packed state of `before`.
 *  - `sharing` — the item crossed the communal boundary: `remove` the old
 *                copies, `add` the replacements. Packed state carries over
 *                (a shared item is packed once every copy was).
 */
export type QuestionSetChange =
    | { type: 'add'; item: PackingListItem }
    | { type: 'remove'; item: PackingListItem }
    | { type: 'update'; before: PackingListItem; after: PackingListItem; kinds: UpdateKind[] }
    | { type: 'sharing'; direction: 'shared' | 'personal'; itemText: string; remove: PackingListItem[]; add: PackingListItem[] }

export function computeQuestionSetChanges(
    list: PackingList,
    questionSet: PackingListQuestionSet,
): QuestionSetChange[] {
    const { questionAnswers, selectedPeopleIds } = resolveGenerationInputs(list)

    // A person removed from the question set must not be regenerated; this also
    // guards the non-null people.find(...)! inside the generator.
    const currentPeopleIds = new Set(questionSet.people.map(p => p.id))
    const validPeopleIds = selectedPeopleIds.filter(id => currentPeopleIds.has(id))

    const regenerated = deduplicateItems([
        ...generateQuestionBasedItems(
            questionSet.questions,
            questionAnswers,
            questionSet.people,
            validPeopleIds,
            list.nights,
        ),
        ...generateAlwaysNeededItems(
            questionSet.alwaysNeededItems,
            questionSet.people,
            validPeopleIds,
            list.nights,
        ),
    ])

    const now = new Date().toISOString()
    const deletedKeys = new Set(
        (list.deletedItems ?? []).map(item => itemKey(item.personId, item.itemText))
    )
    const listByKey = new Map<string, PackingListItem>()
    for (const item of list.items) listByKey.set(itemKey(item.personId, item.itemText), item)

    const changes: QuestionSetChange[] = []
    const matchedListIds = new Set<string>()
    const unmatchedRegen: PackingListItem[] = []

    // Pass 1 — exact identity (person + text): the item is still generated;
    // anything that differs about it is an in-place update.
    for (const item of regenerated) {
        const key = itemKey(item.personId, item.itemText)
        const existing = listByKey.get(key)
        if (existing) {
            matchedListIds.add(existing.id)
            const update = buildUpdate(existing, item, now)
            if (update) changes.push(update)
            continue
        }
        // Deleted by the user: never resurrected, in any form.
        if (deletedKeys.has(key)) continue
        unmatchedRegen.push(item)
    }

    // Which list items may be judged against the regeneration at all: only
    // question-generated ones (custom items are the user's, not the questions'),
    // only from questions this list actually answered (a list whose generation
    // inputs are missing must not see everything flagged as removed), and only
    // for people the question set still knows.
    const answeredQuestionIds = new Set(questionAnswers.map(a => a.questionId))
    const unmatchedList = list.items.filter(item => {
        if (matchedListIds.has(item.id)) return false
        if (item.questionId === '') return false
        if (item.questionId === ALWAYS_NEEDED_QUESTION_ID) {
            if (validPeopleIds.length === 0) return false
        } else if (!answeredQuestionIds.has(item.questionId)) {
            return false
        }
        return item.personId === '' || validPeopleIds.includes(item.personId)
    })

    // Pass 2 — sharing transitions: the same text on the other side of the
    // communal boundary is the item changing who packs it, not a delete+add.
    const usedRegen = new Set<PackingListItem>()
    const usedList = new Set<string>()
    const textOf = (item: PackingListItem) => item.itemText.trim().toLowerCase()
    for (const regenItem of unmatchedRegen) {
        if (usedRegen.has(regenItem)) continue
        if (regenItem.personId === '') {
            const copies = unmatchedList.filter(li => !usedList.has(li.id) && li.personId !== '' && textOf(li) === textOf(regenItem))
            if (copies.length > 0) {
                usedRegen.add(regenItem)
                copies.forEach(c => usedList.add(c.id))
                changes.push({
                    type: 'sharing',
                    direction: 'shared',
                    itemText: regenItem.itemText,
                    remove: copies,
                    add: [{ ...regenItem, id: crypto.randomUUID(), packed: copies.every(c => c.packed), lastModified: now }],
                })
            }
        } else {
            const shared = unmatchedList.find(li => !usedList.has(li.id) && li.personId === '' && textOf(li) === textOf(regenItem))
            if (shared) {
                // Collect every per-person replacement for this text in one change
                const replacements = unmatchedRegen.filter(r => !usedRegen.has(r) && r.personId !== '' && textOf(r) === textOf(regenItem))
                replacements.forEach(r => usedRegen.add(r))
                usedList.add(shared.id)
                changes.push({
                    type: 'sharing',
                    direction: 'personal',
                    itemText: shared.itemText,
                    remove: [shared],
                    add: replacements.map(r => ({ ...r, id: crypto.randomUUID(), packed: shared.packed, lastModified: now })),
                })
            }
        }
    }

    // Pass 3 — renames: within one option and one person, a single item
    // disappearing while a single one appears is that item under a new name.
    // More than one on either side is ambiguous, so it falls through to
    // add + remove rather than guessing pairs.
    const groupKey = (item: PackingListItem) => `${item.questionId}|${item.optionId}|${item.personId}`
    const regenByGroup = new Map<string, PackingListItem[]>()
    for (const item of unmatchedRegen) {
        if (usedRegen.has(item)) continue
        const key = groupKey(item)
        if (!regenByGroup.has(key)) regenByGroup.set(key, [])
        regenByGroup.get(key)!.push(item)
    }
    const listByGroup = new Map<string, PackingListItem[]>()
    for (const item of unmatchedList) {
        if (usedList.has(item.id)) continue
        const key = groupKey(item)
        if (!listByGroup.has(key)) listByGroup.set(key, [])
        listByGroup.get(key)!.push(item)
    }
    for (const [key, regenItems] of regenByGroup) {
        const listItems = listByGroup.get(key) ?? []
        if (regenItems.length === 1 && listItems.length === 1) {
            const [regenItem] = regenItems
            const [existing] = listItems
            usedRegen.add(regenItem)
            usedList.add(existing.id)
            const update = buildUpdate(existing, regenItem, now)
            if (update) changes.push(update)
        }
    }

    // What's left is genuinely new or genuinely gone.
    for (const item of unmatchedRegen) {
        if (usedRegen.has(item)) continue
        changes.push({ type: 'add', item: { ...item, id: crypto.randomUUID(), packed: false, lastModified: now } })
    }
    for (const item of unmatchedList) {
        if (usedList.has(item.id)) continue
        changes.push({ type: 'remove', item })
    }
    return changes
}

// The in-place difference between a list item and its regenerated counterpart,
// or null when nothing the update flow cares about differs. `after` keeps the
// item's id and packed state — it's the same item, corrected.
function buildUpdate(
    before: PackingListItem,
    regen: PackingListItem,
    now: string,
): Extract<QuestionSetChange, { type: 'update' }> | null {
    const kinds: UpdateKind[] = []
    if (before.itemText !== regen.itemText) kinds.push('renamed')
    // Legacy items carry no category while the generator always assigns one;
    // that difference is history, not a move.
    if (before.category !== undefined && before.category !== regen.category) kinds.push('moved')
    // An absent quantity means 1 on both sides.
    if ((before.quantity ?? 1) !== (regen.quantity ?? 1)) kinds.push('quantity')
    if (kinds.length === 0) return null
    return {
        type: 'update',
        before,
        kinds,
        after: {
            ...before,
            itemText: regen.itemText,
            ...(kinds.includes('moved') ? { category: regen.category } : {}),
            ...(kinds.includes('quantity') ? { quantity: regen.quantity } : {}),
            lastModified: now,
        },
    }
}
