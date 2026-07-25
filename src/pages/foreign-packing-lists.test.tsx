import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { AppSession as Session } from '../types/AppSession'

vi.mock('../components/SolidPodContext', () => ({ useSolidPod: vi.fn() }))
vi.mock('../components/ForeignPodContext', () => ({ useForeignPod: vi.fn() }))

vi.mock('../services/solidPod', () => ({
    loadMultipleRdfFromPod: vi.fn(),
    POD_CONTAINERS: { PACKING_LISTS: 'pack-me-up/packing-lists/' },
}))

vi.mock('../services/rdfSerialization', () => ({
    datasetToPackingList: vi.fn(),
}))

import { ForeignPackingListsPage } from './foreign-packing-lists'
import { useSolidPod } from '../components/SolidPodContext'
import { useForeignPod } from '../components/ForeignPodContext'
import { loadMultipleRdfFromPod } from '../services/solidPod'

const mockUseSolidPod = vi.mocked(useSolidPod)
const mockUseForeignPod = vi.mocked(useForeignPod)
const mockLoadMultipleRdfFromPod = vi.mocked(loadMultipleRdfFromPod)

function renderPage() {
    return render(
        <MemoryRouter>
            <ForeignPackingListsPage />
        </MemoryRouter>
    )
}

describe('ForeignPackingListsPage loading state', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSolidPod.mockReturnValue({
            isLoggedIn: true,
            session: {} as Session,
            webId: 'https://me.example/profile/card#me',
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        })
        mockUseForeignPod.mockReturnValue({ foreignPodUrl: 'https://friend.example/' } as ReturnType<typeof useForeignPod>)
    })

    afterEach(() => {
        cleanup()
    })

    it('uses the shared loading treatment while the shared lists load', async () => {
        mockLoadMultipleRdfFromPod.mockReturnValue(new Promise(() => {}))

        renderPage()

        await waitFor(() => {
            expect(screen.getByRole('status').textContent).toContain('Loading packing lists...')
        })
        expect(screen.getAllByTestId('loading-skeleton-card').length).toBeGreaterThan(0)
    })

    it('replaces the loading treatment with the real content once the lists arrive', async () => {
        mockLoadMultipleRdfFromPod.mockResolvedValue({ data: [], errors: [] })

        renderPage()

        await waitFor(() => expect(screen.getByText(/no packing lists/i)).toBeTruthy())
        expect(screen.queryByRole('status')).toBeNull()
    })
})
