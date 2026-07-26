import { Person } from '../edit-questions/types'
import { WizardEntry } from './wizard-types'

/**
 * Turns the people already stored in a question set back into wizard form rows,
 * so someone re-running the wizard starts from the family they set up before
 * rather than from a blank 'Me'.
 *
 * Soft-deleted people are skipped — they're removed everywhere else in the app,
 * so they shouldn't reappear here. Unset values become '' (the untouched select
 * / empty date input) rather than undefined, which keeps the inputs controlled.
 *
 * Cast through unknown: `gender` is undefined for people who never picked one,
 * which the strict discriminated union doesn't model — the same compromise the
 * wizard makes when it seeds a new row.
 */
export function peopleToWizardEntries(people: Person[]): WizardEntry[] {
    return people
        .filter(person => !person.deletedAt)
        .map(person =>
            person.species
                ? { kind: 'pet', name: person.name, species: person.species }
                : {
                    kind: 'person',
                    name: person.name,
                    ageRange: person.ageRange ?? '',
                    gender: person.gender,
                    dateOfBirth: person.dateOfBirth ?? '',
                }
        ) as unknown as WizardEntry[]
}
