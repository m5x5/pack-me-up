import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { CircleUserRound, ChevronDown, Sun, Moon } from 'lucide-react'
import { useSolidPod } from './SolidPodContext'
import { useDatabase } from './DatabaseContext'
import { useTheme } from './ThemeContext'
import { SolidProviderSelector } from './SolidProviderSelector'
import { getPodOwnerProfile } from '../services/solidPod'
import type { SharedContext } from '../services/rdfSerialization'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The username as it appears in the WebID itself — no provider suffix, no case
// changes beyond what the URL already carries. Used only when the profile has
// no foaf:name to show.
const webIdShortName = (webId: string): string => {
    try {
        const url = new URL(webId)
        const path = url.pathname
            .replace(/\/profile\/card\/?$/, '/')
            .replace(/\/profile\/?$/, '/')
        const firstSegment = path.split('/').find(s => s.length > 0)
        if (firstSegment && !UUID_RE.test(firstSegment)) return decodeURIComponent(firstSegment)
        const parts = url.hostname.split('.')
        return parts.length >= 3 ? parts[0] : url.hostname
    } catch {
        return webId
    }
}

export const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [isProviderSelectorOpen, setIsProviderSelectorOpen] = useState(false)
    const { login, logout, isLoggedIn, webId, session } = useSolidPod()
    const { db, loginSyncVersion } = useDatabase()
    const { theme, toggleTheme } = useTheme()
    const location = useLocation()
    const navigate = useNavigate()
    const [sharedContexts, setSharedContexts] = useState<SharedContext[]>([])
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const [profileName, setProfileName] = useState<string | null>(null)
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
    const profileRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        db.getSharedWithMe()
            .then(swm => setSharedContexts(swm.contexts))
            .catch(() => {})
    }, [db, loginSyncVersion])

    // The bar shows a person, not an address: prefer the profile's foaf:name
    // and photo, fall back to the WebID's username and a generic icon.
    useEffect(() => {
        setProfileName(null)
        setProfilePhoto(null)
        if (!session || !webId) return
        let cancelled = false
        getPodOwnerProfile(session, '', webId)
            .then(({ name, photo }) => {
                if (cancelled) return
                if (name) setProfileName(name)
                if (photo) setProfilePhoto(photo)
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [session, webId])

    useEffect(() => {
        if (!isProfileOpen) return
        const onOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false)
        }
        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsProfileOpen(false)
        }
        document.addEventListener('mousedown', onOutside)
        document.addEventListener('keydown', onEscape)
        return () => {
            document.removeEventListener('mousedown', onOutside)
            document.removeEventListener('keydown', onEscape)
        }
    }, [isProfileOpen])

    const displayName = profileName ?? (webId ? webIdShortName(webId) : '')

    const podMatch = /^\/pod\/([^/]+)/.exec(location.pathname)
    const currentForeignEncoded = podMatch?.[1] ?? null
    const inForeignContext = currentForeignEncoded !== null

    // When viewing a foreign pod, contextual links stay inside that pod's routes
    const viewListsPath = inForeignContext ? `/pod/${currentForeignEncoded}/view-lists` : '/view-lists'
    const manageQuestionsPath = inForeignContext ? `/pod/${currentForeignEncoded}/manage-questions` : '/manage-questions'

    const handleSolidLogin = () => {
        setIsProviderSelectorOpen(true)
    }

    const handleProviderSelect = (issuer: string) => {
        return login(issuer)
    }

    const handleLogout = async () => {
        await logout()
    }

    return (
        <>
            <nav className="bg-primary-950 text-white shadow-soft safe-area-top">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-14 md:h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Link to="/home" className="flex items-center gap-2 text-xl md:text-2xl font-bold hover:scale-105 transition-transform duration-200 drop-shadow-md">
                                    <img src="/favicon.svg" alt="" className="h-7 w-7 md:h-8 md:w-8" />
                                    Pack Me Up
                                </Link>
                            </div>
                            <div className="hidden md:block">
                                <div className="ml-10 flex items-baseline space-x-2">
                                    <Link
                                        to={manageQuestionsPath}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/20 transition-all duration-200 hover:scale-105"
                                    >
                                        {inForeignContext ? 'Questions & Items' : 'My Questions & Items'}
                                    </Link>
                                    <Link
                                        to={viewListsPath}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/20 transition-all duration-200 hover:scale-105"
                                    >
                                        Lists
                                    </Link>
                                </div>
                            </div>
                        </div>
                        {/* Solid Login/Logout section */}
                        <div className="hidden md:flex items-center gap-4">
                            <button
                                type="button"
                                onClick={toggleTheme}
                                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200"
                            >
                                {theme === 'dark' ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
                            </button>
                            {isLoggedIn ? (
                                /* relative z-[70]: keeps the dropdown above the packing list's
                                   sticky progress strip (z-50) */
                                <div className="relative z-[70] flex items-center gap-3">
                                    {sharedContexts.length > 0 && (
                                        <select
                                            value={currentForeignEncoded ?? '__own__'}
                                            onChange={e => {
                                                const val = e.target.value
                                                if (val === '__own__') navigate('/view-lists')
                                                else navigate(`/pod/${val}/view-lists`)
                                            }}
                                            className="text-sm font-medium bg-white/20 text-white rounded-lg px-2 py-1 border-0 focus:ring-0 cursor-pointer"
                                            aria-label="Switch context"
                                        >
                                            <option value="__own__" className="text-gray-900 dark:text-gray-100">Your data</option>
                                            {sharedContexts.map(ctx => (
                                                <option
                                                    key={ctx.podUrl}
                                                    value={encodeURIComponent(ctx.podUrl)}
                                                    className="text-gray-900 dark:text-gray-100"
                                                >
                                                    {ctx.label ?? ctx.podUrl}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <div ref={profileRef} className="relative">
                                        <button
                                            onClick={() => setIsProfileOpen(v => !v)}
                                            aria-haspopup="menu"
                                            aria-expanded={isProfileOpen}
                                            aria-label="Account menu"
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium hover:bg-white/20 transition-all duration-200"
                                        >
                                            {profilePhoto ? (
                                                <img
                                                    src={profilePhoto}
                                                    alt=""
                                                    className="w-6 h-6 shrink-0 rounded-full object-cover ring-2 ring-white"
                                                    // The photo may live behind pod auth; fall back to the icon
                                                    onError={() => setProfilePhoto(null)}
                                                />
                                            ) : (
                                                <CircleUserRound className="w-6 h-6 shrink-0" aria-hidden="true" />
                                            )}
                                            <span className="truncate max-w-[12rem]">{displayName}</span>
                                            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                        </button>
                                        {isProfileOpen && (
                                            <div
                                                role="menu"
                                                // z-[70]: above the sticky progress strip (z-50) and the
                                                // confetti overlay (z-60) on the packing-list page
                                                className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg ring-1 ring-black/10 py-2 z-[70]"
                                            >
                                                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                                                    <a
                                                        href={webId}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block text-sm font-medium break-all text-primary-700 dark:text-primary-300 hover:underline"
                                                        title="Open your profile in a new tab"
                                                    >
                                                        {webId}
                                                    </a>
                                                </div>
                                                <Link
                                                    to="/backups"
                                                    role="menuitem"
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="block px-4 py-2 text-sm font-medium hover:bg-primary-50 dark:hover:bg-gray-700"
                                                >
                                                    Backups
                                                </Link>
                                                <Link
                                                    to="/sharing"
                                                    role="menuitem"
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="block px-4 py-2 text-sm font-medium hover:bg-primary-50 dark:hover:bg-gray-700"
                                                >
                                                    Sharing
                                                </Link>
                                                <button
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setIsProfileOpen(false)
                                                        handleLogout()
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-red-950/40 border-t border-gray-100 dark:border-gray-800 mt-1 pt-2.5"
                                                >
                                                    Logout
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-end">
                                    <button
                                        onClick={handleSolidLogin}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/90 text-primary-700 hover:bg-white hover:scale-105 transition-all duration-200 shadow-soft"
                                        title="Store your packing lists in your own personal Pod - you own your data"
                                    >
                                        Login with Solid Pod
                                    </button>
                                    <span className="text-xs text-white mt-1 font-medium">Own your data</span>
                                </div>
                            )}
                        </div>
                        {/* Mobile menu button */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="inline-flex items-center justify-center p-2.5 rounded-lg text-white hover:bg-white/20 focus:outline-none transition-all duration-200"
                                aria-expanded="false"
                            >
                                <span className="sr-only">Open main menu</span>
                                {/* Hamburger icon */}
                                <svg
                                    className={`${isOpen ? 'hidden' : 'block'} h-6 w-6`}
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                {/* Close icon */}
                                <svg
                                    className={`${isOpen ? 'block' : 'hidden'} h-6 w-6`}
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                <div className={`${isOpen ? 'block' : 'hidden'} md:hidden bg-primary-950`}>
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <Link
                            to={manageQuestionsPath}
                            className="block px-3 py-3 rounded-xl text-base font-semibold hover:bg-white/20 transition-all duration-200"
                            onClick={() => setIsOpen(false)}
                        >
                            {inForeignContext ? 'Questions & Items' : 'My Questions & Items'}
                        </Link>
                        <Link
                            to={viewListsPath}
                            className="block px-3 py-3 rounded-xl text-base font-semibold hover:bg-white/20 transition-all duration-200"
                            onClick={() => setIsOpen(false)}
                        >
                            Lists
                        </Link>
                        {isLoggedIn && (
                            <Link
                                to="/backups"
                                className="block px-3 py-3 rounded-xl text-base font-semibold hover:bg-white/20 transition-all duration-200"
                                onClick={() => setIsOpen(false)}
                            >
                                Backups
                            </Link>
                        )}
                        {isLoggedIn && (
                            <Link
                                to="/sharing"
                                className="block px-3 py-3 rounded-xl text-base font-semibold hover:bg-white/20 transition-all duration-200"
                                onClick={() => setIsOpen(false)}
                            >
                                Sharing
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-base font-semibold hover:bg-white/20 transition-all duration-200"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0" aria-hidden="true" /> : <Moon className="w-5 h-5 shrink-0" aria-hidden="true" />}
                            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                        </button>
                        {/* Mobile Solid Login/Logout */}
                        <div className="border-t border-white/20 pt-2 mt-2">
                            {isLoggedIn ? (
                                <>
                                    <div className="px-3 py-2 flex items-center gap-2" title={webId}>
                                        {profilePhoto ? (
                                            <img
                                                src={profilePhoto}
                                                alt=""
                                                className="w-8 h-8 shrink-0 rounded-full object-cover ring-2 ring-white"
                                                // The photo may live behind pod auth; fall back to the icon
                                                onError={() => setProfilePhoto(null)}
                                            />
                                        ) : (
                                            <CircleUserRound className="w-8 h-8 shrink-0" aria-hidden="true" />
                                        )}
                                        <span className="text-sm font-medium truncate">{displayName}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            handleLogout()
                                            setIsOpen(false)
                                        }}
                                        className="w-full text-left px-3 py-3 rounded-xl text-base font-semibold bg-white/20 hover:bg-white/30 transition-all duration-200"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <div>
                                    <button
                                        onClick={() => {
                                            handleSolidLogin()
                                            setIsOpen(false)
                                        }}
                                        className="w-full text-left px-3 py-3 rounded-xl text-base font-semibold bg-white/90 text-primary-700 hover:bg-white transition-all duration-200"
                                        title="Store your packing lists in your own personal Pod - you own your data"
                                    >
                                        Login with Solid Pod
                                    </button>
                                    <p className="px-3 py-1 text-xs text-white font-medium">Own your data</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Solid Provider Selector Modal - rendered outside nav to avoid styling conflicts */}
            <SolidProviderSelector
                isOpen={isProviderSelectorOpen}
                onClose={() => setIsProviderSelectorOpen(false)}
                onSelect={handleProviderSelect}
            />
        </>
    )
} 