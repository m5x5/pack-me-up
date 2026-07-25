import { describe, it, expect } from 'vitest'
import {
    ALWAYS_NEEDED_CATEGORY,
    defaultCategoryFor,
    groupItemsIntoSections,
    assignItemsToSection,
    renameSection,
    removeSection,
    sectionNamesIn,
} from './item-sections'
import type { Item, Question, Option } from './types'

const now = '2024-06-01T00:00:00.000Z'
const before = '2024-01-01T00:00:00.000Z'

function item(overrides: Partial<Item> & { id: string; text: string }): Item {
    return { personSelections: [], lastModified: before, ...overrides }
}

const option: Option = { id: 'opt-yes', text: 'Yes', order: 0, items: [] }

describe('defaultCategoryFor', () => {
    const question = (questionType?: Question['questionType']): Question => ({
        id: 'q1', type: 'saved', text: 'Staying overnight?', order: 0, questionType, options: [option],
    })

    it('uses the option text for multiple-choice questions', () => {
        expect(defaultCategoryFor(question('multiple-choice'), option)).toBe('Yes')
    })

    it('uses the question text for single-choice questions', () => {
        expect(defaultCategoryFor(question('single-choice'), option)).toBe('Staying overnight?')
    })

    it('treats a question with no explicit type as single-choice', () => {
        expect(defaultCategoryFor(question(undefined), option)).toBe('Staying overnight?')
    })
})

describe('groupItemsIntoSections', () => {
    it('puts unstamped items under the default label', () => {
        const items = [item({ id: 'i1', text: 'Snacks', order: 0 })]
        const groups = groupItemsIntoSections(items, ALWAYS_NEEDED_CATEGORY)
        expect(groups).toEqual([{ label: 'Essentials', items }])
    })

    it('splits stamped items into their own sections, ordered by earliest item', () => {
        const items = [
            item({ id: 'i1', text: 'Snacks', order: 0 }),
            item({ id: 'i2', text: 'Nappies', order: 1, category: 'Baby' }),
            item({ id: 'i3', text: 'Wipes', order: 2, category: 'Baby' }),
            item({ id: 'i4', text: 'Plasters', order: 3, category: 'First aid' }),
        ]
        const groups = groupItemsIntoSections(items, ALWAYS_NEEDED_CATEGORY)
        expect(groups.map(g => g.label)).toEqual(['Essentials', 'Baby', 'First aid'])
        expect(groups[1].items.map(i => i.text)).toEqual(['Nappies', 'Wipes'])
    })

    it('keeps a section contiguous even when its items are interleaved by order', () => {
        // A merge or an old-client write can leave order and category disagreeing.
        // Grouping by label (never a positional walk) means the section still
        // renders once, rather than the header appearing twice.
        const items = [
            item({ id: 'i1', text: 'Nappies', order: 0, category: 'Baby' }),
            item({ id: 'i2', text: 'Plasters', order: 1, category: 'First aid' }),
            item({ id: 'i3', text: 'Wipes', order: 2, category: 'Baby' }),
        ]
        const groups = groupItemsIntoSections(items, ALWAYS_NEEDED_CATEGORY)
        expect(groups.map(g => g.label)).toEqual(['Baby', 'First aid'])
        expect(groups[0].items.map(i => i.text)).toEqual(['Nappies', 'Wipes'])
    })
})

describe('sectionNamesIn', () => {
    it('lists distinct category names across every item-bearing location', () => {
        const qs = {
            _id: '1',
            people: [],
            alwaysNeededItems: [item({ id: 'i1', text: 'Nappies', category: 'Baby' })],
            questions: [{
                id: 'q1', type: 'saved' as const, text: 'Overnight?', order: 0,
                options: [{
                    id: 'o1', text: 'Yes', order: 0,
                    items: [
                        item({ id: 'i2', text: 'Toothbrush', category: 'Toiletries' }),
                        item({ id: 'i3', text: 'Toothpaste', category: 'Toiletries' }),
                    ],
                }],
            }],
        }
        expect(sectionNamesIn(qs).sort()).toEqual(['Baby', 'Toiletries'])
    })
})

describe('assignItemsToSection', () => {
    const items = [
        item({ id: 'i1', text: 'Nappies', order: 0 }),
        item({ id: 'i2', text: 'Snacks', order: 1 }),
    ]

    it('stamps the category and a fresh lastModified on the moved item only', () => {
        const result = assignItemsToSection(items, ['i1'], 'Baby', now)
        expect(result[0].category).toBe('Baby')
        expect(result[0].lastModified).toBe(now)
        expect(result[1].category).toBeUndefined()
        expect(result[1].lastModified).toBe(before)
    })

    it('clears the category when moving an item back to the default section', () => {
        const stamped = [item({ id: 'i1', text: 'Nappies', order: 0, category: 'Baby' })]
        const result = assignItemsToSection(stamped, ['i1'], undefined, now)
        expect(result[0].category).toBeUndefined()
        expect(result[0].lastModified).toBe(now)
    })

    it('leaves items untouched when the category is already correct', () => {
        const stamped = [item({ id: 'i1', text: 'Nappies', order: 0, category: 'Baby' })]
        expect(assignItemsToSection(stamped, ['i1'], 'Baby', now)[0]).toBe(stamped[0])
    })
})

describe('renameSection', () => {
    it('restamps every item in the section, including soft-deleted ones', () => {
        const items = [
            item({ id: 'i1', text: 'Nappies', category: 'Baby' }),
            item({ id: 'i2', text: 'Wipes', category: 'Baby', deletedAt: before }),
            item({ id: 'i3', text: 'Plasters', category: 'First aid' }),
        ]
        const result = renameSection(items, 'Baby', 'Baby & toddler', now)
        expect(result.map(i => i.category)).toEqual(['Baby & toddler', 'Baby & toddler', 'First aid'])
        // A restored item must come back into the renamed section, so deleted
        // items are renamed too rather than being left pointing at a dead name.
        expect(result[1].category).toBe('Baby & toddler')
        expect(result[2].lastModified).toBe(before)
    })
})

describe('removeSection', () => {
    it('clears the category on its items rather than deleting them', () => {
        const items = [
            item({ id: 'i1', text: 'Nappies', category: 'Baby' }),
            item({ id: 'i2', text: 'Plasters', category: 'First aid' }),
        ]
        const result = removeSection(items, 'Baby', now)
        expect(result).toHaveLength(2)
        expect(result[0].category).toBeUndefined()
        expect(result[0].text).toBe('Nappies')
        expect(result[1].category).toBe('First aid')
    })
})
