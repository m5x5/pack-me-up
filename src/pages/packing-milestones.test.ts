import { describe, it, expect } from 'vitest'
import { reachedMilestone, resolveMilestone, MILESTONE_MESSAGES } from './packing-milestones'

describe('reachedMilestone', () => {
    it('gives nothing away below the first threshold', () => {
        expect(reachedMilestone(0)).toBeNull()
        expect(reachedMilestone(24)).toBeNull()
    })

    it('awards each milestone exactly on its threshold', () => {
        expect(reachedMilestone(25)).toBe(25)
        expect(reachedMilestone(50)).toBe(50)
        expect(reachedMilestone(75)).toBe(75)
    })

    it('holds the highest milestone earned between thresholds', () => {
        expect(reachedMilestone(49)).toBe(25)
        expect(reachedMilestone(74)).toBe(50)
        expect(reachedMilestone(99)).toBe(75)
    })

    it('has copy for every milestone it can award', () => {
        for (const percent of [25, 50, 75]) {
            expect(MILESTONE_MESSAGES[reachedMilestone(percent)!]).toBeTruthy()
        }
    })
})

describe('resolveMilestone', () => {
    it('starts from whatever the current progress has earned', () => {
        expect(resolveMilestone(null, 0, 40)).toBeNull()
        expect(resolveMilestone(null, 10, 40)).toBe(25)
        expect(resolveMilestone(null, 30, 40)).toBe(75)
    })

    it('upgrades immediately on crossing the next threshold', () => {
        expect(resolveMilestone(25, 20, 40)).toBe(50)
        expect(resolveMilestone(50, 30, 40)).toBe(75)
    })

    it('keeps the milestone when a single item is unticked past the boundary', () => {
        // 10/40 earns 25%; dropping to 9/40 (23%) must not blink the copy away
        expect(resolveMilestone(25, 9, 40)).toBe(25)
        expect(resolveMilestone(50, 19, 40)).toBe(50)
        expect(resolveMilestone(75, 29, 40)).toBe(75)
    })

    it('gives the milestone up once progress falls further than one item short', () => {
        expect(resolveMilestone(25, 8, 40)).toBeNull()
        expect(resolveMilestone(50, 18, 40)).toBe(25)
        expect(resolveMilestone(75, 28, 40)).toBe(50)
    })

    it('does not flicker across repeated toggles around a boundary', () => {
        let milestone = resolveMilestone(null, 20, 40)
        expect(milestone).toBe(50)
        for (let i = 0; i < 3; i++) {
            milestone = resolveMilestone(milestone, 19, 40)
            expect(milestone).toBe(50)
            milestone = resolveMilestone(milestone, 20, 40)
            expect(milestone).toBe(50)
        }
    })

    it('drops back to nothing when the list is emptied of packed items', () => {
        expect(resolveMilestone(75, 0, 40)).toBeNull()
    })

    it('treats an empty list as having earned nothing', () => {
        expect(resolveMilestone(null, 0, 0)).toBeNull()
    })

    it('still awards 75% at full completion, leaving the caller to hide it', () => {
        expect(resolveMilestone(50, 40, 40)).toBe(75)
    })
})
