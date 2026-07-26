import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AddQuestionItem } from './AddQuestionItem'
import { buildIndexOf } from '../utils/itemSuggestions'

const emptyIndex = buildIndexOf([])

function renderComposer(props: Partial<React.ComponentProps<typeof AddQuestionItem>> = {}) {
    const onAdd = vi.fn()
    render(
        <AddQuestionItem
            defaultLabel="Yes"
            suggestions={emptyIndex}
            ownerKey="q1:o1"
            targetLabel="Yes"
            onAdd={onAdd}
            {...props}
        />
    )
    return { onAdd, input: screen.getByRole('combobox') as HTMLInputElement }
}

describe('AddQuestionItem', () => {
    it('adds the typed item to the section it was opened in', () => {
        const { onAdd, input } = renderComposer({ category: 'Toiletries' })
        fireEvent.change(input, { target: { value: 'Razor' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Razor', 'Toiletries')
    })

    it('adds on the Add button too', () => {
        const { onAdd, input } = renderComposer()
        fireEvent.change(input, { target: { value: 'Razor' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        expect(onAdd).toHaveBeenCalledWith('Razor', undefined)
    })

    it('clears the field so the next item can be typed straight away', () => {
        const { input } = renderComposer()
        fireEvent.change(input, { target: { value: 'Razor' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(input.value).toBe('')
    })

    it('ignores a blank name', () => {
        const { onAdd, input } = renderComposer()
        fireEvent.change(input, { target: { value: '   ' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).not.toHaveBeenCalled()
    })

    it('trims what was typed', () => {
        const { onAdd, input } = renderComposer()
        fireEvent.change(input, { target: { value: '  Razor ' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Razor', undefined)
    })
})

describe('AddQuestionItem: choosing a section', () => {
    const sectionOptions = ['Toiletries', 'Clothes']

    it('has no section picker when the section is already decided', () => {
        const { input } = renderComposer({ category: 'Clothes' })
        fireEvent.change(input, { target: { value: 'Sun hat' } })
        expect(screen.queryByLabelText('Section')).toBeNull()
    })

    it('keeps out of the way until there is an item to file', () => {
        const { input } = renderComposer({ sectionOptions })
        expect(screen.queryByLabelText('Section')).toBeNull()
        fireEvent.change(input, { target: { value: 'S' } })
        expect(screen.getByLabelText('Section')).toBeTruthy()
    })

    it('offers the list’s own default section by name', () => {
        const { input } = renderComposer({ sectionOptions })
        fireEvent.change(input, { target: { value: 'S' } })
        const options = [...(screen.getByLabelText('Section') as HTMLSelectElement).options].map(o => o.value)
        expect(options).toEqual(['Yes', 'Toiletries', 'Clothes'])
    })

    it('files the item under the chosen section', () => {
        const { onAdd, input } = renderComposer({ sectionOptions })
        fireEvent.change(input, { target: { value: 'Razor' } })
        fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'Toiletries' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Razor', 'Toiletries')
    })

    it('stores no section for the default one', () => {
        const { onAdd, input } = renderComposer({ sectionOptions, category: 'Toiletries' })
        fireEvent.change(input, { target: { value: 'Odds and ends' } })
        fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'Yes' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Odds and ends', undefined)
    })

    it('keeps the chosen section for the next item', () => {
        const { onAdd, input } = renderComposer({ sectionOptions })
        fireEvent.change(input, { target: { value: 'Razor' } })
        fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'Toiletries' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        fireEvent.change(input, { target: { value: 'Shampoo' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenLastCalledWith('Shampoo', 'Toiletries')
    })
})

describe('AddQuestionItem: suggestions', () => {
    const suggestions = buildIndexOf([
        { text: 'Sun cream', category: 'Toiletries', owner: 'q1:o2' },
        { text: 'Sunhat', category: 'Clothes', owner: 'q1:o2' },
        { text: 'Sun lounger', owner: 'q1:o1' },
    ])

    it('offers names from elsewhere in the question set', () => {
        const { input } = renderComposer({ suggestions })
        expect(screen.queryByRole('listbox')).toBeNull()
        fireEvent.change(input, { target: { value: 'sun' } })
        expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
            'Sun creamToiletries',
            'SunhatClothes',
        ])
    })

    it('leaves out names this list already has', () => {
        // "Sun lounger" is owned by q1:o1 — the list being added to.
        const { input } = renderComposer({ suggestions })
        fireEvent.change(input, { target: { value: 'sun l' } })
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('takes the name and its section when one is picked', () => {
        const { onAdd, input } = renderComposer({ suggestions, sectionOptions: ['Toiletries', 'Clothes'] })
        fireEvent.change(input, { target: { value: 'sunh' } })
        fireEvent.click(screen.getByRole('option', { name: /Sunhat/ }))
        expect(input.value).toBe('Sunhat')
        expect((screen.getByLabelText('Section') as HTMLSelectElement).value).toBe('Clothes')
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Sunhat', 'Clothes')
    })

    it('brings a section this list does not have yet with it', () => {
        // The suggestion is the one thing that knows "Sun cream goes in
        // Toiletries". Dropping the section because this answer has no
        // Toiletries yet would lose exactly the knowledge being offered.
        const { onAdd, input } = renderComposer({ suggestions, sectionOptions: ['Clothes'] })
        fireEvent.change(input, { target: { value: 'sun c' } })
        fireEvent.click(screen.getByRole('option', { name: /Sun cream/ }))
        expect((screen.getByLabelText('Section') as HTMLSelectElement).value).toBe('Toiletries')
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Sun cream', 'Toiletries')
    })

    it('leaves a fixed section alone when a suggestion disagrees', () => {
        // Opened from the Clothes heading: the user has already said where this
        // is going, and there is no picker to show them it moved.
        const { onAdd, input } = renderComposer({ suggestions, category: 'Clothes' })
        fireEvent.change(input, { target: { value: 'sun c' } })
        fireEvent.click(screen.getByRole('option', { name: /Sun cream/ }))
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onAdd).toHaveBeenCalledWith('Sun cream', 'Clothes')
    })
})

describe('AddQuestionItem: dismissing', () => {
    it('closes on Escape', () => {
        const onClose = vi.fn()
        const { input } = renderComposer({ onClose })
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(onClose).toHaveBeenCalled()
    })

    it('closes the suggestions first, keeping what was typed', () => {
        const onClose = vi.fn()
        const suggestions = buildIndexOf([{ text: 'Sun cream', owner: 'q1:o2' }])
        const { input } = renderComposer({ onClose, suggestions })
        fireEvent.change(input, { target: { value: 'sun' } })
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByRole('listbox')).toBeNull()
        expect(onClose).not.toHaveBeenCalled()
        expect(input.value).toBe('sun')
    })

    it('closes when focus leaves an empty composer', () => {
        const onClose = vi.fn()
        renderComposer({ onClose })
        fireEvent.blur(screen.getByTestId('add-question-item'))
        expect(onClose).toHaveBeenCalled()
    })

    it('stays open when focus leaves a half-typed item', () => {
        const onClose = vi.fn()
        const { input } = renderComposer({ onClose })
        fireEvent.change(input, { target: { value: 'Raz' } })
        fireEvent.blur(screen.getByTestId('add-question-item'))
        expect(onClose).not.toHaveBeenCalled()
    })
})
