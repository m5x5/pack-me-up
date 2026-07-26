/**
 * Edits addressed at a single item, rather than at the whole option that
 * contains it.
 *
 * The editor modals rewrite an entire item list on save, which is the right
 * unit when you are adding ten items at once. Changing one word in one item is
 * the far more common job, and these helpers are what let the read-only lists
 * do it in place — see `ItemInlineEditor`.
 */
import {
    applySectionLayout,
    buildSectionSequence,
    moveItemToSection,
} from './item-sections'
import { renumberItemOrder, type Item, type Option, type Question } from './types'

/**
 * Replace one question's options, stamping `lastModified` on that question.
 *
 * The stamp is the point. `mergeQuestionSets` resolves questions by per-question
 * LWW and only falls back to the document-level tiebreak when a question carries
 * no timestamp of its own — and that fallback takes *every* contested question
 * from the same side. So two devices editing items under two different questions
 * would see one device's edit silently dropped. Stamping the question that
 * actually changed keeps each one resolved on its own merits.
 *
 * Untouched questions keep their object identity, so the memoized question
 * sections on the page skip re-rendering.
 */
export function withQuestionOptions(
    questions: Question[],
    questionId: string,
    updateOptions: (options: Option[]) => Option[],
    now: string,
): Question[] {
    return questions.map(question =>
        question.id === questionId
            ? { ...question, options: updateOptions(question.options), lastModified: now }
            : question
    )
}

/**
 * Add a new item to the bottom of one section.
 *
 * `category` names the section — `undefined` for the list's default one, which
 * is stored as no category at all rather than as the default's name (see the
 * note on `applySectionLayout`).
 *
 * The item is inserted after the last item already in that section rather than
 * pushed onto the end, because the array position is what the section views
 * bucket by: appending would put an item typed under Toiletries below whichever
 * section happens to come last. Renumbering afterwards is what makes the
 * generated packing list agree, since it sorts by the stamped `order` and would
 * otherwise sort the new item into its section at a stale position. Items whose
 * position is unchanged keep their identity and their old timestamp.
 */
export function appendItemToSection(
    items: Item[],
    newItem: Item,
    category: string | undefined,
    defaultLabel: string,
    now: string,
): Item[] {
    const placed: Item = {
        ...newItem,
        ...(category !== undefined ? { category } : {}),
        lastModified: now,
    }
    const targetLabel = category ?? defaultLabel

    // A section with nothing in it yet — one just named, or the very first item
    // of the list — has no run to join, so it starts one at the end.
    let insertAt = items.length
    for (let i = items.length - 1; i >= 0; i--) {
        if ((items[i].category ?? defaultLabel) === targetLabel) {
            insertAt = i + 1
            break
        }
    }

    return renumberItemOrder(
        [...items.slice(0, insertAt), placed, ...items.slice(insertAt)],
        now,
    )
}

/**
 * Apply an edit to the item at `index`.
 *
 * When the edit leaves the item in the same section this is a straight
 * replacement, so every other item keeps its identity and only the edited row
 * re-renders.
 *
 * When the edit changes the item's section it has to become a move: the
 * generated packing list orders items by their stamped `order`, not by array
 * position, so re-stamping the category alone would leave the item sorted into
 * its new section at its old position. Routing the move through the same
 * sequence helpers the drag view uses lands it at the bottom of the target
 * section — the same place dragging it there would — and renumbers the list.
 */
export function applyItemEdit(
    items: Item[],
    index: number,
    edited: Item,
    defaultLabel: string,
    now: string,
): Item[] {
    const current = items[index]
    if (!current) return items

    const stamped: Item = { ...edited, lastModified: now }
    const targetLabel = edited.category ?? defaultLabel
    if (targetLabel === (current.category ?? defaultLabel)) {
        return items.map((item, i) => (i === index ? stamped : item))
    }

    // Put the edit in place still wearing its *old* category, so the sequence
    // buckets it where it currently lives and the move below is what relocates
    // it. `applySectionLayout` then stamps the new category on the way out.
    const { category: _pending, ...withoutCategory } = stamped
    const placeholder: Item = current.category !== undefined
        ? { ...withoutCategory, category: current.category }
        : withoutCategory
    const withEdit = items.map((item, i) => (i === index ? placeholder : item))

    // A section the user has just named has no items yet and so no header to
    // move under; offering it as a draft section gives the move a destination.
    const drafts = targetLabel === defaultLabel ? [] : [targetLabel]
    const sequence = buildSectionSequence(withEdit, defaultLabel, drafts)
    const seqIndex = sequence.findIndex(e => e.kind === 'item' && e.item === placeholder)
    if (seqIndex === -1) return items

    const moved = moveItemToSection(sequence, seqIndex, targetLabel, defaultLabel)
    return renumberItemOrder(applySectionLayout(moved, defaultLabel, now), now)
}
