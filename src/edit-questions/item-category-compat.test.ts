/**
 * Backwards-compatibility guards for `Item.category` (packing list sections).
 *
 * Sections are stored by stamping a category onto each item rather than by
 * inserting heading rows or marking section boundaries. These tests pin the
 * two properties that choice buys us, both of which matter because old
 * clients (notably installed mobile builds) never disappear:
 *
 *   1. Adding categories is *purely additive* — it introduces no new items and
 *      changes nothing else about the serialized shape. An old client, whose
 *      RDF reader ignores the unknown predicate, therefore sees exactly the
 *      question set it saw before.
 *   2. When an old client rewrites an item it drops the category, and the
 *      damage is limited to that one item — neighbours in the same section are
 *      untouched. A boundary marker would have lost the whole section.
 */
import { describe, it, expect } from 'vitest'
import { getThingAll, getUrlAll } from '@inrupt/solid-client'
import type { SolidDataset } from '@inrupt/solid-client'
import { questionSetToDataset, datasetToQuestionSet } from '../services/rdfSerialization'
import { PMU, RDF } from '../services/rdfVocab'
import { mergeQuestionSets } from '../utils/mergeQuestionSets'
import type { PackingListQuestionSet, Item } from './types'

const QS_URL = 'https://pod.example/pack-me-up/question-set.ttl'

function makeQs(alwaysNeededItems: Item[]): PackingListQuestionSet {
    return {
        _id: '1',
        people: [{ id: 'p1', name: 'Alice' }],
        questions: [],
        alwaysNeededItems,
        lastModified: '2024-01-01T00:00:00.000Z',
    }
}

const baseItems: Item[] = [
    { id: 'i1', text: 'Nappies', order: 0, personSelections: [{ personId: 'p1', selected: true }] },
    { id: 'i2', text: 'Baby wipes', order: 1, personSelections: [{ personId: 'p1', selected: true }] },
    { id: 'i3', text: 'First aid kit', order: 2, communal: true, personSelections: [] },
]

const sectionedItems: Item[] = [
    { ...baseItems[0], category: 'Baby' },
    { ...baseItems[1], category: 'Baby' },
    { ...baseItems[2], category: 'First aid' },
]

function roundTrip(qs: PackingListQuestionSet): PackingListQuestionSet {
    return datasetToQuestionSet(questionSetToDataset(qs, QS_URL) as SolidDataset, QS_URL)
}

function stripCategory(items: Item[]): Item[] {
    return items.map(({ category: _category, ...rest }) => rest)
}

describe('Item.category – additive on the wire', () => {
    it('changes nothing but the category itself, so an old reader sees the pre-section data', () => {
        const withoutSections = roundTrip(makeQs(baseItems))
        const withSections = roundTrip(makeQs(sectionedItems))

        // Guard against this passing vacuously: the categories must have
        // survived the round-trip for the comparison below to mean anything.
        expect(withSections.alwaysNeededItems.map(i => i.category))
            .toEqual(['Baby', 'Baby', 'First aid'])

        // An old client ignores pmu:category on read; everything it *does* read
        // must be byte-for-byte what it saw before sections existed.
        expect(stripCategory(withSections.alwaysNeededItems))
            .toEqual(withoutSections.alwaysNeededItems)
    })

    it('adds no extra items — sectioning never changes the item count', () => {
        const withSections = roundTrip(makeQs(sectionedItems))
        expect(withSections.alwaysNeededItems).toHaveLength(baseItems.length)
        expect(withSections.alwaysNeededItems.map(i => i.text))
            .toEqual(['Nappies', 'Baby wipes', 'First aid kit'])
    })

    it('emits no extra QuestionItem things in the dataset', () => {
        const plain = questionSetToDataset(makeQs(baseItems), QS_URL) as SolidDataset
        const sectioned = questionSetToDataset(makeQs(sectionedItems), QS_URL) as SolidDataset

        const questionItemCount = (ds: SolidDataset) =>
            getThingAll(ds).filter(t => getUrlAll(t, RDF.type).includes(PMU.QuestionItem)).length

        expect(questionItemCount(sectioned)).toBe(questionItemCount(plain))
    })
})

describe('Item.category – blast radius when an old client drops it', () => {
    it('loses the category only on the item the old client actually rewrote', () => {
        // Pod holds the sectioned set. Local is an old client that edited one
        // item's text: it rewrote that item without the category it never read,
        // and its newer lastModified wins under per-item LWW.
        const pod = makeQs(sectionedItems.map(i => ({ ...i, lastModified: '2024-01-01T00:00:00.000Z' })))
        const local = makeQs([
            { ...baseItems[0], text: 'Nappies (size 4)', lastModified: '2024-06-01T00:00:00.000Z' },
            { ...sectionedItems[1], lastModified: '2024-01-01T00:00:00.000Z' },
            { ...sectionedItems[2], lastModified: '2024-01-01T00:00:00.000Z' },
        ])

        const merged = mergeQuestionSets(local, pod)
        const byId = new Map(merged.alwaysNeededItems.map(i => [i.id, i]))

        // The edited item wins and has lost its section...
        expect(byId.get('i1')?.text).toBe('Nappies (size 4)')
        expect(byId.get('i1')?.category).toBeUndefined()
        // ...but its section-mate is untouched, and so is the rest of the set.
        expect(byId.get('i2')?.category).toBe('Baby')
        expect(byId.get('i3')?.category).toBe('First aid')
    })

    it('keeps the category when the new client is the one that wrote last', () => {
        const pod = makeQs([{ ...sectionedItems[0], lastModified: '2024-06-01T00:00:00.000Z' }])
        const local = makeQs([{ ...baseItems[0], lastModified: '2024-01-01T00:00:00.000Z' }])

        const merged = mergeQuestionSets(local, pod)
        expect(merged.alwaysNeededItems[0].category).toBe('Baby')
    })
})
