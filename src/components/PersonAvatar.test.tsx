import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { PersonAvatar } from './PersonAvatar'
import { PERSON_COLORS } from '../edit-questions/person-colors'

const color = PERSON_COLORS[0]

describe('PersonAvatar', () => {
    afterEach(cleanup)

    it('renders the coloured initial when there is no photo', () => {
        render(<PersonAvatar name="Alice" color={color} />)
        const avatar = screen.getByTestId('person-avatar')
        expect(avatar.textContent).toBe('A')
    })

    it('renders the profile photo when one is provided', () => {
        render(<PersonAvatar name="Mel" color={color} photoUrl="https://pod.example/avatar.jpg" />)
        const avatar = screen.getByTestId('person-avatar')
        expect(avatar.tagName).toBe('IMG')
        expect(avatar.getAttribute('src')).toBe('https://pod.example/avatar.jpg')
        expect(avatar.getAttribute('title')).toBe('Mel')
    })

    it('falls back to the initial when the photo fails to load', () => {
        render(<PersonAvatar name="Mel" color={color} photoUrl="https://pod.example/broken.jpg" />)
        fireEvent.error(screen.getByTestId('person-avatar'))
        const avatar = screen.getByTestId('person-avatar')
        expect(avatar.tagName).toBe('SPAN')
        expect(avatar.textContent).toBe('M')
    })
})
