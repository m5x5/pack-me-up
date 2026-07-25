import { Item, PackingListQuestionSet, Person } from '../edit-questions/types'
import { ageInYears, currentAgeRange } from '../edit-questions/age-derivation'

/** Longest the staged reveal is allowed to run: steps × REVEAL_STEP_MS. */
export const MAX_REVEAL_STEPS = 4
export const REVEAL_STEP_MS = 700

/** How many item names each reveal line mentions. */
const ITEMS_PER_STEP = 2

export interface RevealStep {
    personId: string
    name: string
    /** Age in years, age bracket or pet species — whatever we actually know. */
    descriptor?: string
    items: string[]
    text: string
}

export interface GenerationSummary {
    questionCount: number
    itemCount: number
    peopleCount: number
    petCount: number
    text: string
}

function allItems(questionSet: PackingListQuestionSet): Item[] {
    return [
        ...questionSet.alwaysNeededItems,
        ...questionSet.questions.flatMap(q => q.options.flatMap(o => o.items)),
    ]
}

function livePeople(questionSet: PackingListQuestionSet): Person[] {
    return questionSet.people.filter(p => !p.deletedAt)
}

const SPECIES_LABELS: Record<string, string> = { dog: 'dog', cat: 'cat', other: 'pet' }

/**
 * How to refer to someone in the reveal: a pet by species, a person by their
 * age in whole years when a birthday is known (an infant reads better as
 * "baby" than "0"), otherwise by their bracket.
 */
export function describePerson(person: Person, today: Date = new Date()): string | undefined {
    if (person.species) return SPECIES_LABELS[person.species] ?? 'pet'
    if (person.dateOfBirth) {
        const years = ageInYears(person.dateOfBirth, today)
        if (years !== null && years >= 1) return String(years)
    }
    const bracket = currentAgeRange(person, today)
    return bracket ? bracket.toLowerCase() : undefined
}

/**
 * Item text as it reads mid-sentence: parenthetical qualifiers dropped
 * ("Nappies (pack/supply)" → "Nappies"), and the leading capital dropped only
 * when nothing else in the name is capitalised — so "Nappies" becomes
 * "nappies" while "Lead/Leash" and "EHIC/GHIC card" keep their shape.
 */
function readableItemText(text: string): string {
    const stripped = text.replace(/\s*\([^)]*\)/g, '').trim() || text.trim()
    const hasOtherCapitals = /[A-Z]/.test(stripped.slice(1))
    return hasOtherCapitals ? stripped : stripped.charAt(0).toLowerCase() + stripped.slice(1)
}

function joinWithAnd(parts: string[]): string {
    if (parts.length <= 1) return parts[0] ?? ''
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The items that say the most about this person: the ones fewest others share,
 * which is exactly what the age/species filters produce (nappies for the baby,
 * a lead for the dog). Ties keep template order, so the headline items in
 * `alwaysNeededItems` come first.
 */
function distinctiveItemsFor(personId: string, items: Item[]): string[] {
    const scored = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.personSelections.some(ps => ps.personId === personId && ps.selected))
        .map(({ item, index }) => ({
            text: readableItemText(item.text),
            sharedBy: item.personSelections.filter(ps => ps.selected).length,
            index,
        }))
        .sort((a, b) => a.sharedBy - b.sharedBy || a.index - b.index)

    const seen = new Set<string>()
    const picked: string[] = []
    for (const { text } of scored) {
        const key = text.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        picked.push(text)
        if (picked.length === ITEMS_PER_STEP) break
    }
    return picked
}

/**
 * One line per person naming what the wizard just built for them, e.g.
 * "Thinking about Ellie (4)… adding nappies and baby wipes". Capped at
 * MAX_REVEAL_STEPS so the reveal never becomes a wait.
 */
export function buildRevealSteps(
    questionSet: PackingListQuestionSet,
    today: Date = new Date()
): RevealStep[] {
    const items = allItems(questionSet)

    return livePeople(questionSet)
        .slice(0, MAX_REVEAL_STEPS)
        .map(person => {
            const descriptor = describePerson(person, today)
            const pickedItems = distinctiveItemsFor(person.id, items)
            const who = descriptor ? `${person.name} (${descriptor})` : person.name
            const text = pickedItems.length > 0
                ? `Thinking about ${who}… adding ${joinWithAnd(pickedItems)}`
                : `Thinking about ${who}…`
            return { personId: person.id, name: person.name, descriptor, items: pickedItems, text }
        })
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Concrete proof of what was generated, for the success screen. */
export function buildGenerationSummary(questionSet: PackingListQuestionSet): GenerationSummary {
    const people = livePeople(questionSet)
    const peopleCount = people.filter(p => !p.species).length
    const petCount = people.filter(p => p.species).length
    const questionCount = questionSet.questions.filter(q => !q.deletedAt).length
    const itemCount = allItems(questionSet).length

    const who = [
        peopleCount > 0 ? plural(peopleCount, 'person', 'people') : null,
        petCount > 0 ? plural(petCount, 'pet') : null,
    ].filter((part): part is string => part !== null)

    const what = `${plural(questionCount, 'question')} and ${plural(itemCount, 'item')}`
    return {
        questionCount,
        itemCount,
        peopleCount,
        petCount,
        text: who.length > 0 ? `${what} across ${who.join(' and ')}` : what,
    }
}
