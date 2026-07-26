/**
 * The one way items get added to a packing list.
 *
 * Three things made adding an item harder than it should be, and this component
 * exists to fix all three:
 *
 *  - *Where it lands.* A typed item used to fall into "Other" whatever card you
 *    typed it into, so adding to a particular section was impossible. Here the
 *    section is either fixed by where the composer was opened (a section's own
 *    ＋ button) or picked from a dropdown, and it is stamped onto the item.
 *  - *How much typing.* The list is its own dictionary — see `itemSuggestions` —
 *    so a match carries its section across and the quantity is set here rather
 *    than in a second trip through the item editor.
 *  - *What it costs to type.* The draft lives in this component. The page used
 *    to hold every add-input's text in one page-level object, so a keystroke in
 *    any of them re-rendered every card and every row of the list. Memoised and
 *    self-contained, a keystroke now re-renders one composer.
 *
 * Adding keeps the composer open, focused and cleared, with the section and
 * person still selected, because people add items in runs rather than one at a
 * time.
 */
import { memo, useMemo, useRef, useState } from 'react'
import { ownerKeyFor, suggestFor, type ItemSuggestion, type SuggestionIndex } from '../utils/itemSuggestions'

/** What the packing list calls the section for items with no category. */
export const UNCATEGORISED_LABEL = 'Other'

export interface AddItemTarget {
    personName: string
    personId: string
    communal?: boolean
    /** undefined = the catch-all section */
    category?: string
}

export interface PersonOption {
    name: string
    id: string
}

interface AddItemComposerProps {
    /** Who the item is for, unless `peopleOptions` offers a choice. */
    personName: string
    personId: string
    communal?: boolean
    /** Section the item lands in, and the initial value of the section picker. */
    category?: string
    /** Providing these turns on the section picker. */
    categoryOptions?: readonly string[]
    /** Providing these turns on the person picker. */
    peopleOptions?: readonly PersonOption[]
    suggestions: SuggestionIndex
    /** Names the composer for screen readers, e.g. "Alice" or "Toiletries for Alice". */
    targetLabel: string
    onAdd: (target: AddItemTarget, text: string, quantity?: number) => void
    /** Set on composers opened in place, which dismiss on Escape or empty blur. */
    onClose?: () => void
    autoFocus?: boolean
    placeholder?: string
}

const FIELD = 'px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500'

export const AddItemComposer = memo(function AddItemComposer({
    personName,
    personId,
    communal,
    category,
    categoryOptions,
    peopleOptions,
    suggestions,
    targetLabel,
    onAdd,
    onClose,
    autoFocus,
    placeholder = 'Add new item...',
}: AddItemComposerProps) {
    const [text, setText] = useState('')
    const [quantity, setQuantity] = useState('')
    const [chosenCategory, setChosenCategory] = useState(category ?? UNCATEGORISED_LABEL)
    // Held by name, not id: custom items carry no person id, so a name is the
    // only thing that identifies a person on every list.
    const [chosenPersonName, setChosenPersonName] = useState(personName)
    const [highlighted, setHighlighted] = useState(-1)
    const [suggestionsOpen, setSuggestionsOpen] = useState(true)
    const inputRef = useRef<HTMLInputElement>(null)

    const person: PersonOption = peopleOptions?.find(p => p.name === chosenPersonName)
        ?? peopleOptions?.[0]
        ?? { name: personName, id: personId }

    const target: AddItemTarget = {
        personName: communal ? '' : person.name,
        personId: communal ? '' : person.id,
        communal,
        category: categoryOptions
            ? (chosenCategory === UNCATEGORISED_LABEL ? undefined : chosenCategory)
            : category,
    }

    const ownerKey = ownerKeyFor(target)
    const matches = useMemo(
        () => suggestionsOpen ? suggestFor(suggestions, ownerKey, text) : [],
        [suggestions, ownerKey, text, suggestionsOpen],
    )

    const setDraft = (value: string) => {
        setText(value)
        setHighlighted(-1)
        setSuggestionsOpen(true)
    }

    const applySuggestion = (suggestion: ItemSuggestion) => {
        setText(suggestion.text)
        setSuggestionsOpen(false)
        setHighlighted(-1)
        // A suggestion knows where it belongs; taking its section is the whole
        // point of offering it. Only meaningful when a section can be chosen —
        // an in-place composer already has one.
        if (categoryOptions && suggestion.category && categoryOptions.includes(suggestion.category)) {
            setChosenCategory(suggestion.category)
        }
        inputRef.current?.focus()
    }

    const submit = () => {
        const trimmed = text.trim()
        if (!trimmed) return
        const parsed = parseInt(quantity, 10)
        onAdd(target, trimmed, Number.isFinite(parsed) && parsed > 1 ? parsed : undefined)
        setText('')
        setQuantity('')
        setHighlighted(-1)
        setSuggestionsOpen(true)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' && matches.length > 0) {
            e.preventDefault()
            setHighlighted(prev => (prev + 1) % matches.length)
            return
        }
        if (e.key === 'ArrowUp' && matches.length > 0) {
            e.preventDefault()
            setHighlighted(prev => (prev <= 0 ? matches.length : prev) - 1)
            return
        }
        if (e.key === 'Enter') {
            e.preventDefault()
            const picked = matches[highlighted]
            if (picked) applySuggestion(picked)
            else submit()
            return
        }
        if (e.key === 'Escape') {
            e.preventDefault()
            // Escape backs out one layer at a time: the suggestions first, then
            // the composer — so dismissing a dropdown never loses what was typed.
            if (matches.length > 0) {
                setSuggestionsOpen(false)
                setHighlighted(-1)
                return
            }
            onClose?.()
        }
    }

    // An in-place composer that has been left empty has served its purpose; one
    // with half an item in it has not, and must not take the draft with it.
    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setSuggestionsOpen(false)
        if (!text.trim()) onClose?.()
    }

    const listboxId = `add-item-suggestions-${personId || 'shared'}-${category ?? 'any'}`

    // At rest a composer is a single field, exactly as light as the plain input
    // it replaces — there is one on every card, and a card is mostly items. The
    // quantity and the pickers earn their space only once there is an item to
    // apply them to, which is also the first moment they can be answered.
    const expanded = text.trim().length > 0

    return (
        <div
            data-testid="add-item-composer"
            onBlur={handleBlur}
            className="flex flex-wrap items-center gap-2"
        >
            {/* At rest the name shares its line with Add, so a card carries no
                more furniture than the plain input it replaces. Once the
                quantity and pickers are in play the name takes the line to
                itself and they wrap underneath — three fields abreast is
                unusable on a phone, and it is where the suggestions drop. */}
            <div className={`relative min-w-[8rem] ${expanded ? 'basis-full' : 'flex-1 basis-40'}`}>
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={matches.length > 0}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-label={`Add an item to ${targetLabel}`}
                    autoComplete="off"
                    enterKeyHint="done"
                    value={text}
                    autoFocus={autoFocus}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={`w-full ${FIELD}`}
                />
                {matches.length > 0 && (
                    <ul
                        id={listboxId}
                        role="listbox"
                        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                    >
                        {matches.map((suggestion, i) => (
                            <li key={suggestion.text}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={i === highlighted}
                                    // Blur would close the list before the click landed.
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => applySuggestion(suggestion)}
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${i === highlighted ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate">{suggestion.text}</span>
                                    {suggestion.category && (
                                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                            {suggestion.category}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {expanded && <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Quantity"
                title="How many to pack (leave blank for one)"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                placeholder="Qty"
                className={`w-16 shrink-0 ${FIELD}`}
            />}

            {expanded && categoryOptions && (
                <select
                    aria-label="Section"
                    value={chosenCategory}
                    onChange={e => setChosenCategory(e.target.value)}
                    className={`min-w-0 flex-1 sm:flex-none sm:max-w-[11rem] ${FIELD}`}
                >
                    {categoryOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            )}

            {expanded && peopleOptions && peopleOptions.length > 0 && (
                <select
                    aria-label="Who for"
                    value={person.name}
                    onChange={e => setChosenPersonName(e.target.value)}
                    className={`min-w-0 flex-1 sm:flex-none sm:max-w-[9rem] ${FIELD}`}
                >
                    {peopleOptions.map(option => (
                        <option key={option.name} value={option.name}>{option.name}</option>
                    ))}
                </select>
            )}

            <button
                type="button"
                onClick={submit}
                className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
                Add
            </button>
        </div>
    )
})
