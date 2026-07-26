import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { Wizard } from './wizard'
import type { PackingAppDatabase } from '../services/database'

vi.mock('../components/DatabaseContext', () => ({
    useDatabase: vi.fn(),
}))

vi.mock('../components/SolidPodContext', () => ({
    useSolidPod: vi.fn(),
}))

vi.mock('./useWizardGeneration', () => ({
    useWizardGeneration: vi.fn(),
}))

vi.mock('../components/ToastContext', () => ({
    useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

import { useDatabase } from '../components/DatabaseContext'
import { useSolidPod } from '../components/SolidPodContext'
import { useWizardGeneration } from './useWizardGeneration'
import { createExampleData } from '../edit-questions/example-data'

const mockUseDatabase = vi.mocked(useDatabase)
const mockUseSolidPod = vi.mocked(useSolidPod)
const mockUseWizardGeneration = vi.mocked(useWizardGeneration)

function makeDb(overrides: { getQuestionSet?: ReturnType<typeof vi.fn> } = {}) {
    return {
        getQuestionSet: overrides.getQuestionSet ?? vi.fn().mockRejectedValue({ name: 'not_found' }),
    }
}

function makeGeneratedSet() {
    return createExampleData([
        { id: '1', name: 'Sam', ageRange: 'Adult' },
        { id: '2', name: 'Ellie', ageRange: 'Baby' },
        { id: '3', name: 'Rex', species: 'dog' },
    ], [])
}

describe('Wizard', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {})

        mockUseSolidPod.mockReturnValue({
            session: null,
            isLoggedIn: false,
            webId: undefined,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
        })

        mockUseWizardGeneration.mockReturnValue({
            isLoading: false,
            isSuccess: false,
            generatedSet: null,
            generateAndSave: vi.fn(),
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows warning banner when questions already exist', async () => {
        const db = makeDb({ getQuestionSet: vi.fn().mockResolvedValue({ questions: [] }) })
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/you already have packing list questions set up/i)).toBeTruthy()
        )
    })

    it('does not show warning banner when no questions exist', async () => {
        const db = makeDb({ getQuestionSet: vi.fn().mockRejectedValue({ name: 'not_found' }) })
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() => screen.getByRole('button', { name: /generate my packing questions/i }))
        expect(screen.queryByText(/you already have packing list questions set up/i)).toBeNull()
    })

    it('shows success modal but not pod prompt immediately after generation succeeds', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
        mockUseWizardGeneration.mockReturnValue({
            isLoading: false,
            isSuccess: true,
            generatedSet: null,
            generateAndSave: vi.fn(),
        })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/questions generated successfully/i)).toBeTruthy()
        )
        expect(screen.queryByText(/great! your questions are ready/i)).toBeNull()
    })

    it('closes the success modal when the X button is clicked', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
        mockUseWizardGeneration.mockReturnValue({
            isLoading: false,
            isSuccess: true,
            generatedSet: null,
            generateAndSave: vi.fn(),
        })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/questions generated successfully/i)).toBeTruthy()
        )

        const closeButton = screen.getByRole('button', { name: /close/i })
        closeButton.click()

        await waitFor(() =>
            expect(screen.queryByText(/questions generated successfully/i)).toBeNull()
        )
    })

    it('shows pod prompt only after a success modal CTA is clicked', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
        mockUseWizardGeneration.mockReturnValue({
            isLoading: false,
            isSuccess: true,
            generatedSet: null,
            generateAndSave: vi.fn(),
        })
        localStorage.removeItem('solid-pod-upsell-shown')

        const { getByRole } = render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/questions generated successfully/i)).toBeTruthy()
        )
        expect(screen.queryByText(/great! your questions are ready/i)).toBeNull()

        const createListBtn = getByRole('button', { name: /create my first packing list/i })
        createListBtn.click()

        await waitFor(() =>
            expect(screen.getByText(/great! your questions are ready/i)).toBeTruthy()
        )
    })

    it('sets solid-pod-upsell-shown global key when pod prompt is dismissed', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
        mockUseWizardGeneration.mockReturnValue({
            isLoading: false,
            isSuccess: true,
            generatedSet: null,
            generateAndSave: vi.fn(),
        })
        localStorage.removeItem('solid-pod-upsell-shown')

        const { getByRole } = render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/questions generated successfully/i)).toBeTruthy()
        )

        getByRole('button', { name: /create my first packing list/i }).click()

        await waitFor(() =>
            expect(screen.getByText(/great! your questions are ready/i)).toBeTruthy()
        )

        getByRole('button', { name: /maybe later/i }).click()

        expect(localStorage.getItem('solid-pod-upsell-shown')).toBe('true')
    })

    it('shows the create packing questions heading', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/create your packing questions/i)).toBeTruthy()
        )
    })

    it('shows the one-time setup note', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/do this once to get started/i)).toBeTruthy()
        )
    })

    it('does not render the activities section', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() => screen.getByRole('button', { name: /generate my packing questions/i }))
        expect(screen.queryByText(/what activities are you planning/i)).toBeNull()
    })

    it('submit button says "Generate My Packing Questions"', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /generate my packing questions/i })).toBeTruthy()
        )
    })

    it('name input for each person row has a programmatically associated label', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        // The first person row's name input must be reachable by label text
        const nameInput = await screen.findByLabelText(/^name$/i)
        expect(nameInput).toBeTruthy()
        expect((nameInput as HTMLInputElement).type).toBe('text')
    })

    it('name input for dynamically added person rows also has an associated label', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        const addBtn = await screen.findByRole('button', { name: /add another person/i })
        addBtn.click()

        await waitFor(() => {
            const nameInputs = screen.getAllByLabelText(/^name$/i)
            expect(nameInputs).toHaveLength(2)
        })
    })

    it('renders a gender select for each person', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })

        render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText('Select gender...')).toBeTruthy()
        )
    })


    describe("Who's Packing? - pets", () => {
        function renderWizard() {
            const db = makeDb()
            mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
            return render(
                <MemoryRouter>
                    <Wizard />
                </MemoryRouter>
            )
        }

        it('shows an "Add a Pet" button', async () => {
            renderWizard()
            expect(await screen.findByRole('button', { name: /add a pet/i })).toBeTruthy()
        })

        it('adds a pet row with a species select when "Add a Pet" is clicked', async () => {
            renderWizard()
            const addPetBtn = await screen.findByRole('button', { name: /add a pet/i })
            addPetBtn.click()
            await waitFor(() => expect(screen.getByText('Select species...')).toBeTruthy())
        })

        it('a pet row does not render an age range select', async () => {
            renderWizard()
            // Only the initial person row exists: one age range placeholder
            await waitFor(() => expect(screen.getAllByText('Select age range...')).toHaveLength(1))
            const addPetBtn = await screen.findByRole('button', { name: /add a pet/i })
            addPetBtn.click()
            // Adding a pet must not add another age range select
            await waitFor(() => expect(screen.getByText('Select species...')).toBeTruthy())
            expect(screen.getAllByText('Select age range...')).toHaveLength(1)
        })
    })

    describe("Who's Packing? - remove person", () => {
        function renderWizard() {
            const db = makeDb()
            mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
            return render(
                <MemoryRouter>
                    <Wizard />
                </MemoryRouter>
            )
        }

        it('shows a remove button for the first person even when only one person exists', async () => {
            renderWizard()
            const removeBtn = await screen.findByTitle('Remove person')
            expect(removeBtn).toBeTruthy()
        })

        it('clicking remove on the only person clears their name field', async () => {
            renderWizard()
            const removeBtn = await screen.findByTitle('Remove person')
            removeBtn.click()
            await waitFor(() => expect(screen.getByDisplayValue('')).toBeTruthy())
            // Ensure there is still exactly one person entry
            expect(screen.getAllByTitle('Remove person')).toHaveLength(1)
        })
    })

    describe('generation reveal', () => {
        function renderAfterGeneration() {
            const db = makeDb()
            mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
            mockUseWizardGeneration.mockReturnValue({
                isLoading: false,
                isSuccess: true,
                generatedSet: makeGeneratedSet(),
                generateAndSave: vi.fn(),
            })
            localStorage.setItem('solid-pod-upsell-shown', 'true')
            return render(
                <MemoryRouter>
                    <Wizard />
                </MemoryRouter>
            )
        }

        it('names real people from the generated set, one line at a time', async () => {
            renderAfterGeneration()

            await waitFor(() => expect(screen.getByText(/thinking about Sam/i)).toBeTruthy())
            expect(screen.queryByText(/thinking about Ellie/i)).toBeNull()

            await waitFor(() => expect(screen.getByText(/thinking about Ellie/i)).toBeTruthy(), { timeout: 3000 })
            await waitFor(() => expect(screen.getByText(/thinking about Rex/i)).toBeTruthy(), { timeout: 3000 })
        })

        it('names what was added for each person', async () => {
            renderAfterGeneration()

            await waitFor(
                () => expect(screen.getByText(/thinking about Ellie.*adding \w+/i)).toBeTruthy(),
                { timeout: 3000 }
            )
        })

        it('shows a summary of what was generated once the reveal finishes', async () => {
            renderAfterGeneration()

            await waitFor(
                () => expect(screen.getByText(/\d+ questions and \d+ items across 2 people and 1 pet/i)).toBeTruthy(),
                { timeout: 4000 }
            )
        })

        it('only offers the CTAs once the reveal has finished', async () => {
            renderAfterGeneration()

            expect(screen.queryByRole('button', { name: /create my first packing list/i })).toBeNull()

            await waitFor(
                () => expect(screen.getByRole('button', { name: /create my first packing list/i })).toBeTruthy(),
                { timeout: 4000 }
            )
        })

        it('lets the user skip straight to the summary', async () => {
            renderAfterGeneration()

            const skip = await screen.findByRole('button', { name: /skip/i })
            skip.click()

            await waitFor(() =>
                expect(screen.getByRole('button', { name: /create my first packing list/i })).toBeTruthy()
            )
            expect(screen.queryByRole('button', { name: /skip/i })).toBeNull()
            // Skipping still shows every person that was generated for
            expect(screen.getByText(/thinking about Rex/i)).toBeTruthy()
        })

        it('skips the staged reveal when the user prefers reduced motion', async () => {
            vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
                matches: query.includes('prefers-reduced-motion'),
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }) as unknown as MediaQueryList)

            renderAfterGeneration()

            await waitFor(() =>
                expect(screen.getByRole('button', { name: /create my first packing list/i })).toBeTruthy()
            )
            expect(screen.queryByRole('button', { name: /skip/i })).toBeNull()
            expect(screen.getByText(/\d+ questions and \d+ items across 2 people and 1 pet/i)).toBeTruthy()
        })
    })

    it('does not show pod prompt when solid-pod-upsell-shown is already set', async () => {
        const db = makeDb()
        mockUseDatabase.mockReturnValue({ db: db as unknown as PackingAppDatabase })
        mockUseWizardGeneration.mockReturnValue({
            isLoading: false,
            isSuccess: true,
            generatedSet: null,
            generateAndSave: vi.fn(),
        })
        localStorage.setItem('solid-pod-upsell-shown', 'true')

        const { getByRole } = render(
            <MemoryRouter>
                <Wizard />
            </MemoryRouter>
        )

        await waitFor(() =>
            expect(screen.getByText(/questions generated successfully/i)).toBeTruthy()
        )

        getByRole('button', { name: /create my first packing list/i }).click()

        // Give React a chance to update - pod prompt should NOT appear
        await new Promise(r => setTimeout(r, 50))
        expect(screen.queryByText(/great! your questions are ready/i)).toBeNull()
    })
})
