import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSectionOrder } from './useSectionOrder'
import { CATEGORY_ORDER } from '../edit-questions/item-sections'
import type { PackingListQuestionSet } from '../edit-questions/types'
import type { PackingAppDatabase } from '../services/database'

const questionSet = (overrides: Partial<PackingListQuestionSet> = {}): PackingListQuestionSet => ({
    people: [],
    alwaysNeededItems: [
        { text: 'Passport', personSelections: [], category: 'Documents & Money' },
        { text: 'Socks', personSelections: [], category: 'Clothes' },
    ],
    questions: [],
    ...overrides,
})

const dbReturning = (result: Promise<PackingListQuestionSet>) =>
    ({ getQuestionSet: vi.fn().mockReturnValue(result) }) as unknown as PackingAppDatabase

describe('useSectionOrder', () => {
    it('uses the built-in default before the question set has loaded', () => {
        const { result } = renderHook(() => useSectionOrder(dbReturning(new Promise(() => {}))))
        expect(result.current).toBe(CATEGORY_ORDER)
    })

    it('follows the order the user arranged', async () => {
        const { result } = renderHook(() => useSectionOrder(dbReturning(
            Promise.resolve(questionSet({ sectionOrder: ['Clothes', 'Documents & Money'] })))))
        await waitFor(() => expect(result.current).toEqual(['Clothes', 'Documents & Money']))
    })

    // Not the labels this set happens to contain: an unarranged set has always
    // grouped its lists by the built-in default, and must keep doing so.
    it('keeps the built-in default when no order has been arranged', async () => {
        const { result } = renderHook(() => useSectionOrder(dbReturning(Promise.resolve(questionSet()))))
        await waitFor(() => expect(result.current).toBe(CATEGORY_ORDER))
    })

    it('falls back to the default when there is no question set to read', async () => {
        const { result } = renderHook(() => useSectionOrder(dbReturning(Promise.reject(new Error('missing')))))
        await waitFor(() => expect(result.current).toBe(CATEGORY_ORDER))
    })

    it('does nothing without a database', () => {
        const { result } = renderHook(() => useSectionOrder(undefined))
        expect(result.current).toBe(CATEGORY_ORDER)
    })
})
