import { describe, it, expect } from 'vitest'
import { peopleToWizardEntries } from './wizard-prefill'
import { Person } from '../edit-questions/types'

describe('peopleToWizardEntries', () => {
    it('maps a person to a person entry, keeping age range, gender and birthday', () => {
        const people: Person[] = [
            { id: '1', name: 'Sam', ageRange: 'Adult', gender: 'female', dateOfBirth: '1990-04-02' },
        ]

        expect(peopleToWizardEntries(people)).toEqual([
            { kind: 'person', name: 'Sam', ageRange: 'Adult', gender: 'female', dateOfBirth: '1990-04-02' },
        ])
    })

    it('maps a pet to a pet entry with its species', () => {
        const people: Person[] = [
            { id: '1', name: 'Rex', species: 'dog' },
        ]

        expect(peopleToWizardEntries(people)).toEqual([
            { kind: 'pet', name: 'Rex', species: 'dog' },
        ])
    })

    it('leaves unset age range, gender and birthday as the empty select value', () => {
        const people: Person[] = [{ id: '1', name: 'Alex' }]

        expect(peopleToWizardEntries(people)).toEqual([
            { kind: 'person', name: 'Alex', ageRange: '', gender: undefined, dateOfBirth: '' },
        ])
    })

    it('skips soft-deleted people and pets', () => {
        const people: Person[] = [
            { id: '1', name: 'Sam', ageRange: 'Adult' },
            { id: '2', name: 'Gone', ageRange: 'Child', deletedAt: '2025-01-01T00:00:00.000Z' },
            { id: '3', name: 'Rex', species: 'dog', deletedAt: '2025-01-01T00:00:00.000Z' },
        ]

        expect(peopleToWizardEntries(people).map(e => e.name)).toEqual(['Sam'])
    })

    it('preserves the order of the existing group', () => {
        const people: Person[] = [
            { id: '1', name: 'Sam', ageRange: 'Adult' },
            { id: '2', name: 'Rex', species: 'dog' },
            { id: '3', name: 'Ellie', ageRange: 'Baby' },
        ]

        expect(peopleToWizardEntries(people).map(e => e.name)).toEqual(['Sam', 'Rex', 'Ellie'])
    })

    it('returns an empty array when there is nobody left to prefill', () => {
        expect(peopleToWizardEntries([])).toEqual([])
        expect(peopleToWizardEntries([
            { id: '1', name: 'Gone', deletedAt: '2025-01-01T00:00:00.000Z' },
        ])).toEqual([])
    })
})
