import { describe, it, expect } from 'vitest'
import { ALWAYS_LIST_KEY, listKeyFor, buildQuestionSetSuggestions } from './item-suggestions'
import { suggestFor } from '../utils/itemSuggestions'
import type { Item, PackingListQuestionSet, Question } from './types'

function makeItem(text: string, overrides: Partial<Item> = {}): Item {
    return { text, personSelections: [], ...overrides }
}

function makeQuestion(id: string, options: { id: string; items: Item[] }[]): Question {
    return {
        id,
        type: 'saved',
        text: `Question ${id}`,
        order: 0,
        options: options.map((o, i) => ({ id: o.id, text: `Option ${o.id}`, order: i, items: o.items })),
    }
}

function makeSet(overrides: Partial<PackingListQuestionSet> = {}): PackingListQuestionSet {
    return { people: [], alwaysNeededItems: [], questions: [], ...overrides }
}

describe('buildQuestionSetSuggestions', () => {
    it('collects every distinct name in the set, wherever it lives', () => {
        const index = buildQuestionSetSuggestions(makeSet({
            alwaysNeededItems: [makeItem('Passport')],
            questions: [makeQuestion('q1', [{ id: 'o1', items: [makeItem('Sunhat')] }])],
        }))
        expect(index.all.map(s => s.text)).toEqual(['Passport', 'Sunhat'])
    })

    it('carries the section a name is usually filed under', () => {
        const index = buildQuestionSetSuggestions(makeSet({
            alwaysNeededItems: [makeItem('Toothbrush', { category: 'Toiletries' })],
        }))
        expect(index.all[0].category).toBe('Toiletries')
    })

    it('leaves a name uncategorised when it carries no section of its own', () => {
        // The section an uncategorised item shows under is the list's own default
        // heading — the option or question text. That name means nothing in
        // another list, so picking the suggestion must not stamp it.
        const index = buildQuestionSetSuggestions(makeSet({
            alwaysNeededItems: [makeItem('Toothbrush')],
        }))
        expect(index.all[0].category).toBeUndefined()
    })

    it('takes the majority verdict when a name is filed two ways', () => {
        const index = buildQuestionSetSuggestions(makeSet({
            alwaysNeededItems: [makeItem('Towel')],
            questions: [makeQuestion('q1', [
                { id: 'o1', items: [makeItem('Towel', { category: 'Toiletries' })] },
                { id: 'o2', items: [makeItem('Towel', { category: 'Toiletries' })] },
            ])],
        }))
        expect(index.all[0].category).toBe('Toiletries')
    })

    it('keeps offering a name the list deleted — those are what people put back', () => {
        const index = buildQuestionSetSuggestions(makeSet({
            alwaysNeededItems: [makeItem('Sun cream', { deletedAt: '2024-01-01T00:00:00.000Z' })],
        }))
        expect(suggestFor(index, ALWAYS_LIST_KEY, 'sun').map(s => s.text)).toEqual(['Sun cream'])
    })

    it('skips deleted questions and options entirely', () => {
        const deleted = makeQuestion('q1', [{ id: 'o1', items: [makeItem('Wetsuit')] }])
        const index = buildQuestionSetSuggestions(makeSet({
            questions: [{ ...deleted, deletedAt: '2024-01-01T00:00:00.000Z' }],
        }))
        expect(index.all).toEqual([])
    })
})

describe('buildQuestionSetSuggestions: what each list already has', () => {
    const set = makeSet({
        alwaysNeededItems: [makeItem('Passport')],
        questions: [makeQuestion('q1', [{ id: 'o1', items: [makeItem('Sunhat')] }])],
    })
    const index = buildQuestionSetSuggestions(set)

    it('does not offer a list a name it already holds', () => {
        expect(suggestFor(index, ALWAYS_LIST_KEY, 'pass')).toEqual([])
    })

    it('does offer that name to a list that does not have it', () => {
        expect(suggestFor(index, listKeyFor('q1', 'o1'), 'pass').map(s => s.text)).toEqual(['Passport'])
    })

    it('keys options separately, so two answers do not share a dictionary', () => {
        expect(suggestFor(index, listKeyFor('q1', 'o2'), 'sunh').map(s => s.text)).toEqual(['Sunhat'])
        expect(suggestFor(index, listKeyFor('q1', 'o1'), 'sunh')).toEqual([])
    })
})
