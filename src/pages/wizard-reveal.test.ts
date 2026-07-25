import { describe, it, expect } from 'vitest'
import { buildRevealSteps, buildGenerationSummary, MAX_REVEAL_STEPS } from './wizard-reveal'
import { createExampleData } from '../edit-questions/example-data'
import { Person, PackingListQuestionSet } from '../edit-questions/types'

function person(overrides: Partial<Person> & { id: string; name: string }): Person {
    return { ageRange: 'Adult', ...overrides }
}

function setFor(people: Person[]): PackingListQuestionSet {
    return createExampleData(people, [])
}

describe('buildRevealSteps', () => {
    it('names each person from the generated set', () => {
        const steps = buildRevealSteps(setFor([
            person({ id: '1', name: 'Sam' }),
            person({ id: '2', name: 'Ellie', ageRange: 'Toddler' }),
        ]))

        expect(steps.map(s => s.name)).toEqual(['Sam', 'Ellie'])
    })

    it('describes a person by their age bracket when no birthday is known', () => {
        const [step] = buildRevealSteps(setFor([person({ id: '1', name: 'Ellie', ageRange: 'Toddler' })]))

        expect(step.descriptor).toBe('toddler')
        expect(step.text).toContain('Ellie (toddler)')
    })

    it('describes a person by their age in years when a birthday is known', () => {
        const today = new Date('2026-07-25T00:00:00Z')
        const [step] = buildRevealSteps(
            setFor([person({ id: '1', name: 'Ellie', ageRange: 'Child', dateOfBirth: '2022-01-10' })]),
            today
        )

        expect(step.descriptor).toBe('4')
        expect(step.text).toContain('Ellie (4)')
    })

    it('describes a pet by its species', () => {
        const [, step] = buildRevealSteps(setFor([
            person({ id: '1', name: 'Sam' }),
            { id: '2', name: 'Rex', species: 'dog' },
        ]))

        expect(step.descriptor).toBe('dog')
        expect(step.text).toContain('Rex (dog)')
    })

    it('names the items that are specific to that person', () => {
        const steps = buildRevealSteps(setFor([
            person({ id: '1', name: 'Sam' }),
            person({ id: '2', name: 'Ellie', ageRange: 'Baby' }),
        ]))

        const ellie = steps.find(s => s.name === 'Ellie')!
        expect(ellie.items.join(' ').toLowerCase()).toContain('nappies')
        expect(ellie.text).toMatch(/adding .*nappies/i)
    })

    it('picks different items for people in different age brackets', () => {
        const steps = buildRevealSteps(setFor([
            person({ id: '1', name: 'Sam' }),
            person({ id: '2', name: 'Ellie', ageRange: 'Baby' }),
        ]))

        const sam = steps.find(s => s.name === 'Sam')!
        const ellie = steps.find(s => s.name === 'Ellie')!
        expect(sam.items).not.toEqual(ellie.items)
    })

    it('strips parenthetical qualifiers from item names', () => {
        const steps = buildRevealSteps(setFor([person({ id: '1', name: 'Ellie', ageRange: 'Baby' })]))

        expect(steps[0].items.some(i => i.includes('('))).toBe(false)
    })

    it('caps the number of steps so the reveal stays short', () => {
        const people = Array.from({ length: 8 }, (_, i) => person({ id: String(i), name: `P${i}` }))

        expect(buildRevealSteps(setFor(people))).toHaveLength(MAX_REVEAL_STEPS)
    })

    it('returns no steps for a set with no people', () => {
        expect(buildRevealSteps(setFor([]))).toEqual([])
    })

    it('still produces readable text for a person with no distinctive items', () => {
        const questionSet: PackingListQuestionSet = {
            people: [person({ id: '1', name: 'Sam' })],
            alwaysNeededItems: [],
            questions: [],
        }
        const [step] = buildRevealSteps(questionSet)

        expect(step.items).toEqual([])
        expect(step.text).toContain('Sam')
        expect(step.text).not.toContain('adding')
    })
})

describe('buildGenerationSummary', () => {
    it('counts questions, people and pets', () => {
        const summary = buildGenerationSummary(setFor([
            person({ id: '1', name: 'Sam' }),
            person({ id: '2', name: 'Ali' }),
            { id: '3', name: 'Rex', species: 'dog' },
        ]))

        expect(summary.peopleCount).toBe(2)
        expect(summary.petCount).toBe(1)
        expect(summary.questionCount).toBeGreaterThan(0)
        expect(summary.itemCount).toBeGreaterThan(0)
        expect(summary.text).toContain('2 people and 1 pet')
    })

    it('uses singular wording for a single person and no pets', () => {
        const summary = buildGenerationSummary(setFor([person({ id: '1', name: 'Sam' })]))

        expect(summary.text).toContain('1 person')
        expect(summary.text).not.toContain('pet')
    })

    it('pluralises pets', () => {
        const summary = buildGenerationSummary(setFor([
            person({ id: '1', name: 'Sam' }),
            { id: '2', name: 'Rex', species: 'dog' },
            { id: '3', name: 'Mog', species: 'cat' },
        ]))

        expect(summary.text).toContain('2 pets')
    })

    it('counts every generated question and item', () => {
        const questionSet: PackingListQuestionSet = {
            people: [person({ id: '1', name: 'Sam' })],
            alwaysNeededItems: [{ text: 'Snacks', personSelections: [] }],
            questions: [
                {
                    id: 'q1',
                    type: 'saved',
                    text: 'Overnight?',
                    order: 0,
                    options: [
                        { id: 'o1', text: 'Yes', order: 0, items: [{ text: 'Toothbrush', personSelections: [] }] },
                        { id: 'o2', text: 'No', order: 1, items: [] },
                    ],
                },
            ],
        }

        const summary = buildGenerationSummary(questionSet)
        expect(summary.questionCount).toBe(1)
        expect(summary.itemCount).toBe(2)
        expect(summary.text).toContain('1 question and 2 items')
    })
})
