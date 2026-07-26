import { describe, it, expect } from 'vitest'
import { wizardSchema } from './wizard-types'

const person = (name: string) => ({ kind: 'person' as const, name, ageRange: 'Adult' as const, gender: 'female' as const })

describe('wizardSchema', () => {
    it('requires at least one person or pet', () => {
        const result = wizardSchema.safeParse({ people: [] })
        expect(result.success).toBe(false)
    })

    it('accepts a large group — big families are not capped', () => {
        const people = Array.from({ length: 25 }, (_, i) => person(`Person ${i + 1}`))
        expect(wizardSchema.safeParse({ people }).success).toBe(true)
    })

    it('still requires an age range or birthday for each person', () => {
        const result = wizardSchema.safeParse({
            people: [{ kind: 'person', name: 'Sam', gender: 'female' }],
        })
        expect(result.success).toBe(false)
    })
})
