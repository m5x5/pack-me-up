import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Navigation } from './Navigation'

vi.mock('./SolidPodContext', () => ({
    useSolidPod: vi.fn(),
}))

vi.mock('./SolidProviderSelector', () => ({
    SolidProviderSelector: () => null,
}))

vi.mock('../services/solidPod', () => ({
    getPodOwnerProfile: vi.fn().mockResolvedValue({ name: null, photo: null }),
}))

vi.mock('./DatabaseContext', () => ({
    useDatabase: vi.fn().mockReturnValue({
        db: { getSharedWithMe: vi.fn().mockResolvedValue({ contexts: [], lastModified: '' }) },
        loginSyncVersion: 0,
        loginSyncInProgress: false,
    }),
}))

import { useSolidPod } from './SolidPodContext'
import { getPodOwnerProfile } from '../services/solidPod'

const mockUseSolidPod = vi.mocked(useSolidPod)
const mockGetPodOwnerProfile = vi.mocked(getPodOwnerProfile)

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

    // In a normal browser tab the browser's own chrome sits above the page, but
    // Chrome on Android still reports a non-zero safe-area-inset-top, which left
    // a tall empty band above the logo. The inset is applied through a class so
    // CSS can limit it to the cases that actually draw under the status bar.
    it('leaves the status-bar inset to CSS rather than an inline style', () => {
        const { container } = render(
            <MemoryRouter>
                <Navigation />
            </MemoryRouter>
        )

        const nav = container.querySelector('nav')!
        expect(nav.style.paddingTop).toBe('')
        expect(nav.className).toContain('safe-area-top')
    })

    it('uses a shorter header row on mobile than on desktop', () => {
        const { container } = render(
            <MemoryRouter>
                <Navigation />
            </MemoryRouter>
        )

        const row = container.querySelector('nav .flex.items-center.justify-between')!
        expect(row.className).toContain('h-14')
        expect(row.className).toContain('md:h-16')
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

    describe('profile dropdown', () => {
        const loggedIn = () => {
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
        }

        it('shows a profile button with a friendly name instead of the raw address and logout button', () => {
            loggedIn()
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            const profile = screen.getByRole('button', { name: /account menu/i })
            expect(within(profile).getByText('user')).toBeTruthy()
            // The raw WebID and a Logout button only appear once the menu opens
            // (the mobile menu still carries its own copies, so scope to the bar)
            expect(profile.textContent).not.toContain('profile/card#me')
            expect(screen.queryByRole('menu')).toBeNull()
        })

        it('reflects the WebID username as-is, without lowercasing', () => {
            mockUseSolidPod.mockReturnValue({
                session: null,
                isLoggedIn: true,
                sessionExpired: false,
                clearSessionExpired: vi.fn(),
                webId: 'https://pods.example.org/TestUser/profile/card#me',
                isLoading: false,
                login: vi.fn(),
                logout: vi.fn(),
            })
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            const profile = screen.getByRole('button', { name: /account menu/i })
            expect(within(profile).getByText('TestUser')).toBeTruthy()
        })

        it("shows the profile's name and photo when the profile provides them", async () => {
            mockGetPodOwnerProfile.mockResolvedValueOnce({ name: 'Alice Smith', photo: 'https://pod.example/photo.jpg' })
            mockUseSolidPod.mockReturnValue({
                session: {} as never,
                isLoggedIn: true,
                sessionExpired: false,
                clearSessionExpired: vi.fn(),
                webId: 'https://user.solidpod.example/profile/card#me',
                isLoading: false,
                login: vi.fn(),
                logout: vi.fn(),
            })
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            const profile = screen.getByRole('button', { name: /account menu/i })
            expect(await within(profile).findByText('Alice Smith')).toBeTruthy()
            const avatar = profile.querySelector('img')
            expect(avatar?.getAttribute('src')).toBe('https://pod.example/photo.jpg')
        })

        it('opens a dropdown with the full address, Backups, Sharing and Logout', () => {
            loggedIn()
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            fireEvent.click(screen.getByRole('button', { name: /account menu/i }))

            const menu = screen.getByRole('menu')
            expect(within(menu).getByText('https://user.solidpod.example/profile/card#me')).toBeTruthy()
            expect(within(menu).getByRole('menuitem', { name: 'Backups' })).toBeTruthy()
            expect(within(menu).getByRole('menuitem', { name: 'Sharing' })).toBeTruthy()
            expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeTruthy()
        })

        it('shows the profile name and photo instead of the raw address in the mobile menu', async () => {
            mockGetPodOwnerProfile.mockResolvedValueOnce({ name: 'Alice Smith', photo: 'https://pod.example/photo.jpg' })
            mockUseSolidPod.mockReturnValue({
                session: {} as never,
                isLoggedIn: true,
                sessionExpired: false,
                clearSessionExpired: vi.fn(),
                webId: 'https://user.solidpod.example/profile/card#me',
                isLoading: false,
                login: vi.fn(),
                logout: vi.fn(),
            })
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            const mobileIdentity = await screen.findByTitle('https://user.solidpod.example/profile/card#me')
            expect(within(mobileIdentity).getByText('Alice Smith')).toBeTruthy()
            const avatar = mobileIdentity.querySelector('img')
            expect(avatar?.getAttribute('src')).toBe('https://pod.example/photo.jpg')
            expect(mobileIdentity.textContent).not.toContain('profile/card#me')
        })

        it('keeps Backups and Sharing out of the desktop link row', () => {
            loggedIn()
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            // Only the mobile menu copies remain outside the dropdown
            expect(screen.getAllByText('Backups')).toHaveLength(1)
            expect(screen.getAllByText('Sharing')).toHaveLength(1)
        })

        it('logs out from the dropdown', () => {
            const logout = vi.fn().mockResolvedValue(undefined)
            mockUseSolidPod.mockReturnValue({
                session: null,
                isLoggedIn: true,
                sessionExpired: false,
                clearSessionExpired: vi.fn(),
                webId: 'https://user.solidpod.example/profile/card#me',
                isLoading: false,
                login: vi.fn(),
                logout,
            })
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
            fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }))

            expect(logout).toHaveBeenCalled()
        })

        it('closes when clicking outside', () => {
            loggedIn()
            render(<MemoryRouter><Navigation /></MemoryRouter>)

            fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
            expect(screen.getByRole('menu')).toBeTruthy()

            fireEvent.mouseDown(document.body)
            expect(screen.queryByRole('menu')).toBeNull()
        })
    })
})
