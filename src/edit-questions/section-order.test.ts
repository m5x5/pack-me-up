import { describe, it, expect } from 'vitest'
import { ALWAYS_NEEDED_CATEGORY, CATEGORIES } from './item-sections'
import { moveSectionLabel, orderedSectionLabels, reconcileSectionOrder, sectionLabelsOf } from './section-order'
import type { Item, PackingListQuestionSet, Option, SavedQuestion } from './types'

function item(text: string, category?: string, order?: number): Item {
    return { id: `item-${text}`, text, personSelections: [], ...(category ? { category } : {}), ...(order !== undefined ? { order } : {}) }
}

function option(overrides: Partial<Option> & { id: string }): Option {
    return { text: 'Yes', order: 0, items: [], ...overrides }
}

function question(overrides: Partial<SavedQuestion> & { id: string }): SavedQuestion {
    return { type: 'saved', text: 'A question?', order: 0, options: [], ...overrides }
}

function questionSet(overrides: Partial<PackingListQuestionSet> = {}): PackingListQuestionSet {
    return { people: [], alwaysNeededItems: [], questions: [], ...overrides }
}

describe('sectionLabelsOf', () => {
    it('lists the always-needed default when uncategorised items are there', () => {
        const qs = questionSet({ alwaysNeededItems: [item('Passport')] })
        expect(sectionLabelsOf(qs)).toEqual([ALWAYS_NEEDED_CATEGORY])
    })

    it('lists each section an item names for itself', () => {
        const qs = questionSet({
            alwaysNeededItems: [item('Toothbrush', CATEGORIES.toiletries), item('Socks', CATEGORIES.clothes)],
        })
        expect(sectionLabelsOf(qs)).toEqual([CATEGORIES.toiletries, CATEGORIES.clothes])
    })

    it('falls back to the option text for uncategorised items under a multiple-choice question', () => {
        const qs = questionSet({
            questions: [question({
                id: 'q1',
                questionType: 'multiple-choice',
                options: [option({ id: 'o1', text: 'Beach', items: [item('Towel')] })],
            })],
        })
        expect(sectionLabelsOf(qs)).toEqual(['Beach'])
    })

    it('falls back to the question text for uncategorised items under a single-choice question', () => {
        const qs = questionSet({
            questions: [question({
                id: 'q1',
                text: 'Camping?',
                options: [option({ id: 'o1', items: [item('Tent')] })],
            })],
        })
        expect(sectionLabelsOf(qs)).toEqual(['Camping?'])
    })

    it('includes sections that have been created but have nothing in them yet', () => {
        const qs = questionSet({
            alwaysNeededItems: [item('Passport')],
            alwaysNeededEmptySections: ['Beach kit'],
        })
        expect(sectionLabelsOf(qs)).toEqual([ALWAYS_NEEDED_CATEGORY, 'Beach kit'])
    })

    it('names each section once however many questions it spans', () => {
        const qs = questionSet({
            alwaysNeededItems: [item('Toothbrush', CATEGORIES.toiletries)],
            questions: [question({
                id: 'q1',
                options: [option({ id: 'o1', items: [item('Shampoo', CATEGORIES.toiletries)] })],
            })],
        })
        expect(sectionLabelsOf(qs)).toEqual([CATEGORIES.toiletries])
    })

    it('orders template sections the way the packing list does, whatever the question order', () => {
        const qs = questionSet({
            questions: [
                question({
                    id: 'q1',
                    order: 0,
                    options: [option({ id: 'o1', items: [item('Tent', CATEGORIES.kit)] })],
                }),
                question({
                    id: 'q2',
                    order: 1,
                    options: [option({ id: 'o2', items: [item('Passport', CATEGORIES.documents)] })],
                }),
            ],
        })
        expect(sectionLabelsOf(qs)).toEqual([CATEGORIES.documents, CATEGORIES.kit])
    })

    it('puts sections it has no opinion about after the template ones, in question order', () => {
        const qs = questionSet({
            questions: [
                question({
                    id: 'q1',
                    order: 1,
                    options: [option({ id: 'o1', items: [item('Board games', 'Rainy day')] })],
                }),
                question({
                    id: 'q2',
                    order: 0,
                    options: [option({ id: 'o2', items: [item('Surfboard', 'Surf')] })],
                }),
            ],
            alwaysNeededItems: [item('Passport', CATEGORIES.documents)],
        })
        expect(sectionLabelsOf(qs)).toEqual([CATEGORIES.documents, 'Surf', 'Rainy day'])
    })

    it('ignores deleted questions and deleted items', () => {
        const qs = questionSet({
            alwaysNeededItems: [{ ...item('Old', 'Gone'), deletedAt: '2025-01-01T00:00:00.000Z' }],
            questions: [
                question({
                    id: 'q1',
                    deletedAt: '2025-01-01T00:00:00.000Z',
                    options: [option({ id: 'o1', items: [item('Removed', 'Also gone')] })],
                }),
            ],
        })
        expect(sectionLabelsOf(qs)).toEqual([])
    })
})

describe('orderedSectionLabels', () => {
    const qs = questionSet({
        alwaysNeededItems: [
            item('Passport', CATEGORIES.documents),
            item('Toothbrush', CATEGORIES.toiletries),
            item('Socks', CATEGORIES.clothes),
        ],
    })

    it('uses the default order when the user has not chosen one', () => {
        expect(orderedSectionLabels(qs)).toEqual(sectionLabelsOf(qs))
    })

    it('follows the stored order', () => {
        const ordered = orderedSectionLabels({
            ...qs,
            sectionOrder: [CATEGORIES.clothes, CATEGORIES.documents, CATEGORIES.toiletries],
        })
        expect(ordered).toEqual([CATEGORIES.clothes, CATEGORIES.documents, CATEGORIES.toiletries])
    })

    it('puts a section the stored order has never seen at the end', () => {
        const ordered = orderedSectionLabels({
            ...qs,
            sectionOrder: [CATEGORIES.clothes, CATEGORIES.documents],
        })
        expect(ordered).toEqual([CATEGORIES.clothes, CATEGORIES.documents, CATEGORIES.toiletries])
    })

    it('ignores stored names whose section no longer exists', () => {
        const ordered = orderedSectionLabels({
            ...qs,
            sectionOrder: ['Long gone', CATEGORIES.clothes, CATEGORIES.documents, CATEGORIES.toiletries],
        })
        expect(ordered).toEqual([CATEGORIES.clothes, CATEGORIES.documents, CATEGORIES.toiletries])
    })
})

describe('reconcileSectionOrder', () => {
    const stored = ['Essentials', 'Toiletries', 'Clothes']

    it('leaves an order alone when the sections are unchanged', () => {
        expect(reconcileSectionOrder(stored, stored, [...stored])).toEqual(stored)
    })

    it('keeps a renamed section in the slot the user put it in', () => {
        const after = ['Essentials', 'Wash bag', 'Clothes']
        expect(reconcileSectionOrder(stored, stored, after)).toEqual(['Essentials', 'Wash bag', 'Clothes'])
    })

    it('leaves a removed section in place, so undoing the removal restores its slot', () => {
        expect(reconcileSectionOrder(stored, stored, ['Essentials', 'Clothes'])).toEqual(stored)
    })

    it('does not guess when several sections changed at once', () => {
        const after = ['Essentials', 'Wash bag', 'Outfits']
        expect(reconcileSectionOrder(stored, stored, after)).toEqual(stored)
    })

    it('has nothing to do when the user has chosen no order', () => {
        expect(reconcileSectionOrder(undefined, stored, ['Essentials'])).toBeUndefined()
    })
})

describe('moveSectionLabel', () => {
    const labels = ['Documents', 'Toiletries', 'Clothes']

    it('moves a section up', () => {
        expect(moveSectionLabel(labels, 2, 1)).toEqual(['Documents', 'Clothes', 'Toiletries'])
    })

    it('moves a section down', () => {
        expect(moveSectionLabel(labels, 0, 2)).toEqual(['Toiletries', 'Clothes', 'Documents'])
    })

    it('leaves the list alone when the move goes nowhere', () => {
        expect(moveSectionLabel(labels, 1, 1)).toBe(labels)
    })

    it('leaves the list alone when the move goes off the end', () => {
        expect(moveSectionLabel(labels, 2, 3)).toBe(labels)
        expect(moveSectionLabel(labels, 0, -1)).toBe(labels)
    })
})
