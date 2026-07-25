import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import type { AppSession as Session } from '../types/AppSession'
import type { PackingAppDatabase } from '../services/database'

vi.mock('../components/SolidPodContext', () => ({
    useSolidPod: vi.fn(),
}))

vi.mock('../components/DatabaseContext', () => ({
    useDatabase: vi.fn(),
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

vi.mock('../services/solidPodBackup', () => ({
    createBackup: vi.fn(),
    listBackups: vi.fn(),
    deleteBackup: vi.fn(),
    restoreBackup: vi.fn(),
}))

import { BackupsPage } from './backups'
import { useSolidPod } from '../components/SolidPodContext'
import { useDatabase } from '../components/DatabaseContext'
import { getPrimaryPodUrl } from '../services/solidPod'
import { listBackups } from '../services/solidPodBackup'

const mockUseSolidPod = vi.mocked(useSolidPod)
const mockUseDatabase = vi.mocked(useDatabase)
const mockGetPrimaryPodUrl = vi.mocked(getPrimaryPodUrl)
const mockListBackups = vi.mocked(listBackups)

describe('BackupsPage loading state', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSolidPod.mockReturnValue({
            isLoggedIn: true,
            session: {} as Session,
            webId: 'https://pod.example/profile/card#me',
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        })
        mockUseDatabase.mockReturnValue({ db: {} as PackingAppDatabase })
        mockGetPrimaryPodUrl.mockResolvedValue('https://pod.example/')
    })

    afterEach(() => {
        cleanup()
    })

    it('uses the shared loading treatment while backups load', async () => {
        mockListBackups.mockReturnValue(new Promise(() => {}))

        render(<BackupsPage />)

        await waitFor(() => {
            expect(screen.getByRole('status').textContent).toContain('Loading backups...')
        })
        expect(screen.getAllByTestId('loading-skeleton-card').length).toBeGreaterThan(0)
    })

    it('replaces the loading treatment with the real content once backups arrive', async () => {
        mockListBackups.mockResolvedValue([])

        render(<BackupsPage />)

        await waitFor(() => expect(screen.getByText('No backups yet')).toBeTruthy())
        expect(screen.queryByRole('status')).toBeNull()
    })
})
