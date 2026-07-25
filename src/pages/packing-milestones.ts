// Encouragement shown in the packing view's progress strip on the way to 100%.
// The finished state has its own celebration, so there is no 100% milestone here.
export const PACKING_MILESTONES = [25, 50, 75] as const

export const MILESTONE_MESSAGES: Record<number, string> = {
    25: '🌱 Good start!',
    50: '💪 Halfway there!',
    75: '🔥 Nearly done!',
}

/** The highest milestone a given completion percentage has earned, if any. */
export function reachedMilestone(percentComplete: number): number | null {
    let reached: number | null = null
    for (const milestone of PACKING_MILESTONES) {
        if (percentComplete >= milestone) reached = milestone
    }
    return reached
}

/**
 * Milestone to display, given the one currently on screen.
 *
 * Unticking a single item near a boundary would otherwise make the copy blink
 * out and straight back in again, so a milestone is only given up once progress
 * falls more than one item short of it. Upgrades are immediate — reaching a
 * higher milestone should feel instant.
 */
export function resolveMilestone(
    current: number | null,
    packedCount: number,
    totalCount: number
): number | null {
    const percentComplete = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0
    const reached = reachedMilestone(percentComplete)

    if (current === null) return reached
    if (reached !== null && reached >= current) return reached

    const percentWithOneMore = totalCount > 0 ? Math.round(((packedCount + 1) / totalCount) * 100) : 0
    return percentWithOneMore >= current ? current : reached
}
