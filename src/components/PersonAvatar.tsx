import type { PersonColor } from '../edit-questions/person-colors'

/**
 * A person's coloured initial — the same mark the questions page puts beside
 * every item, so a packing list can be read the same way: find your colour,
 * that's your pile.
 *
 * Decorative, always: everywhere it appears the person's name is written
 * beside it, so announcing the initial as well would only make a screen
 * reader say "A, Alice's Items".
 */
export function PersonAvatar({ name, color, size = 'md' }: {
    name: string
    color: PersonColor
    size?: 'sm' | 'md'
}) {
    const dimensions = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
    return (
        <span
            data-testid="person-avatar"
            title={name}
            aria-hidden="true"
            className={`inline-flex items-center justify-center rounded-full font-bold select-none shrink-0 ${dimensions} ${color.avatar}`}
        >
            {name.charAt(0).toUpperCase() || '?'}
        </span>
    )
}
