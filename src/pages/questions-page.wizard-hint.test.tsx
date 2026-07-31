import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
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

function renderQuestionsPage() {
    mockUseDatabase.mockReturnValue({
        db: {
            getQuestionSet: vi.fn().mockResolvedValue(emptyQuestionSet),
            saveQuestionSet: vi.fn(),
        } as unknown as PackingAppDatabase,
    })
    return render(
        <MemoryRouter>
            <QuestionsPage />
        </MemoryRouter>
    )
}

describe('QuestionsPage wizard hint', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
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
        localStorage.clear()
    })

    it('shows the redo-the-wizard hint with a dismiss button', async () => {
        renderQuestionsPage()
        await waitFor(() => expect(screen.getByText(/start from scratch/i)).toBeTruthy())
        expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy()
    })

    it('hides the hint when dismissed and remembers the choice', async () => {
        renderQuestionsPage()
        await waitFor(() => expect(screen.getByText(/start from scratch/i)).toBeTruthy())

        fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

        expect(screen.queryByText(/start from scratch/i)).toBeNull()
        expect(localStorage.getItem('wizardHintDismissed')).toBe('true')
    })

    it('does not show the hint again once dismissed', async () => {
        localStorage.setItem('wizardHintDismissed', 'true')
        renderQuestionsPage()
        await waitFor(() => expect(screen.getByText('My Questions & Items')).toBeTruthy())
        expect(screen.queryByText(/start from scratch/i)).toBeNull()
    })
})
