import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyPolicyPage } from './privacy-policy'

function renderPage() {
    return render(<MemoryRouter><PrivacyPolicyPage /></MemoryRouter>)
}

describe('PrivacyPolicyPage', () => {
    it('renders the privacy policy heading', () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeTruthy()
    })

    it('mentions where data is stored', () => {
        renderPage()

        expect(screen.getByRole('heading', { name: 'Where your data is stored' })).toBeTruthy()
        expect(screen.getAllByText(/Solid Pod/).length).toBeGreaterThan(0)
    })

    it('provides a contact email', () => {
        renderPage()

        const link = screen.getByRole('link', { name: 'tim.packmeup@gmail.com' })
        expect(link.getAttribute('href')).toBe('mailto:tim.packmeup@gmail.com')
    })

    it('points users at the page where they can delete their data', () => {
        renderPage()

        const links = screen.getAllByRole('link', { name: 'Your data' })
        expect(links.length).toBeGreaterThan(0)
        for (const link of links) {
            expect(link.getAttribute('href')).toBe('/your-data')
        }
    })
})
