import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import { ItemInlineEditor } from './ItemInlineEditor'
import type { Item, Person } from '../edit-questions/types'

const people: Person[] = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
]

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        text: 'Socks',
        personSelections: [
            { personId: 'p1', selected: true },
            { personId: 'p2', selected: false },
        ],
        ...overrides,
    }
}

function renderEditor(item: Item, onChange = vi.fn(), onClose = vi.fn()) {
    render(
        <ItemInlineEditor
            item={item}
            people={people}
            allItemNames={['Socks', 'Towel']}
            sectionNames={['Toiletries', 'Clothes']}
            sectionDefaultLabel="Yes"
            onChange={onChange}
            onClose={onClose}
        />
    )
    return { onChange, onClose }
}

describe('ItemInlineEditor', () => {
    it('shows the item name', () => {
        renderEditor(makeItem())
        expect(within(screen.getByTestId('item-name-field')).getByText('Socks')).toBeTruthy()
    })

    it('commits a renamed item', () => {
        const { onChange } = renderEditor(makeItem())
        // The name field stays a cheap placeholder until it is focused.
        fireEvent.click(within(screen.getByTestId('item-name-field')).getByText('Socks'))
        const input = screen.getByTestId('item-name-field').querySelector('input') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'Wool socks' } })
        fireEvent.blur(input)
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: 'Wool socks' }))
    })
})

describe('ItemInlineEditor: who it is for', () => {
    it('toggles a person on', () => {
        const { onChange } = renderEditor(makeItem())
        fireEvent.click(screen.getByTitle('Bob'))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            personSelections: [
                { personId: 'p1', selected: true },
                { personId: 'p2', selected: true },
            ],
        }))
    })

    it('toggles a person off', () => {
        const { onChange } = renderEditor(makeItem())
        fireEvent.click(screen.getByTitle('Alice'))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            personSelections: [
                { personId: 'p1', selected: false },
                { personId: 'p2', selected: false },
            ],
        }))
    })

    it('rebuilds selections against the current people when the item predates one', () => {
        // An item saved before Bob existed carries only Alice's slot; toggling
        // must not leave a hole where Bob's selection should be.
        const { onChange } = renderEditor(makeItem({
            personSelections: [{ personId: 'p1', selected: true }],
        }))
        fireEvent.click(screen.getByTitle('Bob'))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            personSelections: [
                { personId: 'p1', selected: true },
                { personId: 'p2', selected: true },
            ],
        }))
    })

    it('marks an item as shared', () => {
        const { onChange } = renderEditor(makeItem())
        fireEvent.click(screen.getByLabelText(/Toggle shared/))
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ communal: true }))
    })

    it('clears the shared flag rather than storing false', () => {
        const { onChange } = renderEditor(makeItem({ communal: true }))
        fireEvent.click(screen.getByLabelText(/Toggle shared/))
        expect(onChange.mock.calls[0][0].communal).toBeUndefined()
    })
})

describe('ItemInlineEditor: quantity', () => {
    it('sets a per-night rate', () => {
        const { onChange } = renderEditor(makeItem())
        fireEvent.change(screen.getByLabelText(/Quantity to pack/), { target: { value: '2' } })
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ perNight: 2 }))
    })

    it('sets the nights the rate is spread over', () => {
        const { onChange } = renderEditor(makeItem({ perNight: 1 }))
        fireEvent.change(screen.getByLabelText(/Number of nights per/), { target: { value: '4' } })
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ perNights: 4 }))
    })

    it('sets a maximum', () => {
        const { onChange } = renderEditor(makeItem({ perNight: 1 }))
        fireEvent.change(screen.getByLabelText(/Maximum quantity/), { target: { value: '5' } })
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxQuantity: 5 }))
    })

    it('clears the rate when the field is emptied', () => {
        const { onChange } = renderEditor(makeItem({ perNight: 2 }))
        fireEvent.change(screen.getByLabelText(/Quantity to pack/), { target: { value: '' } })
        expect(onChange.mock.calls[0][0].perNight).toBeUndefined()
    })
})

describe('ItemInlineEditor: section', () => {
    it('shows the default section when the item carries no category', () => {
        renderEditor(makeItem())
        expect((screen.getByLabelText('Section') as HTMLSelectElement).value).toBe('Yes')
    })

    it('shows the item’s own section when it has one', () => {
        renderEditor(makeItem({ category: 'Toiletries' }))
        expect((screen.getByLabelText('Section') as HTMLSelectElement).value).toBe('Toiletries')
    })

    it('moves the item into another section', () => {
        const { onChange } = renderEditor(makeItem())
        fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'Toiletries' } })
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'Toiletries' }))
    })

    it('clears the category when moved back to the default section', () => {
        const { onChange } = renderEditor(makeItem({ category: 'Toiletries' }))
        fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'Yes' } })
        expect(onChange.mock.calls[0][0].category).toBeUndefined()
    })

    it('offers only sections that exist — creating one is not a typing gesture', () => {
        renderEditor(makeItem())
        const labels = [...screen.getByLabelText('Section').querySelectorAll('option')].map(o => o.textContent)
        expect(labels).toEqual(['Yes', 'Toiletries', 'Clothes'])
    })

    it('keeps the item’s own section on offer even when it is not a known name', () => {
        // Otherwise the select would show — and on the next change commit — some
        // other section entirely, silently moving the item.
        renderEditor(makeItem({ category: 'Retired name' }))
        expect((screen.getByLabelText('Section') as HTMLSelectElement).value).toBe('Retired name')
    })
})

describe('ItemInlineEditor: closing', () => {
    it('closes on Done', () => {
        const { onClose } = renderEditor(makeItem())
        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
        expect(onClose).toHaveBeenCalled()
    })

    it('closes on Escape', () => {
        const { onClose } = renderEditor(makeItem())
        fireEvent.keyDown(screen.getByTestId('item-inline-editor'), { key: 'Escape' })
        expect(onClose).toHaveBeenCalled()
    })
})

describe('ItemInlineEditor: deleting', () => {
    function renderDeletable(item: Item) {
        const onDelete = vi.fn()
        const onClose = vi.fn()
        render(
            <ItemInlineEditor
                item={item}
                people={people}
                allItemNames={['Socks', 'Towel']}
                sectionNames={['Toiletries']}
                sectionDefaultLabel="Yes"
                onChange={vi.fn()}
                onDelete={onDelete}
                onClose={onClose}
            />
        )
        return { onDelete, onClose }
    }

    it('offers no delete when the caller supplies no handler', () => {
        renderEditor(makeItem())
        expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()
    })

    it('names the item it will delete, so the wrong row is obvious', () => {
        renderDeletable(makeItem({ text: 'Socks' }))
        expect(screen.getByRole('button', { name: 'Delete Socks' })).toBeTruthy()
    })

    it('deletes on click', () => {
        const { onDelete } = renderDeletable(makeItem())
        fireEvent.click(screen.getByRole('button', { name: 'Delete Socks' }))
        expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('leaves closing to the caller, whose list has just changed shape', () => {
        const { onClose } = renderDeletable(makeItem())
        fireEvent.click(screen.getByRole('button', { name: 'Delete Socks' }))
        expect(onClose).not.toHaveBeenCalled()
    })

    it('still names the button when the item has no text yet', () => {
        renderDeletable(makeItem({ text: '' }))
        expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy()
    })
})
