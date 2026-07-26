import { describe, it, expect } from 'vitest'
import { deduplicateItems, itemIdentityKey } from './deduplicate'
import { PackingListItem } from './types'

const makeItem = (overrides: Partial<PackingListItem> & { itemText: string; personId: string }): PackingListItem => ({
    id: 'test-id',
    personName: 'Alice',
    questionId: 'q1',
    optionId: 'o1',
    packed: false,
    ...overrides,
})

describe('itemIdentityKey', () => {
    it('ignores case and surrounding whitespace', () => {
        expect(itemIdentityKey('p1', ' Phone Charger ')).toBe(itemIdentityKey('p1', 'phone charger'))
    })

    it('separates a communal item from a personal one with the same text', () => {
        expect(itemIdentityKey('', 'Towels')).not.toBe(itemIdentityKey('p1', 'Towels'))
    })
})

describe('deduplicateItems', () => {
    it('keeps a single item when there are no duplicates', () => {
        const items = [makeItem({ itemText: 'Phone charger', personId: 'p1' })]
        expect(deduplicateItems(items)).toHaveLength(1)
    })

    it('removes exact duplicate items for the same person', () => {
        const items = [
            makeItem({ itemText: 'Phone charger', personId: 'p1', questionId: 'q1' }),
            makeItem({ itemText: 'Phone charger', personId: 'p1', questionId: 'always-needed' }),
        ]
        expect(deduplicateItems(items)).toHaveLength(1)
    })

    it('removes duplicates that differ only in capitalisation', () => {
        const items = [
            makeItem({ itemText: 'Phone Charger', personId: 'p1', questionId: 'q1' }),
            makeItem({ itemText: 'phone charger', personId: 'p1', questionId: 'always-needed' }),
        ]
        expect(deduplicateItems(items)).toHaveLength(1)
    })

    it('removes duplicates that differ in leading/trailing whitespace', () => {
        const items = [
            makeItem({ itemText: 'Day bag / Backpack', personId: 'p1', questionId: 'q1' }),
            makeItem({ itemText: ' Day bag / Backpack ', personId: 'p1', questionId: 'always-needed' }),
        ]
        expect(deduplicateItems(items)).toHaveLength(1)
    })

    it('keeps the first occurrence (question-based takes precedence)', () => {
        const questionBased = makeItem({ id: 'first', itemText: 'Phone Charger', personId: 'p1', questionId: 'q1' })
        const alwaysNeeded = makeItem({ id: 'second', itemText: 'phone charger', personId: 'p1', questionId: 'always-needed' })
        const result = deduplicateItems([questionBased, alwaysNeeded])
        expect(result[0].id).toBe('first')
    })

    it('does not deduplicate the same item text across different people', () => {
        const items = [
            makeItem({ itemText: 'Phone charger', personId: 'p1' }),
            makeItem({ itemText: 'Phone charger', personId: 'p2' }),
        ]
        expect(deduplicateItems(items)).toHaveLength(2)
    })

    it('handles multiple duplicates for multiple people', () => {
        const items = [
            makeItem({ itemText: 'Daypack/Backpack', personId: 'p1', questionId: 'q1' }),
            makeItem({ itemText: 'Day bag / Backpack', personId: 'p1', questionId: 'q2' }),
            makeItem({ itemText: 'Phone Charger', personId: 'p1', questionId: 'q1' }),
            makeItem({ itemText: 'phone charger', personId: 'p1', questionId: 'always-needed' }),
            makeItem({ itemText: 'Phone Charger', personId: 'p2', questionId: 'q1' }),
            makeItem({ itemText: 'phone charger', personId: 'p2', questionId: 'always-needed' }),
        ]
        // p1: Daypack/Backpack, Day bag / Backpack are different texts → kept; Phone Charger deduped → 3 items
        // p2: Phone Charger deduped → 1 item
        // total: 4
        const result = deduplicateItems(items)
        expect(result).toHaveLength(4)
    })

    // Which answer happens to sort first must not decide how much you pack, and
    // an arbitrary choice can only hurt by suggesting too little.
    it('keeps the largest suggested quantity of the duplicates', () => {
        const rateless = makeItem({ id: 'first', itemText: 'Towels', personId: 'p1', questionId: 'q1' })
        const rated = makeItem({ id: 'second', itemText: 'Towels', personId: 'p1', questionId: 'q2', quantity: 5 })

        const result = deduplicateItems([rateless, rated])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('first')
        expect(result[0].quantity).toBe(5)
    })

    it('takes the largest quantity whichever order the duplicates arrive in', () => {
        const high = makeItem({ itemText: 'Socks', personId: 'p1', questionId: 'q1', quantity: 7 })
        const low = makeItem({ itemText: 'Socks', personId: 'p1', questionId: 'q2', quantity: 2 })

        expect(deduplicateItems([high, low])[0].quantity).toBe(7)
        expect(deduplicateItems([low, high])[0].quantity).toBe(7)
    })

    it('leaves an item with no quantity anywhere without one', () => {
        const a = makeItem({ itemText: 'Passport', personId: 'p1', questionId: 'q1' })
        const b = makeItem({ itemText: 'Passport', personId: 'p1', questionId: 'q2' })

        expect(deduplicateItems([a, b])[0].quantity).toBeUndefined()
    })

    it('does not merge quantities across different people', () => {
        const result = deduplicateItems([
            makeItem({ itemText: 'Socks', personId: 'p1', quantity: 2 }),
            makeItem({ itemText: 'Socks', personId: 'p2', quantity: 9 }),
        ])
        expect(result).toHaveLength(2)
        expect(result.find(i => i.personId === 'p1')!.quantity).toBe(2)
        expect(result.find(i => i.personId === 'p2')!.quantity).toBe(9)
    })

    it('keeps the section of the row that survives, not the one dropped', () => {
        const first = makeItem({ itemText: 'Towels', personId: '', questionId: 'q1', category: 'Toiletries' })
        const second = makeItem({ itemText: 'Towels', personId: '', questionId: 'q2', category: 'Kit & Gear' })

        expect(deduplicateItems([first, second])[0].category).toBe('Toiletries')
    })
})
