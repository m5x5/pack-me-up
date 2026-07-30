import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import type { AppSession as Session } from '../types/AppSession'

vi.mock('../components/SolidPodContext', () => ({
    useSolidPod: vi.fn(),
}))

vi.mock('../components/ToastContext', () => ({
    useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

vi.mock('../hooks/usePodErrorHandler', () => ({
    usePodErrorHandler: vi.fn(() => vi.fn()),
}))

vi.mock('../services/solidPod', () => ({
    getPrimaryPodUrl: vi.fn(),
}))

vi.mock('../services/dataDeletion', () => ({
    deleteAllLocalData: vi.fn(),
    deleteAllPodData: vi.fn(),
}))

import { YourDataPage } from './your-data'
import { useSolidPod } from '../components/SolidPodContext'
import { getPrimaryPodUrl } from '../services/solidPod'
import { deleteAllLocalData, deleteAllPodData } from '../services/dataDeletion'
import { usePodErrorHandler } from '../hooks/usePodErrorHandler'

const mockUseSolidPod = vi.mocked(useSolidPod)
const mockGetPrimaryPodUrl = vi.mocked(getPrimaryPodUrl)
const mockDeleteAllLocalData = vi.mocked(deleteAllLocalData)
const mockDeleteAllPodData = vi.mocked(deleteAllPodData)
const mockUsePodErrorHandler = vi.mocked(usePodErrorHandler)

const session = {} as Session

function givenLoggedIn(podUrl: string | null = 'https://alice.example/') {
    mockUseSolidPod.mockReturnValue({
        isLoggedIn: true,
        session,
        webId: 'https://alice.example/profile/card#me',
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
    })
    mockGetPrimaryPodUrl.mockResolvedValue(podUrl)
}

function givenLoggedOut() {
    mockUseSolidPod.mockReturnValue({
        isLoggedIn: false,
        session: null,
        webId: null,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
    })
    mockGetPrimaryPodUrl.mockResolvedValue(null)
}

/** Clicks a button by its accessible name. */
function click(name: RegExp) {
    fireEvent.click(screen.getByRole('button', { name }))
}

describe('YourDataPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDeleteAllLocalData.mockResolvedValue(undefined)
        mockDeleteAllPodData.mockResolvedValue(undefined)
        vi.spyOn(window.location, 'reload').mockImplementation(() => {})
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('explains how to delete data without requiring a login', () => {
        givenLoggedOut()

        render(<YourDataPage />)

        // The page doubles as the public data-deletion URL, so a visitor who has
        // never signed in still has to find every route out.
        expect(screen.getByRole('button', { name: /delete all data on this device/i })).toBeTruthy()
        expect(screen.getByText(/clear storage/i)).toBeTruthy()
        expect(screen.getByText(/tim\.packmeup@gmail\.com/)).toBeTruthy()
    })

    it('does not offer to delete crash reports or analytics, which carry nothing to find them by', () => {
        givenLoggedOut()

        render(<YourDataPage />)

        // No setUser call and sendDefaultPii unset means these events have no
        // name, account or IP on them — a deletion request has nothing to match.
        expect(screen.getByText(/no IP address/i)).toBeTruthy()
        // The in-app feedback form is the one place an email is collected, and so
        // the one deletion request here that can actually be actioned.
        expect(screen.getByText(/feedback form/i)).toBeTruthy()
    })

    it('offers no pod deletion button when signed out, but says how to do it anyway', () => {
        givenLoggedOut()

        render(<YourDataPage />)

        expect(screen.queryByRole('button', { name: /from my pod/i })).toBeNull()
        expect(screen.getByText(/pack-me-up/)).toBeTruthy()
    })

    it('asks for confirmation before deleting anything', () => {
        givenLoggedOut()

        render(<YourDataPage />)
        click(/delete all data on this device/i)

        expect(mockDeleteAllLocalData).not.toHaveBeenCalled()
        expect(screen.getByText(/can't be undone/i)).toBeTruthy()
    })

    it('deletes local data once confirmed, then reloads so nothing holds a destroyed database', async () => {
        givenLoggedOut()

        render(<YourDataPage />)
        click(/delete all data on this device/i)
        click(/^delete$/i)

        await waitFor(() => expect(mockDeleteAllLocalData).toHaveBeenCalledOnce())
        await waitFor(() => expect(window.location.reload).toHaveBeenCalled())
    })

    it('deletes pod data once confirmed', async () => {
        givenLoggedIn()

        render(<YourDataPage />)
        await waitFor(() => screen.getByRole('button', { name: /from my pod/i }))
        click(/from my pod/i)
        click(/^delete$/i)

        await waitFor(() => expect(mockDeleteAllPodData).toHaveBeenCalledWith(session, 'https://alice.example/'))
        expect(mockDeleteAllLocalData).not.toHaveBeenCalled()
    })

    it('deletes the pod copy before the local one, so login sync cannot restore it', async () => {
        givenLoggedIn()
        const order: string[] = []
        mockDeleteAllPodData.mockImplementation(async () => { order.push('pod') })
        mockDeleteAllLocalData.mockImplementation(async () => { order.push('local') })

        render(<YourDataPage />)
        await waitFor(() => screen.getByRole('button', { name: /delete everything/i }))
        click(/delete everything/i)
        click(/^delete$/i)

        await waitFor(() => expect(order).toEqual(['pod', 'local']))
    })

    it('warns a signed-in user that a device-only deletion comes back on next login', async () => {
        givenLoggedIn()

        render(<YourDataPage />)

        await waitFor(() => expect(screen.getByText(/sync back/i)).toBeTruthy())
    })

    it('reports a failed pod deletion instead of claiming success', async () => {
        givenLoggedIn()
        const handlePodError = vi.fn()
        mockUsePodErrorHandler.mockReturnValue(handlePodError)
        const failure = new Error('nope')
        mockDeleteAllPodData.mockRejectedValue(failure)

        render(<YourDataPage />)
        await waitFor(() => screen.getByRole('button', { name: /from my pod/i }))
        click(/from my pod/i)
        click(/^delete$/i)

        await waitFor(() => expect(handlePodError).toHaveBeenCalledWith(failure, expect.stringMatching(/pod/i)))
        expect(window.location.reload).not.toHaveBeenCalled()
    })

    it('does not attempt a pod deletion when no pod can be resolved', async () => {
        givenLoggedIn(null)

        render(<YourDataPage />)
        await waitFor(() => screen.getByRole('button', { name: /from my pod/i }))
        click(/from my pod/i)
        click(/^delete$/i)

        await waitFor(() => expect(mockDeleteAllPodData).not.toHaveBeenCalled())
    })
})
