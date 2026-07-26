/**
 * Colours for the section headings in the questions editor.
 *
 * Sections used to be a line of 11px grey capitals with a hairline beside it,
 * which is roughly how you'd style a caption you wanted people to skip. A
 * section is the thing that decides how the packing list is grouped, so it gets
 * a card of its own with a coloured heading strip instead.
 *
 * The colour is derived from the section *name*, not its position, so
 * "Toiletries" is the same colour under every option and in every list. That's
 * what makes the grouping legible at a glance across a long page — you learn a
 * section by its colour and can then follow it without reading. A fixed palette
 * means two names can collide; that costs nothing, because colour here is a
 * grouping cue on top of a heading that already says the name.
 *
 * Every class is written out in full: Tailwind scans source text, so a class
 * assembled from a colour variable would simply not exist at runtime.
 */

export interface SectionAccent {
    /** Card outline. */
    border: string
    /** Heading strip fill. */
    header: string
    /** Heading text on that fill. */
    text: string
    /** Secondary text on that fill — the item count. */
    muted: string
    /** Solid marker, used where a heading stands alone rather than atop a card. */
    rail: string
}

/**
 * Deliberately avoids blue and emerald: those already mean "shared" and "per
 * night" on the item badges inside these very lists, and a section heading in
 * the same colour would suggest a link that isn't there.
 */
export const SECTION_ACCENTS: readonly SectionAccent[] = [
    { border: 'border-violet-200', header: 'bg-violet-50', text: 'text-violet-900', muted: 'text-violet-500', rail: 'bg-violet-400' },
    { border: 'border-amber-200', header: 'bg-amber-50', text: 'text-amber-900', muted: 'text-amber-600', rail: 'bg-amber-400' },
    { border: 'border-rose-200', header: 'bg-rose-50', text: 'text-rose-900', muted: 'text-rose-500', rail: 'bg-rose-400' },
    { border: 'border-cyan-200', header: 'bg-cyan-50', text: 'text-cyan-900', muted: 'text-cyan-600', rail: 'bg-cyan-400' },
    { border: 'border-lime-200', header: 'bg-lime-50', text: 'text-lime-900', muted: 'text-lime-600', rail: 'bg-lime-500' },
    { border: 'border-fuchsia-200', header: 'bg-fuchsia-50', text: 'text-fuchsia-900', muted: 'text-fuchsia-500', rail: 'bg-fuchsia-400' },
    { border: 'border-indigo-200', header: 'bg-indigo-50', text: 'text-indigo-900', muted: 'text-indigo-500', rail: 'bg-indigo-400' },
    { border: 'border-orange-200', header: 'bg-orange-50', text: 'text-orange-900', muted: 'text-orange-600', rail: 'bg-orange-400' },
]

/**
 * The default section — the option's or question's own name — is the main pile
 * rather than something the user chose to separate out, so it stays neutral.
 * That way colour on this page always means "someone named this group".
 */
export const DEFAULT_SECTION_ACCENT: SectionAccent = {
    border: 'border-gray-200',
    header: 'bg-gray-100',
    text: 'text-gray-700',
    muted: 'text-gray-400',
    rail: 'bg-gray-300',
}

/** Plain string hash — stable across reloads, machines and stored data. */
function hashLabel(label: string): number {
    let hash = 0
    for (let i = 0; i < label.length; i++) {
        hash = (hash * 31 + label.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

export function sectionAccent(label: string, isDefault: boolean): SectionAccent {
    if (isDefault) return DEFAULT_SECTION_ACCENT
    return SECTION_ACCENTS[hashLabel(label) % SECTION_ACCENTS.length]
}
