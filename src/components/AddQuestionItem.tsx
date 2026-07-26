/**
 * The one way items get added to a question set from the questions page.
 *
 * Adding an item here used to mean opening the option's editor modal, scrolling
 * to the bottom of its list, tapping "+ Add Item" for a blank row, typing into
 * it, and saving the whole option — and the row landed in whichever section the
 * list happened to end with, so putting an item in a *particular* section then
 * needed a second trip through the row editor or the drag view. This is that
 * job in one line, in place, with the section already decided by where the
 * composer was opened.
 *
 * Its two jobs, in order of how much typing they save:
 *
 *  - *Where it lands.* Either fixed (opened from a section's own ＋) or picked
 *    here, and stamped on the item — see `appendItemToSection`.
 *  - *How much typing.* The question set is its own dictionary, so a matched
 *    name arrives with the section it is filed under everywhere else, and one
 *    tap files it there — even into a section this list has not used yet.
 *
 * What the item is *for* is deliberately not here: a new item goes to everyone,
 * as it always has, and who-it's-for and how-many live one tap away in the row
 * the item just landed in. Adding them would put four controls in front of
 * someone whose next move, nine times in ten, is to type the next item.
 *
 * The draft lives in this component and at most one is mounted at a time, so a
 * keystroke re-renders one composer rather than every question on the page.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { FIELD_BASE, ItemNameField } from './ItemNameField'
import type { ItemSuggestion, SuggestionIndex } from '../utils/itemSuggestions'

const FIELD = `${FIELD_BASE} focus:ring-primary-500`

/** Room to leave under the field for its suggestion list and a phone keyboard. */
const ROOM_BELOW = 260

interface AddQuestionItemProps {
    /** Section the item lands in; undefined = the list's default section. */
    category?: string
    /** Providing these turns on the section picker. */
    sectionOptions?: readonly string[]
    /** What this list calls items carrying no section of their own. */
    defaultLabel: string
    suggestions: SuggestionIndex
    /** Which list this is, so its own names aren't offered back to it. */
    ownerKey: string
    /** Names the composer for screen readers, e.g. "Toiletries". */
    targetLabel: string
    onAdd: (text: string, category: string | undefined) => void
    onClose?: () => void
    autoFocus?: boolean
    placeholder?: string
}

export const AddQuestionItem = memo(function AddQuestionItem({
    category,
    sectionOptions,
    defaultLabel,
    suggestions,
    ownerKey,
    targetLabel,
    onAdd,
    onClose,
    autoFocus,
    placeholder,
}: AddQuestionItemProps) {
    const [text, setText] = useState('')
    const [chosenLabel, setChosenLabel] = useState(category ?? defaultLabel)
    const inputRef = useRef<HTMLInputElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)

    // A composer opens at the bottom of its section, which for a long section on
    // a phone is at or below the fold — and the browser's own focus scroll only
    // brings it just barely into view, where the keyboard then covers it. Pull it
    // up far enough that the field, its suggestions and the keyboard all fit;
    // leave it alone when there is already room, so opening one near the top of
    // the screen doesn't jump the page for no reason.
    useEffect(() => {
        const el = rootRef.current
        if (!autoFocus || !el?.scrollIntoView) return
        const { top, bottom } = el.getBoundingClientRect()
        if (top < 0 || bottom + ROOM_BELOW > window.innerHeight) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
    }, [autoFocus])

    const picking = sectionOptions !== undefined
    // The default section is offered by name, so "the main pile" is a choice
    // rather than the absence of one. A section a suggestion brought with it is
    // offered too, even if this list has never used it — that is how a name
    // filed under Toiletries elsewhere lands in Toiletries here.
    const labels = picking
        ? [...new Set([defaultLabel, ...sectionOptions, chosenLabel])]
        : []
    const targetCategory = picking
        ? (chosenLabel === defaultLabel ? undefined : chosenLabel)
        : category

    const applySuggestion = (suggestion: ItemSuggestion) => {
        // A suggestion knows where it belongs, and carrying that across is the
        // whole point of offering it. Only when there is a picker to show it in:
        // silently moving an item out of the section its ＋ was tapped in would
        // be a change nobody could see.
        if (picking && suggestion.category) setChosenLabel(suggestion.category)
    }

    const submit = () => {
        const trimmed = text.trim()
        if (!trimmed) return
        onAdd(trimmed, targetCategory)
        setText('')
        inputRef.current?.focus()
    }

    // A composer left empty has served its purpose; one with half an item in it
    // has not, and must not take the draft with it.
    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        if (!text.trim()) onClose?.()
    }

    // At rest this is one field and an Add button, so it fits a phone's width
    // without wrapping. The section picker earns its space only once there is an
    // item to file, which is also the first moment it can be answered.
    const expanded = text.trim().length > 0

    return (
        <div
            ref={rootRef}
            data-testid="add-question-item"
            onBlur={handleBlur}
            className="flex flex-wrap items-center gap-2"
        >
            <div className={`min-w-[8rem] ${expanded && picking ? 'basis-full' : 'flex-1 basis-40'}`}>
                <ItemNameField
                    value={text}
                    onChange={setText}
                    suggestions={suggestions}
                    ownerKey={ownerKey}
                    onPick={applySuggestion}
                    onSubmit={submit}
                    onClose={onClose}
                    // Named as a field, not as the action: the ＋ that opened it
                    // is the button called "add an item to Toiletries".
                    label={`New item in ${targetLabel}`}
                    listboxId={`add-question-item-${ownerKey}-${category ?? 'any'}`}
                    inputRef={inputRef}
                    autoFocus={autoFocus}
                    placeholder={placeholder ?? 'Add an item...'}
                    inputClassName={FIELD}
                />
            </div>

            {expanded && picking && (
                <select
                    aria-label="Section"
                    value={chosenLabel}
                    onChange={e => setChosenLabel(e.target.value)}
                    className={`min-w-0 flex-1 sm:flex-none sm:max-w-[13rem] ${FIELD}`}
                >
                    {labels.map(label => (
                        <option key={label} value={label}>{label}</option>
                    ))}
                </select>
            )}

            <button
                type="button"
                onClick={submit}
                className="shrink-0 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium"
            >
                Add
            </button>
        </div>
    )
})
