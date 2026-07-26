import { describe, it, expect } from 'vitest'
import { buildSuggestionIndex, suggestFor, SHARED_OWNER_KEY, ownerKeyFor } from './itemSuggestions'
import type { PackingListItem } from '../create-packing-list/types'

const mk = (over: Partial<PackingListItem>): PackingListItem => ({
    id: Math.random().toString(36).slice(2),
    itemText: 'Item',
    personId: 'p1',
    personName: 'Alice',
    questionId: '',
    optionId: '',
    packed: false,
    ...over,
})

describe('buildSuggestionIndex', () => {
    it('collects one suggestion per distinct item name', () => {
        const index = buildSuggestionIndex([
            mk({ itemText: 'Sunhat', personName: 'Alice' }),
            mk({ itemText: 'Sunhat', personName: 'Bob' }),
            mk({ itemText: 'Passport', personName: 'Alice' }),
        ])
        expect(index.all.map(s => s.text)).toEqual(['Passport', 'Sunhat'])
    })

    it('carries the category the name is usually filed under', () => {
        const index = buildSuggestionIndex([
            mk({ itemText: 'Sunhat', category: 'Clothes' }),
        ])
        expect(index.all[0].category).toBe('Clothes')
    })

    it('prefers the most common category when a name is filed two ways', () => {
        const index = buildSuggestionIndex([
            mk({ itemText: 'Sunhat', personName: 'Alice', category: 'Clothes' }),
            mk({ itemText: 'Sunhat', personName: 'Bob', category: 'Clothes' }),
            mk({ itemText: 'Sunhat', personName: 'Cara' }),
        ])
        expect(index.all[0].category).toBe('Clothes')
    })

    it('includes items that were removed earlier, so they are easy to put back', () => {
        const index = buildSuggestionIndex(
            [mk({ itemText: 'Passport' })],
            [mk({ itemText: 'Travel pillow', category: 'Sleep & Comfort' })],
        )
        expect(index.all.map(s => s.text)).toContain('Travel pillow')
    })

    it('records what each person already has', () => {
        const index = buildSuggestionIndex([
            mk({ itemText: 'Sunhat', personName: 'Alice' }),
            mk({ itemText: 'Tent', communal: true, personName: '' }),
        ])
        expect(index.ownedBy.get('Alice')?.has('sunhat')).toBe(true)
        expect(index.ownedBy.get(SHARED_OWNER_KEY)?.has('tent')).toBe(true)
    })
})

describe('ownerKeyFor', () => {
    it('keys communal items separately from anyone with a name', () => {
        expect(ownerKeyFor({ personName: '', personId: '', communal: true })).toBe(SHARED_OWNER_KEY)
        expect(ownerKeyFor({ personName: 'Alice', personId: 'p1' })).toBe('Alice')
    })
})

describe('suggestFor', () => {
    const index = buildSuggestionIndex([
        mk({ itemText: 'Sun cream', personName: 'Alice', category: 'Toiletries' }),
        mk({ itemText: 'Sunhat', personName: 'Alice', category: 'Clothes' }),
        mk({ itemText: 'Sunglasses', personName: 'Bob' }),
        mk({ itemText: 'Passport', personName: 'Bob', category: 'Documents & Money' }),
        mk({ itemText: 'Beach towel', personName: 'Bob' }),
    ])

    it('matches on any part of the name, case-insensitively', () => {
        expect(suggestFor(index, 'Cara', 'TOWEL').map(s => s.text)).toEqual(['Beach towel'])
    })

    it('ranks names that start with what was typed first', () => {
        expect(suggestFor(index, 'Cara', 'sun').map(s => s.text))
            .toEqual(['Sun cream', 'Sunglasses', 'Sunhat'])
    })

    it('leaves out what this person already has', () => {
        expect(suggestFor(index, 'Alice', 'sun').map(s => s.text)).toEqual(['Sunglasses'])
    })

    it('leaves out an exact match, since typing it is already enough', () => {
        expect(suggestFor(index, 'Cara', 'Passport')).toEqual([])
    })

    it('suggests nothing until something has been typed', () => {
        expect(suggestFor(index, 'Cara', '  ')).toEqual([])
    })

    it('caps how many are offered', () => {
        expect(suggestFor(index, 'Cara', 's', 2)).toHaveLength(2)
    })
})
