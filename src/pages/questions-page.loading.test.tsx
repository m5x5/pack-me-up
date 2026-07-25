import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { PackingAppDatabase } from '../services/database'

vi.mock('../components/DatabaseContext', () => ({ useDatabase: vi.fn() }))
vi.mock('../components/SolidPodContext', () => ({ useSolidPod: vi.fn() }))
vi.mock('../components/ForeignPodContext', () => ({ useForeignPod: vi.fn() }))

vi.mock('../hooks/useSyncCoordinator', () => ({
    useSyncCoordinator: vi.fn(() => ({
        saveWithSyncPrevention: vi.fn(),
        handleSyncSuccess: vi.fn(),
        handleSyncError: vi.fn(),
    })),
}))

vi.mock('../hooks/usePodSync', () => ({
    usePodSync: vi.fn(() => ({ saveToPod: vi.fn(), syncFromPod: vi.fn() })),
}))

vi.mock('../services/migration', () => ({
    DatabaseMigration: {
        checkMigrationNeeded: vi.fn().mockResolvedValue({ needed: false }),
        performMigration: vi.fn(),
    },
}))

vi.mock('../services/solidPod', () => ({
    POD_CONTAINERS: { ROOT: 'pack-me-up/' },
}))

vi.mock('../services/rdfSerialization', () => ({
    questionSetToDataset: vi.fn(),
    datasetToQuestionSet: vi.fn(),
}))

import { QuestionsPage } from './questions-page'
import { useDatabase } from '../components/DatabaseContext'
import { useSolidPod } from '../components/SolidPodContext'
import { useForeignPod } from '../components/ForeignPodContext'

const mockUseDatabase = vi.mocked(useDatabase)
const mockUseSolidPod = vi.mocked(useSolidPod)
const mockUseForeignPod = vi.mocked(useForeignPod)

const emptyQuestionSet = { _id: '1', _rev: '1', questions: [], people: [], alwaysNeededItems: [] }

function renderQuestionsPage(getQuestionSet: () => Promise<unknown>) {
    mockUseDatabase.mockReturnValue({
        db: { getQuestionSet, saveQuestionSet: vi.fn() } as unknown as PackingAppDatabase,
    })
    return render(
        <MemoryRouter>
            <QuestionsPage />
        </MemoryRouter>
    )
}

describe('QuestionsPage loading state', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSolidPod.mockReturnValue({
            isLoggedIn: false,
            session: null,
            webId: undefined,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        })
        mockUseForeignPod.mockReturnValue(null)
    })

    afterEach(() => {
        cleanup()
    })

    it('uses the shared loading treatment while the question set loads', async () => {
        renderQuestionsPage(() => new Promise(() => {}))

        await waitFor(() => {
            expect(screen.getByRole('status').textContent).toContain('Loading questions & items...')
        })
        expect(screen.getAllByTestId('loading-skeleton-card').length).toBeGreaterThan(0)
    })

    it('replaces the loading treatment with the real content once the question set arrives', async () => {
        renderQuestionsPage(() => Promise.resolve(emptyQuestionSet))

        await waitFor(() => expect(screen.getByText('My Questions & Items')).toBeTruthy())
        expect(screen.queryByRole('status')).toBeNull()
    })
})
