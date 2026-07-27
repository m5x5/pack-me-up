import { useEffect, useMemo, useState } from 'react'
import { buildPersonColorLookup, type ColorablePerson, type PersonColor } from '../edit-questions/person-colors'
import type { Person } from '../edit-questions/types'
import type { PackingAppDatabase } from '../services/database'

export type PersonColorLookup = (person: ColorablePerson) => PersonColor

const NO_ONE: readonly ColorablePerson[] = []

/**
 * How to colour the people a packing list mentions: the colours set on the
 * questions page, read live.
 *
 * Live rather than copied onto each list at generation, for the same reason the
 * section order is (see `useSectionOrder`) — a person's colour is a statement
 * about that person, not about one trip. Recolouring someone should reach the
 * list already open in front of you, not just the next one you make.
 *
 * `alsoOnThisList` is everyone the list names who isn't in the question set:
 * guests, and the whole cast of a list shared from someone else's pod. They get
 * whatever colours are left over, so no two people on one list collide.
 */
export function usePersonColors(
    db: PackingAppDatabase | undefined,
    alsoOnThisList: readonly ColorablePerson[] = NO_ONE,
): PersonColorLookup {
    const [people, setPeople] = useState<Person[]>([])

    useEffect(() => {
        if (!db) return
        let cancelled = false
        Promise.resolve()
            .then(() => db.getQuestionSet())
            .then(questionSet => {
                if (cancelled) return
                setPeople(questionSet?.people ?? [])
            })
            .catch(() => { /* nobody known: everyone is coloured as a stranger */ })
        return () => { cancelled = true }
    }, [db])

    // Who is on the list, not the identity of the array holding them — the
    // callers build it fresh whenever an item changes.
    const rosterKey = alsoOnThisList.map(p => `${p.id ?? ''}${p.name}`).join('')

    // eslint-disable-next-line react-hooks/exhaustive-deps -- rosterKey stands in for alsoOnThisList
    return useMemo(() => buildPersonColorLookup(people, alsoOnThisList), [people, rosterKey])
}
