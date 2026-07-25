import { describe, it, expect } from 'vitest'
import {
    ALWAYS_NEEDED_CATEGORY,
    defaultCategoryFor,
    groupItemsIntoSections,
    assignItemsToSection,
    renameSection,
    removeSection,
    sectionNamesIn,
    buildSectionSequence,
    applySectionLayout,
    type SectionSequenceEntry,
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

describe('buildSectionSequence', () => {
    it('interleaves a header before each section, default section first', () => {
        const items = [
            item({ id: 'i1', text: 'Snacks', order: 0 }),
            item({ id: 'i2', text: 'Nappies', order: 1, category: 'Baby' }),
        ]
        const sequence = buildSectionSequence(items, 'Essentials', [])
        expect(sequence.map(e => e.kind === 'header' ? `#${e.label}` : e.item.text))
            .toEqual(['#Essentials', 'Snacks', '#Baby', 'Nappies'])
    })

    it('includes draft sections that have no items yet', () => {
        const items = [item({ id: 'i1', text: 'Snacks', order: 0 })]
        const sequence = buildSectionSequence(items, 'Essentials', ['First aid'])
        expect(sequence.map(e => e.kind === 'header' ? `#${e.label}` : e.item.text))
            .toEqual(['#Essentials', 'Snacks', '#First aid'])
    })

    it('does not duplicate a draft section that has since gained items', () => {
        const items = [item({ id: 'i1', text: 'Plasters', order: 0, category: 'First aid' })]
        const sequence = buildSectionSequence(items, 'Essentials', ['First aid'])
        expect(sequence.filter(e => e.kind === 'header')).toHaveLength(1)
    })

    it('follows array position, not the stale order field', () => {
        // Mid-edit the array is the truth: `order` is left stale on purpose so
        // renumberItemOrder can tell at save which items actually moved.
        const items = [
            item({ id: 'i1', text: 'Wipes', order: 5 }),
            item({ id: 'i2', text: 'Snacks', order: 1 }),
        ]
        const sequence = buildSectionSequence(items, 'Essentials', [])
        expect(sequence.filter(e => e.kind === 'item').map(e => e.kind === 'item' && e.item.text))
            .toEqual(['Wipes', 'Snacks'])
    })

    it('omits the default header when every item is in a named section', () => {
        const items = [item({ id: 'i1', text: 'Plasters', category: 'First aid' })]
        const sequence = buildSectionSequence(items, 'Essentials', [])
        expect(sequence.map(e => e.kind === 'header' ? `#${e.label}` : e.item.text))
            .toEqual(['#First aid', 'Plasters'])
    })
})

describe('applySectionLayout', () => {
    const snacks = item({ id: 'i1', text: 'Snacks' })
    const nappies = item({ id: 'i2', text: 'Nappies' })

    function sequence(...entries: Array<string | Item>): SectionSequenceEntry[] {
        return entries.map(e =>
            typeof e === 'string' ? { kind: 'header' as const, label: e } : { kind: 'item' as const, item: e }
        )
    }

    it('stamps each item with the nearest header above it', () => {
        const result = applySectionLayout(
            sequence('Essentials', snacks, 'Baby', nappies), 'Essentials', now
        )
        expect(result.map(i => [i.text, i.category])).toEqual([
            ['Snacks', undefined],
            ['Nappies', 'Baby'],
        ])
    })

    it('returns items in displayed order so a cross-section drag also moves them', () => {
        const result = applySectionLayout(
            sequence('Baby', nappies, 'Essentials', snacks), 'Essentials', now
        )
        expect(result.map(i => i.text)).toEqual(['Nappies', 'Snacks'])
        expect(result.map(i => i.category)).toEqual(['Baby', undefined])
    })

    it('clears the category for items dragged back under the default header', () => {
        const stamped = item({ id: 'i2', text: 'Nappies', category: 'Baby' })
        const result = applySectionLayout(sequence('Essentials', stamped), 'Essentials', now)
        expect(result[0].category).toBeUndefined()
        expect(result[0].lastModified).toBe(now)
    })

    it('treats items dragged above the first header as the default section', () => {
        const stamped = item({ id: 'i2', text: 'Nappies', category: 'Baby' })
        const result = applySectionLayout(sequence(stamped, 'Baby'), 'Essentials', now)
        expect(result[0].category).toBeUndefined()
    })

    it('only bumps lastModified on items whose section actually changed', () => {
        const stamped = item({ id: 'i2', text: 'Nappies', category: 'Baby' })
        const result = applySectionLayout(sequence('Essentials', snacks, 'Baby', stamped), 'Essentials', now)
        expect(result[0].lastModified).toBe(before)
        expect(result[1].lastModified).toBe(before)
    })

    it('drops empty sections — a header with no items below it stamps nothing', () => {
        const result = applySectionLayout(
            sequence('Essentials', snacks, 'First aid'), 'Essentials', now
        )
        expect(result).toHaveLength(1)
        expect(result[0].category).toBeUndefined()
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
