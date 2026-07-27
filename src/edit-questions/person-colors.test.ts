import { describe, it, expect } from 'vitest'
import type { Person } from './types'
import {
    PERSON_COLORS,
    LEGACY_AVATAR_ROTATION,
    personColorAt,
    personColorFor,
    personColorForName,
    buildPersonColorLookup,
} from './person-colors'

const person = (over: Partial<Person> = {}): Person => ({ id: 'p1', name: 'Alice', ...over })

describe('person-colors palette', () => {
    it('gives every colour a unique id and a distinct avatar class', () => {
        const ids = PERSON_COLORS.map(c => c.id)
        expect(new Set(ids).size).toBe(ids.length)
        const avatars = PERSON_COLORS.map(c => c.avatar)
        expect(new Set(avatars).size).toBe(avatars.length)
    })

    it('keeps the first six positions on the colours people already have', () => {
        // Anyone who has never picked a colour keeps the one they have been
        // looking at, so adding the picker doesn't repaint their question set.
        expect(PERSON_COLORS.slice(0, LEGACY_AVATAR_ROTATION.length).map(c => c.avatar))
            .toEqual([...LEGACY_AVATAR_ROTATION])
    })

    it('rotates the default colour by position, wrapping past the end', () => {
        expect(personColorAt(0)).toBe(PERSON_COLORS[0])
        expect(personColorAt(PERSON_COLORS.length)).toBe(PERSON_COLORS[0])
        expect(personColorAt(PERSON_COLORS.length + 2)).toBe(PERSON_COLORS[2])
    })
})

describe('personColorFor', () => {
    it('falls back to the position when the person has not chosen', () => {
        expect(personColorFor(person(), 3)).toBe(personColorAt(3))
    })

    it('uses the person’s own colour when they have chosen one', () => {
        const chosen = PERSON_COLORS[5]
        expect(personColorFor(person({ color: chosen.id }), 0)).toBe(chosen)
    })

    it('falls back to the position for a colour it does not know', () => {
        // A colour added by a newer client, arriving over the pod. Better a
        // sensible default than a person with no avatar at all.
        const unknown = { ...person(), color: 'ultraviolet' } as Person
        expect(personColorFor(unknown, 1)).toBe(personColorAt(1))
    })
})

describe('personColorForName', () => {
    it('is stable for the same name', () => {
        expect(personColorForName('Bob')).toBe(personColorForName('Bob'))
    })

    it('is a real palette colour for any name, including an empty one', () => {
        for (const name of ['', 'Bob', 'Zoë', '👻', 'a very long name indeed']) {
            expect(PERSON_COLORS).toContain(personColorForName(name))
        }
    })
})

describe('buildPersonColorLookup', () => {
    const people: Person[] = [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob', color: PERSON_COLORS[7].id },
        { id: 'p3', name: 'Cara' },
    ]

    it('resolves a known person by id', () => {
        const lookup = buildPersonColorLookup(people)
        expect(lookup({ id: 'p1', name: 'Alice' })).toBe(personColorAt(0))
        expect(lookup({ id: 'p2', name: 'Bob' })).toBe(PERSON_COLORS[7])
        expect(lookup({ id: 'p3', name: 'Cara' })).toBe(personColorAt(2))
    })

    it('resolves by name when the id is missing', () => {
        // A packing list item carries the name it was generated with; its
        // personId is empty on custom items added straight to the list.
        const lookup = buildPersonColorLookup(people)
        expect(lookup({ id: '', name: 'Bob' })).toBe(PERSON_COLORS[7])
    })

    it('gives someone the question set has never heard of a stable colour', () => {
        const lookup = buildPersonColorLookup(people)
        expect(lookup({ id: 'guest-1', name: 'Zoe' })).toBe(personColorForName('Zoe'))
    })

    it('hands a listed stranger a colour nobody on the list is using', () => {
        // Alice and Cara hold positions 0 and 2; Bob chose position 7's colour.
        const lookup = buildPersonColorLookup(people, [{ id: 'guest-1', name: 'Zoe' }])
        const zoe = lookup({ id: 'guest-1', name: 'Zoe' })
        expect(zoe).toBe(personColorAt(1))
        expect([personColorAt(0), personColorAt(2), PERSON_COLORS[7]]).not.toContain(zoe)
    })

    it('gives two strangers different colours', () => {
        const lookup = buildPersonColorLookup(people, [
            { id: 'guest-1', name: 'Zoe' },
            { id: 'guest-2', name: 'Yan' },
        ])
        expect(lookup({ id: 'guest-1', name: 'Zoe' }))
            .not.toBe(lookup({ id: 'guest-2', name: 'Yan' }))
    })

    it('does not re-colour someone the question set already places', () => {
        const lookup = buildPersonColorLookup(people, [
            { id: 'p2', name: 'Bob' },
            { id: 'guest-1', name: 'Zoe' },
        ])
        expect(lookup({ id: 'p2', name: 'Bob' })).toBe(PERSON_COLORS[7])
    })

    it('falls back to the hash once every colour is spoken for', () => {
        const crowd = PERSON_COLORS.map((color, i) => ({ id: `p${i}`, name: `P${i}`, color: color.id }))
        const lookup = buildPersonColorLookup(crowd, [{ id: 'guest-1', name: 'Zoe' }])
        expect(lookup({ id: 'guest-1', name: 'Zoe' })).toBe(personColorForName('Zoe'))
    })

    it('skips deleted people when numbering the defaults', () => {
        // Deleted people are gone from every list of people on screen, so
        // leaving a gap in the rotation for one would shift everyone after it.
        const lookup = buildPersonColorLookup([
            { id: 'p0', name: 'Ghost', deletedAt: '2025-01-01T00:00:00.000Z' },
            ...people,
        ])
        expect(lookup({ id: 'p1', name: 'Alice' })).toBe(personColorAt(0))
    })
})
