import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import React from 'react'
import { SolidPodProvider, useSolidPod } from './SolidPodContext'
import { ToastProvider } from './ToastContext'

function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <SolidPodProvider>{children}</SolidPodProvider>
        </ToastProvider>
    )
}

// Callbacks captured from the Session constructor
let capturedCallbacks: {
    onSessionStateChange?: (event?: Event) => void;
    onSessionExpiration?: (event?: Event) => void;
} = {}

let mockAuthFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
let mockIsActive = false
let mockWebId: string | undefined

vi.mock('@uvdsl/solid-oidc-client-browser/core', () => ({
    // Must use a regular function (not arrow) so vitest can call it as a constructor
    SessionCore: vi.fn().mockImplementation(function(_clientDetails: unknown, options: typeof capturedCallbacks) {
        capturedCallbacks = options ?? {}
        return {
            get isActive() { return mockIsActive },
            get webId() { return mockWebId },
            handleRedirectFromLogin: vi.fn().mockResolvedValue(undefined),
            restore: vi.fn().mockResolvedValue(undefined),
            login: vi.fn().mockResolvedValue(undefined),
            logout: vi.fn().mockResolvedValue(undefined),
            authFetch: mockAuthFetch,
        }
    }),
}))

vi.mock('@uvdsl/solid-oidc-client-browser', () => ({
    SessionIDB: vi.fn().mockImplementation(function() { return {} }),
}))

function fireStateChange(isActive: boolean, webId?: string) {
    capturedCallbacks.onSessionStateChange?.(
        new CustomEvent('sessionStateChange', { detail: { isActive, webId } })
    )
}

function fireExpiration() {
    capturedCallbacks.onSessionExpiration?.()
}

/** Test consumer that renders context values as text */
function Consumer() {
    const { isLoggedIn, sessionExpired, webId } = useSolidPod()
    return (
        <div>
            <span data-testid="isLoggedIn">{String(isLoggedIn)}</span>
            <span data-testid="sessionExpired">{String(sessionExpired)}</span>
            <span data-testid="webId">{webId ?? 'none'}</span>
        </div>
    )
}

/** Test consumer that also exposes clearSessionExpired */
function ConsumerWithActions() {
    const { isLoggedIn, sessionExpired, clearSessionExpired, logout } = useSolidPod()
    return (
        <div>
            <span data-testid="isLoggedIn">{String(isLoggedIn)}</span>
            <span data-testid="sessionExpired">{String(sessionExpired)}</span>
            <button onClick={clearSessionExpired}>clear</button>
            <button onClick={logout}>logout</button>
        </div>
    )
}

describe('SolidPodContext', () => {
    let originalLocation: Location

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
        capturedCallbacks = {}
        mockIsActive = false
        mockWebId = undefined
        mockAuthFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
        sessionStorage.clear()
        originalLocation = window.location
    })

    afterEach(() => {
        vi.restoreAllMocks()
        sessionStorage.clear()
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    })

    function setWindowLocation(search: string, hash = '') {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, search, hash },
        })
    }

    it('starts with isLoggedIn false and sessionExpired false', async () => {
        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
            expect(screen.getByTestId('sessionExpired').textContent).toBe('false')
        })
    })

    it('sets isLoggedIn true after STATE_CHANGE event with isActive true', async () => {
        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
        })

        await act(async () => {
            mockIsActive = true
            mockWebId = 'https://user.example.org/profile/card#me'
            fireStateChange(true, 'https://user.example.org/profile/card#me')
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
            expect(screen.getByTestId('webId').textContent).toBe('https://user.example.org/profile/card#me')
        })
    })

    it('sets isLoggedIn false and sessionExpired true on session expiration', async () => {
        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await act(async () => {
            mockIsActive = true
            mockWebId = 'https://user.example.org/profile/card#me'
            fireStateChange(true, 'https://user.example.org/profile/card#me')
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
        })

        // Simulate session expiry
        await act(async () => {
            mockIsActive = false
            mockWebId = undefined
            fireExpiration()
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
            expect(screen.getByTestId('sessionExpired').textContent).toBe('true')
        })
    })

    it('sets isLoggedIn false but keeps sessionExpired false on intentional logout', async () => {
        render(
            <Wrapper>
                <ConsumerWithActions />
            </Wrapper>
        )

        await act(async () => {
            mockIsActive = true
            mockWebId = 'https://user.example.org/profile/card#me'
            fireStateChange(true, 'https://user.example.org/profile/card#me')
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
        })

        await act(async () => {
            screen.getByRole('button', { name: 'logout' }).click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
            expect(screen.getByTestId('sessionExpired').textContent).toBe('false')
        })
    })

    it('sets isLoggedIn true and sessionExpired false on login STATE_CHANGE', async () => {
        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('false')
        })

        await act(async () => {
            mockIsActive = true
            mockWebId = 'https://user.example.org/profile/card#me'
            fireStateChange(true, 'https://user.example.org/profile/card#me')
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
            expect(screen.getByTestId('sessionExpired').textContent).toBe('false')
        })
    })

    it('saves current route to sessionStorage before session restore when not in OAuth callback', async () => {
        setWindowLocation('', '#/create-packing-list')

        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await waitFor(() => {
            expect(sessionStorage.getItem('authReturnTo')).toBe('/create-packing-list')
        })
    })

    it('does not overwrite sessionStorage authReturnTo when in OAuth callback', async () => {
        setWindowLocation('?code=abc123&state=xyz', '#/solid-pod-handle-redirect')
        sessionStorage.setItem('authReturnTo', '/existing-route')

        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await waitFor(() => {
            expect(sessionStorage.getItem('authReturnTo')).toBe('/existing-route')
        })
    })

    it('navigates to stored return route after OAuth callback completes', async () => {
        setWindowLocation('?code=abc123&state=xyz', '')
        sessionStorage.setItem('authReturnTo', '/create-packing-list')
        mockIsActive = true
        mockWebId = 'https://user.example.org/profile/card#me'

        const replaceSpy = vi.fn()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, search: '?code=abc123&state=xyz', hash: '', replace: replaceSpy },
        })

        render(
            <Wrapper>
                <Consumer />
            </Wrapper>
        )

        await waitFor(() => {
            expect(replaceSpy).toHaveBeenCalledWith('/#/create-packing-list')
        })
    })

    it('periodically calls authFetch to keep the session alive', async () => {
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

        render(<Wrapper><Consumer /></Wrapper>)

        await act(async () => {
            mockIsActive = true
            mockWebId = 'https://user.example.org/profile/card#me'
            fireStateChange(true, 'https://user.example.org/profile/card#me')
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
        })

        const keepaliveCall = setIntervalSpy.mock.calls.find(([, delay]) => delay === 10 * 60 * 1000)
        expect(keepaliveCall).toBeDefined()

        mockAuthFetch.mockClear()
        await act(async () => {
            await (keepaliveCall![0] as () => Promise<void>)()
        })

        expect(mockAuthFetch).toHaveBeenCalledWith(
            'https://user.example.org/profile/card#me',
            { method: 'HEAD' }
        )
    })

    it('clearSessionExpired sets sessionExpired to false', async () => {
        render(
            <Wrapper>
                <ConsumerWithActions />
            </Wrapper>
        )

        await act(async () => {
            mockIsActive = true
            mockWebId = 'https://user.example.org/profile/card#me'
            fireStateChange(true, 'https://user.example.org/profile/card#me')
        })

        await waitFor(() => {
            expect(screen.getByTestId('isLoggedIn').textContent).toBe('true')
        })

        // Trigger session expiry
        await act(async () => {
            mockIsActive = false
            mockWebId = undefined
            fireExpiration()
        })

        await waitFor(() => {
            expect(screen.getByTestId('sessionExpired').textContent).toBe('true')
        })

        // Dismiss
        await act(async () => {
            screen.getByRole('button', { name: 'clear' }).click()
        })

        await waitFor(() => {
            expect(screen.getByTestId('sessionExpired').textContent).toBe('false')
        })
    })
})
