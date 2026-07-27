import { useEffect, useState } from 'react'
import { CATEGORY_ORDER } from '../edit-questions/item-sections'
import { orderedSectionLabels } from '../edit-questions/section-order'
import type { PackingAppDatabase } from '../services/database'

/**
 * The order to group a packing list's sections in: the one setting on the
 * questions page, read live.
 *
 * Live rather than copied onto each list at generation, because the setting is
 * global — it is a statement about how this person wants *every* list grouped,
 * including the ones they already have. A copy would freeze each list at the
 * order in force the day it was made, so fixing the order would only ever fix
 * the next trip, and the list already open in front of you would stay wrong.
 *
 * That applies to a list shared from someone else's pod too: you are looking at
 * it, so it is grouped the way you asked for. Sections their question set has
 * and yours doesn't are not in the order at all, and fall in after the ones
 * that are — the same way any unlisted section does.
 *
 * Falls back to the built-in default until the question set has loaded, and for
 * anyone who has never arranged their sections.
 */
export function useSectionOrder(db: PackingAppDatabase | undefined): readonly string[] {
    const [sectionOrder, setSectionOrder] = useState<readonly string[]>(CATEGORY_ORDER)

    useEffect(() => {
        if (!db) return
        let cancelled = false
        Promise.resolve()
            .then(() => db.getQuestionSet())
            .then(questionSet => {
                if (cancelled) return
                // No stored order means no preference, and the built-in default
                // is what the list has always used — not the labels this set
                // happens to contain in the order they were found.
                setSectionOrder(questionSet.sectionOrder?.length
                    ? orderedSectionLabels(questionSet)
                    : CATEGORY_ORDER)
            })
            .catch(() => { if (!cancelled) setSectionOrder(CATEGORY_ORDER) })
        return () => { cancelled = true }
    }, [db])

    return sectionOrder
}
