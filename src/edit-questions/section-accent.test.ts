import { describe, it, expect } from 'vitest'
import { SECTION_ACCENTS, DEFAULT_SECTION_ACCENT, sectionAccent } from './section-accent'

describe('sectionAccent', () => {
    it('gives the same section the same colour everywhere', () => {
        // The whole point: "Toiletries" under one option must look like
        // "Toiletries" under another, so the eye can follow it down the page.
        expect(sectionAccent('Toiletries', false)).toBe(sectionAccent('Toiletries', false))
    })

    it('gives the default section a neutral accent, whatever it is called', () => {
        // Colour means "a section someone named". The default section is just
        // the main pile, so it must not compete for attention.
        expect(sectionAccent('Yes', true)).toBe(DEFAULT_SECTION_ACCENT)
        expect(sectionAccent('Toiletries', true)).toBe(DEFAULT_SECTION_ACCENT)
    })

    it('never hands a named section the neutral accent', () => {
        for (const label of ['Toiletries', 'Clothes', 'Kit & Gear', '', 'ẞ']) {
            expect(sectionAccent(label, false)).not.toBe(DEFAULT_SECTION_ACCENT)
        }
    })

    it('spreads the built-in section names across the palette', () => {
        // Sections that sit next to each other should mostly differ. Collisions
        // are unavoidable with a fixed palette; a heavily bunched hash is not.
        const labels = ['Documents & Money', 'Medicines & First Aid', 'Tech & Chargers',
            'Toiletries', 'Clothes', 'Sleep & Comfort', 'Toys & Games', 'Food & Kitchen']
        const distinct = new Set(labels.map(l => sectionAccent(l, false)))
        expect(distinct.size).toBeGreaterThanOrEqual(SECTION_ACCENTS.length - 2)
    })

    it('keeps every palette entry a complete set of classes', () => {
        // Tailwind only emits classes it can see spelled out, so these are
        // literals rather than something built from a colour name.
        for (const accent of [...SECTION_ACCENTS, DEFAULT_SECTION_ACCENT]) {
            expect(accent.border).toMatch(/^border-/)
            expect(accent.header).toMatch(/^bg-/)
            expect(accent.text).toMatch(/^text-/)
            expect(accent.muted).toMatch(/^text-/)
            expect(accent.rail).toMatch(/^bg-/)
        }
    })
})
