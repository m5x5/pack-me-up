import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Navigation } from './Navigation'

vi.mock('./SolidPodContext', () => ({
    useSolidPod: vi.fn(),
}))

vi.mock('./SolidProviderSelector', () => ({
    SolidProviderSelector: () => null,
}))

vi.mock('./DatabaseContext', () => ({
    useDatabase: vi.fn().mockReturnValue({
        db: { getSharedWithMe: vi.fn().mockResolvedValue({ contexts: [], lastModified: '' }) },
        loginSyncVersion: 0,
        loginSyncInProgress: false,
    }),
}))

import { useSolidPod } from './SolidPodContext'

const mockUseSolidPod = vi.mocked(useSolidPod)

describe('Navigation', () => {
    beforeEach(() => {
        mockUseSolidPod.mockReturnValue({
            session: null,
            isLoggedIn: false,
            sessionExpired: false,
            clearSessionExpired: vi.fn(),
            webId: undefined,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        })
    })

    it('hides Backups link when not logged in', () => {
        render(
            <MemoryRouter>
                <Navigation />
            </MemoryRouter>
        )

        expect(screen.queryByText('Backups')).toBeNull()
    })

    it('shows "My Questions & Items" nav link instead of "Edit Questions"', () => {
        render(
            <MemoryRouter>
                <Navigation />
            </MemoryRouter>
        )

        expect(screen.getAllByText('My Questions & Items').length).toBeGreaterThan(0)
        expect(screen.queryByText('Edit Questions')).toBeNull()
    })

    // Feedback, the privacy policy and data deletion live in the Footer now —
    // they're once-in-a-while links, and the nav is for everyday ones. See
    // Footer.test.tsx for their coverage.
    it('keeps once-in-a-while links out of the nav', () => {
        render(
            <MemoryRouter>
                <Navigation />
            </MemoryRouter>
        )

        expect(screen.queryByRole('link', { name: /feedback/i })).toBeNull()
        expect(screen.queryByRole('link', { name: /privacy/i })).toBeNull()
        expect(screen.queryByRole('link', { name: /delete my data/i })).toBeNull()
    })

    it('shows Backups link when logged in', () => {
        mockUseSolidPod.mockReturnValue({
            session: null,
            isLoggedIn: true,
            sessionExpired: false,
            clearSessionExpired: vi.fn(),
            webId: 'https://user.solidpod.example/profile/card#me',
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        })

        render(
            <MemoryRouter>
                <Navigation />
            </MemoryRouter>
        )

        expect(screen.getAllByText('Backups').length).toBeGreaterThan(0)
    })
})
