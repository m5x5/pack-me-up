import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatTripDate, formatTripDates, tripDatesOutOfOrder, tripIsPast } from './tripDetails'

describe('formatTripDate', () => {
    it('formats a YYYY-MM-DD string as a local calendar date', () => {
        expect(formatTripDate('2026-07-12')).toBe(new Date(2026, 6, 12).toLocaleDateString())
    })

    it('does not shift the day for dates that would cross a UTC boundary', () => {
        // Parsed as UTC midnight this would render as the 31st in any negative offset
        expect(formatTripDate('2026-01-01')).toBe(new Date(2026, 0, 1).toLocaleDateString())
    })

    it('returns null for an empty or malformed value', () => {
        expect(formatTripDate('')).toBeNull()
        expect(formatTripDate('not-a-date')).toBeNull()
        expect(formatTripDate(undefined)).toBeNull()
    })
})

describe('formatTripDates', () => {
    const d = (y: number, m: number, day: number) => new Date(y, m, day).toLocaleDateString()

    it('returns null when neither date is set', () => {
        expect(formatTripDates(undefined, undefined)).toBeNull()
    })

    it('joins a start and end date with an en dash', () => {
        expect(formatTripDates('2026-07-12', '2026-07-19')).toBe(`${d(2026, 6, 12)} – ${d(2026, 6, 19)}`)
    })

    it('shows a single date when start and end are the same day', () => {
        expect(formatTripDates('2026-07-12', '2026-07-12')).toBe(d(2026, 6, 12))
    })

    it('prefixes a lone start date with "From"', () => {
        expect(formatTripDates('2026-07-12', undefined)).toBe(`From ${d(2026, 6, 12)}`)
    })

    it('prefixes a lone end date with "Until"', () => {
        expect(formatTripDates(undefined, '2026-07-19')).toBe(`Until ${d(2026, 6, 19)}`)
    })

    it('ignores an unparseable date', () => {
        expect(formatTripDates('nonsense', '2026-07-19')).toBe(`Until ${d(2026, 6, 19)}`)
    })
})

describe('tripDatesOutOfOrder', () => {
    it('is false when either date is missing', () => {
        expect(tripDatesOutOfOrder(undefined, '2026-07-19')).toBe(false)
        expect(tripDatesOutOfOrder('2026-07-12', undefined)).toBe(false)
        expect(tripDatesOutOfOrder(undefined, undefined)).toBe(false)
    })

    it('is false when the end date is on or after the start date', () => {
        expect(tripDatesOutOfOrder('2026-07-12', '2026-07-19')).toBe(false)
        expect(tripDatesOutOfOrder('2026-07-12', '2026-07-12')).toBe(false)
    })

    it('is true when the end date is before the start date', () => {
        expect(tripDatesOutOfOrder('2026-07-19', '2026-07-12')).toBe(true)
    })
})

describe('tripIsPast', () => {
    afterEach(() => vi.useRealTimers())

    it('is true when the trip ended before today', () => {
        vi.useFakeTimers({ now: new Date(2026, 6, 31) })
        expect(tripIsPast('2026-07-12', '2026-07-19')).toBe(true)
    })

    it('is false while the trip is still running or upcoming', () => {
        vi.useFakeTimers({ now: new Date(2026, 6, 31) })
        expect(tripIsPast('2026-07-28', '2026-08-08')).toBe(false)
        expect(tripIsPast('2026-08-02', '2026-08-08')).toBe(false)
    })

    it('is false on the end date itself', () => {
        vi.useFakeTimers({ now: new Date(2026, 6, 31) })
        expect(tripIsPast('2026-07-28', '2026-07-31')).toBe(false)
    })

    it('falls back to the start date when there is no end date', () => {
        vi.useFakeTimers({ now: new Date(2026, 6, 31) })
        expect(tripIsPast('2026-07-12', undefined)).toBe(true)
        expect(tripIsPast('2026-08-02', undefined)).toBe(false)
    })

    it('is false when the list has no trip dates', () => {
        expect(tripIsPast(undefined, undefined)).toBe(false)
    })
})
