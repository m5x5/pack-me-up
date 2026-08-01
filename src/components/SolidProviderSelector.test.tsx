import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SolidProviderSelector, LAST_PROVIDER_KEY } from './SolidProviderSelector'

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
}

// Queries that avoid role+name accessible-name computation (broken in happy-dom on Node 20
// for buttons whose accessible name comes from nested div children).
function getPrimaryProviderName() {
  // The primary button has a distinct blue-border class; its first child div holds the name.
  const btn = document.querySelector('button.border-blue-400') as HTMLElement | null
  return btn?.querySelector('div.font-medium')?.textContent ?? null
}

function clickProvider(name: string) {
  // Find the button that contains an exact-text name div, then click it.
  const all = Array.from(document.querySelectorAll('button'))
  const btn = all.find(b => b.querySelector('div.font-medium')?.textContent === name)
  if (!btn) throw new Error(`Provider button "${name}" not found`)
  fireEvent.click(btn)
}

function isProviderVisible(name: string): boolean {
  const all = Array.from(document.querySelectorAll('button'))
  return all.some(b => b.querySelector('div.font-medium')?.textContent === name)
}

function getSearchInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/search providers/i) as HTMLInputElement
}

describe('SolidProviderSelector', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('default provider (no last-used stored)', () => {
    it('shows Inrupt PodSpaces as the primary option', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      expect(getPrimaryProviderName()).toBe('Inrupt PodSpaces')
    })

    it('shows all providers below the search box by default', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      expect(isProviderVisible('solidcommunity.net')).toBe(true)
      expect(isProviderVisible('Private Data Pod')).toBe(true)
    })

    it('filters the results as the user types', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      fireEvent.change(getSearchInput(), { target: { value: 'solidcommunity' } })
      expect(isProviderVisible('solidcommunity.net')).toBe(true)
      expect(isProviderVisible('Inrupt PodSpaces')).toBe(false)
      expect(isProviderVisible('Private Data Pod')).toBe(false)
    })

    it('offers a custom-provider option built from the typed text', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      fireEvent.change(getSearchInput(), { target: { value: 'https://my-pod.example.com' } })
      expect(screen.getByText('Connect to custom provider')).toBeTruthy()
      expect(screen.getByText('https://my-pod.example.com')).toBeTruthy()
    })

    it('defaults the custom-provider option to https:// when no scheme is typed', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      fireEvent.change(getSearchInput(), { target: { value: 'my-pod.example.com' } })
      expect(screen.getByText('https://my-pod.example.com')).toBeTruthy()
    })
  })

  describe('with last-used provider stored', () => {
    it('shows the last-used provider as the primary option', () => {
      localStorage.setItem(LAST_PROVIDER_KEY, 'https://solidcommunity.net')
      render(<SolidProviderSelector {...defaultProps} />)
      expect(getPrimaryProviderName()).toBe('solidcommunity.net')
    })

    it('falls back to Inrupt PodSpaces for an unrecognised issuer', () => {
      localStorage.setItem(LAST_PROVIDER_KEY, 'https://unknown-provider.example.com')
      render(<SolidProviderSelector {...defaultProps} />)
      expect(getPrimaryProviderName()).toBe('Inrupt PodSpaces')
    })
  })

  describe('saving last-used provider', () => {
    it('saves the selected provider issuer to localStorage', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      clickProvider('Inrupt PodSpaces')
      expect(localStorage.getItem(LAST_PROVIDER_KEY)).toBe('https://login.inrupt.com')
    })

    it('saves a different provider when selected from the results list', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      clickProvider('solidcommunity.net')
      expect(localStorage.getItem(LAST_PROVIDER_KEY)).toBe('https://solidcommunity.net')
    })

    it('saves a custom provider URL typed into the search box', () => {
      render(<SolidProviderSelector {...defaultProps} />)
      fireEvent.change(getSearchInput(), { target: { value: 'https://my-pod.example.com' } })
      fireEvent.click(screen.getByText('Connect to custom provider'))
      expect(localStorage.getItem(LAST_PROVIDER_KEY)).toBe('https://my-pod.example.com')
    })

    it('connects to the custom provider on Enter when nothing matches', () => {
      const onSelect = vi.fn()
      render(<SolidProviderSelector {...defaultProps} onSelect={onSelect} />)
      const input = getSearchInput()
      fireEvent.change(input, { target: { value: 'https://my-pod.example.com' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSelect).toHaveBeenCalledWith('https://my-pod.example.com')
    })

    it('prepends https:// to a custom provider URL typed without a scheme', () => {
      const onSelect = vi.fn()
      render(<SolidProviderSelector {...defaultProps} onSelect={onSelect} />)
      fireEvent.change(getSearchInput(), { target: { value: 'my-pod.example.com' } })
      fireEvent.click(screen.getByText('Connect to custom provider'))
      expect(onSelect).toHaveBeenCalledWith('https://my-pod.example.com')
      expect(localStorage.getItem(LAST_PROVIDER_KEY)).toBe('https://my-pod.example.com')
    })

    it('calls onSelect with the issuer', () => {
      const onSelect = vi.fn()
      render(<SolidProviderSelector {...defaultProps} onSelect={onSelect} />)
      clickProvider('Inrupt PodSpaces')
      expect(onSelect).toHaveBeenCalledWith('https://login.inrupt.com')
    })
  })

  describe('connecting state', () => {
    it('shows a spinner instead of closing while the redirect is in flight', () => {
      let resolveLogin: () => void = () => {}
      const onSelect = vi.fn(() => new Promise<void>(resolve => { resolveLogin = resolve }))
      render(<SolidProviderSelector {...defaultProps} onSelect={onSelect} />)

      clickProvider('Inrupt PodSpaces')

      expect(screen.getByText(/connecting to inrupt podspaces/i)).toBeTruthy()
      expect(screen.queryByPlaceholderText(/search providers/i)).toBeNull()

      resolveLogin()
    })

    it('shows an error and lets the user try again when the connection fails', async () => {
      const onSelect = vi.fn().mockRejectedValue(new Error('nope'))
      render(<SolidProviderSelector {...defaultProps} onSelect={onSelect} />)

      clickProvider('Inrupt PodSpaces')

      expect(await screen.findByText(/couldn't connect to that provider/i)).toBeTruthy()
      // Back to the search UI, not stuck showing the spinner
      expect(getSearchInput()).toBeTruthy()
    })
  })
})
