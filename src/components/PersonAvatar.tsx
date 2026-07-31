import { useState } from 'react'
import type { PersonColor } from '../edit-questions/person-colors'

/**
 * A person's coloured initial — the same mark the questions page puts beside
 * every item, so a packing list can be read the same way: find your colour,
 * that's your pile. When the person has a WebID with a profile photo, the
 * photo takes the initial's place (still ringed in their colour).
 *
 * Decorative, always: everywhere it appears the person's name is written
 * beside it, so announcing the initial as well would only make a screen
 * reader say "A, Alice's Items".
 */
export function PersonAvatar({ name, color, size = 'md', photoUrl }: {
    name: string
    color: PersonColor
    size?: 'sm' | 'md'
    photoUrl?: string | null
}) {
    // The photo may live behind pod auth or 404; fall back to the initial
    const [photoFailed, setPhotoFailed] = useState(false)
    const dimensions = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
    if (photoUrl && !photoFailed) {
        return (
            <img
                data-testid="person-avatar"
                src={photoUrl}
                title={name}
                alt=""
                aria-hidden="true"
                onError={() => setPhotoFailed(true)}
                className={`rounded-full object-cover select-none shrink-0 ${dimensions}`}
            />
        )
    }
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
