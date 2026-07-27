import { PERSON_COLORS, type PersonColor, type PersonColorId } from '../edit-questions/person-colors'

/**
 * The palette behind a person's avatar in the People editor.
 *
 * Colour is the only thing on that page carrying a person's identity, so the
 * place to change it is the avatar itself rather than a field somewhere below
 * it. The grid opens under the person it belongs to and shows the whole palette
 * at once — twelve swatches are quicker to scan than a dropdown of colour names,
 * and the names are only there for screen readers.
 */
export function PersonColorSwatches({ personName, selected, onSelect }: {
    personName: string
    selected: PersonColor
    onSelect: (id: PersonColorId) => void
}) {
    return (
        <div
            role="group"
            aria-label={`Colour for ${personName}`}
            className="mt-2 ml-9 grid grid-cols-6 gap-1.5"
        >
            {PERSON_COLORS.map(color => {
                const isSelected = color.id === selected.id
                return (
                    <button
                        key={color.id}
                        type="button"
                        onClick={() => onSelect(color.id)}
                        aria-label={color.label}
                        aria-pressed={isSelected}
                        title={color.label}
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 ${color.avatar} ${isSelected ? `ring-2 ring-offset-1 ${color.ring}` : ''}`}
                    >
                        {isSelected ? '✓' : ''}
                    </button>
                )
            })}
        </div>
    )
}
