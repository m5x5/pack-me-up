import { useEffect, useState } from 'react'
import type { AppSession } from '../types/AppSession'
import type { Person } from '../edit-questions/types'
import type { PackingAppDatabase } from '../services/database'
import { getPodOwnerProfile } from '../services/solidPod'

/**
 * Profile photos for people, looked up by name via their Solid WebIDs.
 *
 * A person on the questions page can carry a WebID; this hook follows those
 * WebIDs to their profile cards and returns whatever photos it finds
 * (vcard:hasPhoto and friends). People without a WebID — guests, pets, or a
 * profile without a photo — simply stay absent from the map, and callers fall
 * back to the coloured initial.
 */
export function useProfilePhotos(
    people: readonly Person[],
    session: AppSession | null | undefined,
): Record<string, string> {
    const [photoByName, setPhotoByName] = useState<Record<string, string>>({})

    // Who has which WebID, not the identity of the array holding them — the
    // callers often rebuild it every render.
    const rosterKey = people
        .filter(p => !p.deletedAt && p.webId)
        .map(p => `${p.name}:${p.webId}`)
        .join(',')

    useEffect(() => {
        if (!session || rosterKey === '') return
        let cancelled = false
        for (const person of people) {
            if (person.deletedAt || !person.webId) continue
            const { name, webId } = person
            getPodOwnerProfile(session, '', webId)
                .then(({ photo }) => {
                    if (photo && !cancelled) {
                        setPhotoByName(prev => ({ ...prev, [name]: photo }))
                    }
                })
                .catch(() => {})
        }
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rosterKey stands in for people
    }, [session, rosterKey])

    return photoByName
}

/**
 * The same map, but for the people of the stored question set — read live from
 * the database (like `usePersonColors`): a photo describes the person, not one
 * trip. For pages that already hold the people, use `useProfilePhotos`.
 */
export function usePersonProfilePhotos(
    db: PackingAppDatabase | undefined,
    session: AppSession | null | undefined,
): Record<string, string> {
    const [people, setPeople] = useState<Person[]>([])

    useEffect(() => {
        if (!db) return
        let cancelled = false
        Promise.resolve()
            .then(() => db.getQuestionSet())
            .then(questionSet => {
                if (!cancelled) setPeople(questionSet?.people ?? [])
            })
            .catch(() => { /* no question set: nobody has a photo */ })
        return () => { cancelled = true }
    }, [db, session])

    return useProfilePhotos(people, session)
}
