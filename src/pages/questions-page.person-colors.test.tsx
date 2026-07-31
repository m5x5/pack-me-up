import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'
import { PeopleModal } from './questions-page'
import type { Person } from '../edit-questions/types'
import { PERSON_COLORS, personColorAt } from '../edit-questions/person-colors'

vi.mock('../components/DatabaseContext', () => ({ useDatabase: vi.fn() }))
vi.mock('../components/SolidPodContext', () => ({ useSolidPod: vi.fn(() => ({ session: null, isLoggedIn: false })) }))
vi.mock('../components/ForeignPodContext', () => ({ useForeignPod: vi.fn() }))

const people: Person[] = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
]

function renderModal(initial: Person[] = people) {
    const onSave = vi.fn()
    render(<PeopleModal people={initial} onSave={onSave} onClose={vi.fn()} />)
    return { onSave }
}

const avatarFor = (name: string) => screen.getByRole('button', { name: `Change colour for ${name}` })

describe('PeopleModal colour picker', () => {
    it('paints each avatar with the colour for that person’s position', () => {
        renderModal()
        expect(avatarFor('Alice').className).toContain(personColorAt(0).avatar)
        expect(avatarFor('Bob').className).toContain(personColorAt(1).avatar)
    })

    it('paints an avatar with the colour the person chose earlier', () => {
        renderModal([{ id: 'p1', name: 'Alice', color: 'lime' }])
        const lime = PERSON_COLORS.find(c => c.id === 'lime')!
        expect(avatarFor('Alice').className).toContain(lime.avatar)
    })

    it('keeps the palette shut until the avatar is tapped', () => {
        renderModal()
        expect(screen.queryByRole('group', { name: /Colour for Alice/ })).toBeNull()
        fireEvent.click(avatarFor('Alice'))
        expect(screen.getByRole('group', { name: 'Colour for Alice' })).toBeTruthy()
    })

    it('opens one palette at a time', () => {
        renderModal()
        fireEvent.click(avatarFor('Alice'))
        fireEvent.click(avatarFor('Bob'))
        expect(screen.queryByRole('group', { name: 'Colour for Alice' })).toBeNull()
        expect(screen.getByRole('group', { name: 'Colour for Bob' })).toBeTruthy()
    })

    it('marks the person’s current colour as the chosen swatch', () => {
        renderModal()
        fireEvent.click(avatarFor('Alice'))
        const group = screen.getByRole('group', { name: 'Colour for Alice' })
        const chosen = within(group).getByRole('button', { name: personColorAt(0).label })
        expect(chosen.getAttribute('aria-pressed')).toBe('true')
    })

    it('repaints the avatar and closes the palette when a colour is picked', () => {
        renderModal()
        fireEvent.click(avatarFor('Alice'))
        fireEvent.click(screen.getByRole('button', { name: 'Pink' }))
        const pink = PERSON_COLORS.find(c => c.id === 'pink')!
        expect(avatarFor('Alice').className).toContain(pink.avatar)
        expect(screen.queryByRole('group', { name: 'Colour for Alice' })).toBeNull()
    })

    it('saves the chosen colour on the person', () => {
        const { onSave } = renderModal()
        fireEvent.click(avatarFor('Bob'))
        fireEvent.click(screen.getByRole('button', { name: 'Teal' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(onSave).toHaveBeenCalledWith([
            { id: 'p1', name: 'Alice' },
            { id: 'p2', name: 'Bob', color: 'teal' },
        ])
    })

    it('names an unnamed person by position so the picker is still findable', () => {
        renderModal([{ id: 'p1', name: '' }])
        expect(screen.getByRole('button', { name: 'Change colour for Person 1' })).toBeTruthy()
    })
})
