import { describe, it, expect } from 'vitest'
import { applyItemEdit, withQuestionOptions } from './item-edits'
import type { Item, Option, Question } from './types'

const NOW = '2024-06-01T12:00:00.000Z'

function makeItem(text: string, overrides: Partial<Item> = {}): Item {
    return { text, personSelections: [], ...overrides }
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
    return { id: 'q1', text: 'Beach?', type: 'saved', order: 0, options: [], ...overrides }
}

function makeOption(overrides: Partial<Option> = {}): Option {
    return { id: 'o1', text: 'Yes', order: 0, items: [], ...overrides }
}

// ── withQuestionOptions ───────────────────────────────────────────────────────

describe('withQuestionOptions', () => {
    it('replaces the named question’s options', () => {
        const questions = [makeQuestion({ id: 'q1', options: [makeOption({ id: 'o1' })] })]
        const result = withQuestionOptions(questions, 'q1', () => [makeOption({ id: 'o2' })], NOW)
        expect(result[0].options.map(o => o.id)).toEqual(['o2'])
    })

    it('stamps lastModified on the question whose items changed', () => {
        // Without this stamp the merge has no per-question timestamp to compare,
        // falls through to the doc-level tiebreak, and takes the whole question
        // from one side — losing the other device's edit to a different question.
        const questions = [makeQuestion({ id: 'q1' })]
        const result = withQuestionOptions(questions, 'q1', o => o, NOW)
        expect(result[0].lastModified).toBe(NOW)
    })

    it('leaves other questions untouched, preserving their identity', () => {
        const other = makeQuestion({ id: 'q2', order: 1 })
        const questions = [makeQuestion({ id: 'q1' }), other]
        const result = withQuestionOptions(questions, 'q1', o => o, NOW)
        // Identity matters: a new object here would re-render every memoized
        // question section on the page.
        expect(result[1]).toBe(other)
        expect(result[1].lastModified).toBeUndefined()
    })

    it('is a no-op when no question matches', () => {
        const questions = [makeQuestion({ id: 'q1' })]
        const result = withQuestionOptions(questions, 'missing', () => [makeOption()], NOW)
        expect(result[0].options).toEqual([])
        expect(result[0].lastModified).toBeUndefined()
    })
})

// ── applyItemEdit: edits that stay in the same section ────────────────────────

describe('applyItemEdit within a section', () => {
    const items = () => [makeItem('Socks'), makeItem('Towel'), makeItem('Hat')]

    it('replaces the item at the given index', () => {
        const list = items()
        const result = applyItemEdit(list, 1, { ...list[1], text: 'Beach towel' }, 'Yes', NOW)
        expect(result.map(i => i.text)).toEqual(['Socks', 'Beach towel', 'Hat'])
    })

    it('stamps lastModified on the edited item only', () => {
        const list = items()
        const result = applyItemEdit(list, 1, { ...list[1], text: 'Beach towel' }, 'Yes', NOW)
        expect(result[1].lastModified).toBe(NOW)
        expect(result[0].lastModified).toBeUndefined()
        expect(result[2].lastModified).toBeUndefined()
    })

    it('keeps the other items’ identity so their rows do not re-render', () => {
        const list = items()
        const result = applyItemEdit(list, 1, { ...list[1], text: 'Beach towel' }, 'Yes', NOW)
        expect(result[0]).toBe(list[0])
        expect(result[2]).toBe(list[2])
    })

    it('carries person selections through', () => {
        const list = items()
        const edited = { ...list[0], personSelections: [{ personId: 'p1', selected: true }] }
        const result = applyItemEdit(list, 0, edited, 'Yes', NOW)
        expect(result[0].personSelections).toEqual([{ personId: 'p1', selected: true }])
    })

    it('carries the quantity rate through', () => {
        const list = items()
        const edited = { ...list[0], perNight: 1, perNights: 4, maxQuantity: 3 }
        const result = applyItemEdit(list, 0, edited, 'Yes', NOW)
        expect(result[0]).toMatchObject({ perNight: 1, perNights: 4, maxQuantity: 3 })
    })

    it('leaves the list alone when the index is out of range', () => {
        const list = items()
        expect(applyItemEdit(list, 7, makeItem('Nope'), 'Yes', NOW)).toBe(list)
    })
})

// ── applyItemEdit: edits that change section ─────────────────────────────────

describe('applyItemEdit across sections', () => {
    const sectioned = () => [
        makeItem('Socks'),
        makeItem('Toothbrush', { category: 'Toiletries' }),
        makeItem('Shampoo', { category: 'Toiletries' }),
    ]

    it('stamps the new category on the moved item', () => {
        const list = sectioned()
        const result = applyItemEdit(list, 0, { ...list[0], category: 'Toiletries' }, 'Yes', NOW)
        expect(result.find(i => i.text === 'Socks')?.category).toBe('Toiletries')
    })

    it('lands the item at the bottom of its new section, as a drag would', () => {
        const list = sectioned()
        const result = applyItemEdit(list, 0, { ...list[0], category: 'Toiletries' }, 'Yes', NOW)
        expect(result.map(i => i.text)).toEqual(['Toothbrush', 'Shampoo', 'Socks'])
    })

    it('renumbers order so the packing list picks the move up', () => {
        // The generated list sorts by `order`, not array position, so a move that
        // does not renumber would show the old arrangement.
        const list = sectioned()
        const result = applyItemEdit(list, 0, { ...list[0], category: 'Toiletries' }, 'Yes', NOW)
        expect(result.map(i => i.order)).toEqual([0, 1, 2])
    })

    it('creates the section when the name is a new one', () => {
        const list = sectioned()
        const result = applyItemEdit(list, 0, { ...list[0], category: 'Beach kit' }, 'Yes', NOW)
        expect(result.find(i => i.text === 'Socks')?.category).toBe('Beach kit')
        // Nothing else moves into the new section.
        expect(result.filter(i => i.category === 'Beach kit').map(i => i.text)).toEqual(['Socks'])
    })

    it('drops the category when moved back to the default section', () => {
        // "Back to the main pile" stores nothing rather than storing the default
        // section's name — see the note on applySectionLayout.
        const list = sectioned()
        const result = applyItemEdit(list, 1, { ...list[1], category: undefined }, 'Yes', NOW)
        const moved = result.find(i => i.text === 'Toothbrush')!
        expect('category' in moved).toBe(false)
    })

    it('moves back into a default section that has no items left', () => {
        const list = [
            makeItem('Toothbrush', { category: 'Toiletries' }),
            makeItem('Shampoo', { category: 'Toiletries' }),
        ]
        const result = applyItemEdit(list, 0, { ...list[0], category: undefined }, 'Yes', NOW)
        expect('category' in result.find(i => i.text === 'Toothbrush')!).toBe(false)
    })

    it('stamps lastModified on the moved item', () => {
        const list = sectioned()
        const result = applyItemEdit(list, 0, { ...list[0], category: 'Toiletries' }, 'Yes', NOW)
        expect(result.find(i => i.text === 'Socks')?.lastModified).toBe(NOW)
    })

    it('applies a text change made in the same edit as the move', () => {
        const list = sectioned()
        const edited = { ...list[0], text: 'Wool socks', category: 'Toiletries' }
        const result = applyItemEdit(list, 0, edited, 'Yes', NOW)
        expect(result.map(i => i.text)).toEqual(['Toothbrush', 'Shampoo', 'Wool socks'])
    })
})
