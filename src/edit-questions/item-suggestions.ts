/**
 * The question set as a dictionary of its own item names.
 *
 * Someone adding "Toothbrush" to a new answer has almost certainly typed it
 * before, somewhere else in the same set, and filed it under Toiletries when
 * they did. Offering it back — with its section attached — is what lets an item
 * land in the right section from one tap, instead of being typed, saved, and
 * then moved.
 *
 * An "owner" here is one item list: the always-needed list, or one option's
 * items. That is the unit a name can be a duplicate within, so it is the unit
 * suggestions are withheld from.
 */
import { buildIndexOf, type SuggestionIndex, type SuggestionSource } from '../utils/itemSuggestions'
import type { Item, PackingListQuestionSet } from './types'

/** Owner key for the always-needed list, which belongs to no question. */
export const ALWAYS_LIST_KEY = '__always__'

export function listKeyFor(questionId: string, optionId: string): string {
    return `${questionId}:${optionId}`
}

/**
 * Every distinct name in the set, with the section it is usually filed under.
 *
 * Items carrying no category of their own contribute an uncategorised entry on
 * purpose: the heading such an item shows under is its own list's default label
 * — an option or question text — which means nothing in the list being added
 * to, so picking the suggestion must leave the section alone rather than stamp
 * a name from somewhere else.
 */
export function buildQuestionSetSuggestions(qs: PackingListQuestionSet): SuggestionIndex {
    const sources: SuggestionSource[] = []
    const record = (items: Item[], owner: string) => {
        for (const item of items) {
            sources.push({
                text: item.text,
                category: item.category,
                // A deleted name stays in the catalogue but is not held by the
                // list, so the list can be offered it back.
                ...(item.deletedAt ? {} : { owner }),
            })
        }
    }

    record(qs.alwaysNeededItems ?? [], ALWAYS_LIST_KEY)
    for (const question of qs.questions ?? []) {
        if (question.deletedAt) continue
        for (const option of question.options) {
            record(option.items, listKeyFor(question.id, option.id))
        }
    }
    return buildIndexOf(sources)
}
