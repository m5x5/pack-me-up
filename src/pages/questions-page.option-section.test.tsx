import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { OptionSection } from './questions-page'
import type { Option, Person } from '../edit-questions/types'

vi.mock('../components/DatabaseContext', () => ({ useDatabase: vi.fn() }))
vi.mock('../components/SolidPodContext', () => ({ useSolidPod: vi.fn() }))
vi.mock('../components/ForeignPodContext', () => ({ useForeignPod: vi.fn() }))

const people: Person[] = [{ id: 'p1', name: 'Alice' }]

function makeOption(overrides: Partial<Option> = {}): Option {
    return { id: 'o1', order: 0, text: 'Yes', items: [], ...overrides }
}

function renderOption(option: Option) {
    return render(
        <OptionSection option={option} people={people} onEdit={vi.fn()} onDelete={vi.fn()} />
    )
}

describe('OptionSection with no items', () => {
    it('shows an inline "No items" hint', () => {
        renderOption(makeOption())
        expect(screen.getByText('No items')).toBeTruthy()
    })

    it('is not expandable — no toggle button and no chevron', () => {
        const { container } = renderOption(makeOption())
        expect(screen.queryByRole('button', { name: /Yes/ })).toBeNull()
        expect(container.querySelector('[data-testid="option-expand-chevron"]')).toBeNull()
    })

    it('still offers edit and delete', () => {
        renderOption(makeOption())
        expect(screen.getByTitle('Edit option')).toBeTruthy()
        expect(screen.getByTitle('Delete option')).toBeTruthy()
    })
})

describe('OptionSection with items', () => {
    const withItems = () => makeOption({ items: [{ text: 'Toothbrush' }, { text: 'Towel' }] })

    it('shows the item count rather than the "No items" hint', () => {
        renderOption(withItems())
        expect(screen.getByText('2 items')).toBeTruthy()
        expect(screen.queryByText('No items')).toBeNull()
    })

    it('expands to reveal the items when clicked', () => {
        renderOption(withItems())
        const toggle = screen.getByRole('button', { name: /Yes/ })
        expect(screen.queryByText('Toothbrush')).toBeNull()
        fireEvent.click(toggle)
        expect(screen.getByText('Toothbrush')).toBeTruthy()
        expect(screen.getByText('Towel')).toBeTruthy()
    })
})
