import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import React from 'react'
import { SectionOrderLegend, SectionOrderModal } from './SectionOrderEditor'

afterEach(cleanup)

describe('SectionOrderLegend', () => {
    it('names the sections in order', () => {
        render(<SectionOrderLegend labels={['Documents', 'Toiletries', 'Clothes']} onEdit={vi.fn()} />)
        expect(screen.getByText('Documents')).toBeTruthy()
        expect(screen.getByText('Toiletries')).toBeTruthy()
        expect(screen.getByText('Clothes')).toBeTruthy()
    })

    it('says nothing at all when there is no order to show', () => {
        const { container } = render(<SectionOrderLegend labels={['Essentials']} onEdit={vi.fn()} />)
        expect(container.textContent).toBe('')
    })

    // The strip scrolls rather than truncating, so a long order is all there —
    // which is what keeps a screen reader from being told a shorter story than
    // the one on screen.
    it('names every section however many there are', () => {
        const labels = Array.from({ length: 11 }, (_, i) => `Section ${i + 1}`)
        render(<SectionOrderLegend labels={labels} onEdit={vi.fn()} />)
        for (const label of labels) expect(screen.getByText(label)).toBeTruthy()
    })

    it('numbers the sections for a screen reader', () => {
        render(<SectionOrderLegend labels={['Documents', 'Clothes']} onEdit={vi.fn()} />)
        expect(screen.getByText('1.')).toBeTruthy()
        expect(screen.getByText('2.')).toBeTruthy()
    })

    it('opens the editor', () => {
        const onEdit = vi.fn()
        render(<SectionOrderLegend labels={['Documents', 'Clothes']} onEdit={onEdit} />)
        fireEvent.click(screen.getByRole('button', { name: /reorder sections/i }))
        expect(onEdit).toHaveBeenCalled()
    })

    it('offers no editor on a page that cannot save one', () => {
        render(<SectionOrderLegend labels={['Documents', 'Clothes']} />)
        expect(screen.queryByRole('button', { name: /reorder sections/i })).toBeNull()
        expect(screen.getByText('Documents')).toBeTruthy()
    })
})

describe('SectionOrderModal', () => {
    const labels = ['Documents', 'Toiletries', 'Clothes']

    const renderModal = (onChange = vi.fn()) => {
        render(<SectionOrderModal labels={labels} onChange={onChange} onClose={vi.fn()} />)
        return onChange
    }

    it('lists every section', () => {
        renderModal()
        const dialog = screen.getByRole('dialog', { name: /reorder list sections/i })
        for (const label of labels) expect(within(dialog).getByText(label)).toBeTruthy()
    })

    it('moves a section up', () => {
        const onChange = renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'Move Clothes up' }))
        expect(onChange).toHaveBeenCalledWith(['Documents', 'Clothes', 'Toiletries'])
    })

    it('moves a section down', () => {
        const onChange = renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'Move Documents down' }))
        expect(onChange).toHaveBeenCalledWith(['Toiletries', 'Documents', 'Clothes'])
    })

    // Nothing above the first row or below the last, so the arrows say so
    // rather than silently doing nothing.
    it('cannot move the first section up or the last one down', () => {
        renderModal()
        expect(screen.getByRole('button', { name: 'Move Documents up' }).hasAttribute('disabled')).toBe(true)
        expect(screen.getByRole('button', { name: 'Move Clothes down' }).hasAttribute('disabled')).toBe(true)
        expect(screen.getByRole('button', { name: 'Move Documents down' }).hasAttribute('disabled')).toBe(false)
    })

    it('closes on Done', () => {
        const onClose = vi.fn()
        render(<SectionOrderModal labels={labels} onChange={vi.fn()} onClose={onClose} />)
        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
        expect(onClose).toHaveBeenCalled()
    })
})
