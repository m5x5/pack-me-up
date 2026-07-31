import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Footer, FEEDBACK_EMAIL } from './Footer'

function renderFooter() {
    return render(<MemoryRouter><Footer /></MemoryRouter>)
}

describe('Footer', () => {
    afterEach(() => {
        cleanup()
    })

    it('links to the privacy policy', () => {
        renderFooter()

        expect(screen.getByRole('link', { name: 'Privacy policy' }).getAttribute('href')).toBe('/privacy-policy')
    })

    it('links to the data deletion page, which is the URL Google Play is given', () => {
        renderFooter()

        expect(screen.getByRole('link', { name: 'Delete my data' }).getAttribute('href')).toBe('/your-data')
    })

    it('offers a way to get in touch', () => {
        renderFooter()

        expect(screen.getByRole('link', { name: 'Feedback' }).getAttribute('href')).toBe(`mailto:${FEEDBACK_EMAIL}`)
    })

    // Same story as the nav's top inset: a browser tab has its own chrome below
    // the page, so only the native shell and installed PWAs should reserve room
    // for the gesture bar. CSS decides that, not an inline style.
    it('leaves the gesture-bar inset to CSS rather than an inline style', () => {
        const { container } = renderFooter()

        const footer = container.querySelector('footer')!
        expect(footer.style.paddingBottom).toBe('')
        expect(footer.className).toContain('safe-area-bottom')
    })

    it('avoids reusing "Your data", which the pod switcher already uses for something else', () => {
        renderFooter()

        expect(screen.queryByRole('link', { name: /^your data$/i })).toBeNull()
    })
})
