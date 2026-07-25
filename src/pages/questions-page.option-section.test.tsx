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

function renderOption(option: Option, sectionDefaultLabel = 'Yes') {
    return render(
        <OptionSection
            option={option}
            people={people}
            sectionDefaultLabel={sectionDefaultLabel}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
        />
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

    it('shows no section headings when the items are all in the default section', () => {
        renderOption(withItems())
        fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
        // 'Yes' appears as the option's own heading; it must not also appear as
        // a section heading when the list isn't actually split.
        expect(screen.queryByTestId('item-section-heading')).toBeNull()
    })
})

describe('OptionSection with sectioned items', () => {
    const sectioned = () => makeOption({
        items: [
            { text: 'Toothbrush', personSelections: [], category: 'Toiletries' },
            { text: 'Pyjamas', personSelections: [], category: 'Sleep' },
            { text: 'Socks', personSelections: [] },
        ],
    })

    it('groups the items under their section headings', () => {
        renderOption(sectioned())
        fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
        const headings = screen.getAllByTestId('item-section-heading').map(h => h.textContent)
        // The default section leads, named as the generated list will name it.
        expect(headings).toEqual(['Yes', 'Toiletries', 'Sleep'])
    })

    it('names the default section after the question for single-choice questions', () => {
        renderOption(sectioned(), 'Staying overnight?')
        fireEvent.click(screen.getByRole('button', { name: /Yes/ }))
        expect(screen.getAllByTestId('item-section-heading')[0].textContent).toBe('Staying overnight?')
    })
})
