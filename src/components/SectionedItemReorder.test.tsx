import { describe, it, expect, vi } from 'vitest'
import React, { createRef } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SectionedItemReorder } from './SectionedItemReorder'
import type { Item } from '../edit-questions/types'

function item(text: string, category?: string): Item {
    return { id: text, text, personSelections: [], ...(category ? { category } : {}) }
}

function renderReorder(items: Item[]) {
    const onChange = vi.fn<(items: Item[]) => void>()
    render(
        <SectionedItemReorder
            items={items}
            defaultLabel="Essentials"
            suggestedSectionNames={[]}
            scrollRef={createRef<HTMLDivElement>()}
            onChange={onChange}
        />
    )
    return onChange
}

/** Radix opens its menu on pointerdown, which fireEvent.click does not send. */
function openMenuFor(itemText: string) {
    fireEvent.pointerDown(screen.getByRole('button', { name: `Move ${itemText}` }), { button: 0 })
    return screen.getByRole('menu')
}

const layout = (items: Item[]) => items.map(i => [i.text, i.category])

describe('SectionedItemReorder rows', () => {
    const items = () => [item('Snacks'), item('Crisps'), item('Water')]

    it('keeps a drag handle on every row', () => {
        renderReorder(items())
        expect(screen.getAllByRole('button', { name: /^Drag /})).toHaveLength(3)
    })

    it('no longer offers the up and down step buttons', () => {
        renderReorder(items())
        expect(screen.queryByRole('button', { name: /^Move .* up$/ })).toBeNull()
        expect(screen.queryByRole('button', { name: /^Move .* down$/ })).toBeNull()
    })
})

describe('SectionedItemReorder move menu', () => {
    const unsectioned = () => [item('Snacks'), item('Crisps'), item('Water')]
    const sectioned = () => [
        item('Snacks'), item('Crisps'),
        item('Nappies', 'Baby'), item('Wipes', 'Baby'),
    ]

    it('moves an item to the top of its section', () => {
        const onChange = renderReorder(unsectioned())
        fireEvent.click(within(openMenuFor('Water')).getByText('Move to top of section'))
        expect(onChange.mock.calls[0][0].map(i => i.text)).toEqual(['Water', 'Snacks', 'Crisps'])
    })

    it('moves an item to the bottom of its section', () => {
        const onChange = renderReorder(unsectioned())
        fireEvent.click(within(openMenuFor('Snacks')).getByText('Move to bottom of section'))
        expect(onChange.mock.calls[0][0].map(i => i.text)).toEqual(['Crisps', 'Water', 'Snacks'])
    })

    it('moves within the item\'s own section only, leaving other sections alone', () => {
        const onChange = renderReorder(sectioned())
        fireEvent.click(within(openMenuFor('Wipes')).getByText('Move to top of section'))
        expect(layout(onChange.mock.calls[0][0])).toEqual([
            ['Snacks', undefined], ['Crisps', undefined],
            ['Wipes', 'Baby'], ['Nappies', 'Baby'],
        ])
    })

    it('hides the top and bottom entries when the item is already there', () => {
        renderReorder(unsectioned())
        const first = openMenuFor('Snacks')
        expect(within(first).queryByText('Move to top of section')).toBeNull()
        expect(within(first).getByText('Move to bottom of section')).toBeTruthy()
    })

    it('offers the other sections by name, but not the item\'s own', () => {
        renderReorder(sectioned())
        const menu = openMenuFor('Snacks')
        expect(within(menu).getByText('Move to Baby')).toBeTruthy()
        expect(within(menu).queryByText('Move to Essentials')).toBeNull()
    })

    it('moves an item into another section, at the bottom of it', () => {
        const onChange = renderReorder(sectioned())
        fireEvent.click(within(openMenuFor('Snacks')).getByText('Move to Baby'))
        expect(layout(onChange.mock.calls[0][0])).toEqual([
            ['Crisps', undefined],
            ['Nappies', 'Baby'], ['Wipes', 'Baby'], ['Snacks', 'Baby'],
        ])
    })

    it('moves an item back to the default section', () => {
        const onChange = renderReorder(sectioned())
        fireEvent.click(within(openMenuFor('Nappies')).getByText('Move to Essentials'))
        expect(layout(onChange.mock.calls[0][0])).toEqual([
            ['Snacks', undefined], ['Crisps', undefined], ['Nappies', undefined],
            ['Wipes', 'Baby'],
        ])
    })

    it('still offers the default section when every item is categorised', () => {
        const onChange = renderReorder([item('Nappies', 'Baby'), item('Wipes', 'Baby')])
        fireEvent.click(within(openMenuFor('Wipes')).getByText('Move to Essentials'))
        expect(layout(onChange.mock.calls[0][0])).toEqual([
            ['Wipes', undefined], ['Nappies', 'Baby'],
        ])
    })

    it('shows no section entries at all when there is only one section', () => {
        renderReorder(unsectioned())
        expect(within(openMenuFor('Crisps')).queryByText(/^Move to (?!top|bottom)/)).toBeNull()
    })

    it('offers a section the user just added but has not filled yet', () => {
        const onChange = renderReorder(unsectioned())
        fireEvent.click(screen.getByRole('button', { name: '+ Add section' }))
        fireEvent.change(screen.getByLabelText('New section name'), { target: { value: 'First aid' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        fireEvent.click(within(openMenuFor('Crisps')).getByText('Move to First aid'))
        expect(layout(onChange.mock.calls[0][0])).toEqual([
            ['Snacks', undefined], ['Water', undefined], ['Crisps', 'First aid'],
        ])
    })
})
