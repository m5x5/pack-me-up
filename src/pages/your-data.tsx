import { useState, useEffect } from 'react'
import { useSolidPod } from '../components/SolidPodContext'
import { useToast } from '../components/ToastContext'
import { usePodErrorHandler } from '../hooks/usePodErrorHandler'
import { Button } from '../components/Button'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { getPrimaryPodUrl } from '../services/solidPod'
import { deleteAllLocalData, deleteAllPodData } from '../services/dataDeletion'

const SUPPORT_EMAIL = 'tim.packmeup@gmail.com'

/**
 * Sentry's retention for error events, which is set by plan tier: 30 days on the
 * Developer (free) plan we're on, 90 on Team and above. Stated to the user, so
 * it has to be corrected here if the plan ever changes.
 */
const ERROR_REPORT_RETENTION = '30 days'

type DeletionScope = 'device' | 'pod' | 'everything'

const CONFIRMATIONS: Record<DeletionScope, { title: string, message: string }> = {
    device: {
        title: 'Delete all data on this device?',
        message: 'Every packing list, question and setting stored on this device will be removed. This can\'t be undone.',
    },
    pod: {
        title: 'Delete all Pack Me Up data from your pod?',
        message: 'The whole pack-me-up folder in your pod will be removed, including your backups. This can\'t be undone.',
    },
    everything: {
        title: 'Delete everything?',
        message: 'All Pack Me Up data will be removed from your pod and from this device, including your backups. This can\'t be undone.',
    },
}

export function YourDataPage() {
    const { isLoggedIn, session } = useSolidPod()
    const { showToast } = useToast()
    const handlePodError = usePodErrorHandler()

    const [podUrl, setPodUrl] = useState<string | null>(null)
    const [pendingScope, setPendingScope] = useState<DeletionScope | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        if (!isLoggedIn || !session) {
            setPodUrl(null)
            return
        }
        let cancelled = false
        getPrimaryPodUrl(session)
            .then(url => { if (!cancelled) setPodUrl(url) })
            .catch(() => { if (!cancelled) setPodUrl(null) })
        return () => { cancelled = true }
    }, [isLoggedIn, session])

    const runDeletion = async (scope: DeletionScope) => {
        setIsDeleting(true)
        try {
            // Pod first, always. The pod copy syncs back down on next login
            // (DatabaseContext -> syncAllDataFromPod), so deleting the device
            // copy first would simply hand the data back to the user later.
            if (scope !== 'device') {
                if (!session || !podUrl) {
                    showToast('No pod found for your account', 'error')
                    return
                }
                await deleteAllPodData(session, podUrl)
            }

            if (scope !== 'pod') {
                await deleteAllLocalData()
                // Contexts still hold handles to databases that no longer exist.
                window.location.reload()
                return
            }

            showToast('All Pack Me Up data has been deleted from your pod.', 'success')
        } catch (error) {
            handlePodError(error, 'Failed to delete your pod data. Please try again.')
        } finally {
            setIsDeleting(false)
            setPendingScope(null)
        }
    }

    return (
        <div className="max-w-3xl mx-auto bg-white/60 rounded-2xl shadow-soft p-6 md:p-10 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-primary-900 mb-1">Your data</h1>
                <p className="text-gray-700">
                    Pack Me Up keeps your packing lists on your own device, and — if you choose to sign
                    in — in a Solid Pod that belongs to you. There are no Pack Me Up servers holding your
                    lists. This page is where you delete any of it.
                </p>
            </div>

            <section className="space-y-3">
                <h2 className="text-xl font-bold text-primary-900">On this device</h2>
                <p className="text-gray-700">
                    Your packing lists, your questions and items, and your app settings are stored on
                    this device so the app works offline. Deleting them removes them from this device
                    only — other devices you've used keep their own copies.
                </p>
                {isLoggedIn && (
                    <p className="text-gray-700 font-medium">
                        You're signed in, so anything also saved in your pod will sync back to this device
                        next time you sign in. To remove it for good, delete your pod data too.
                    </p>
                )}
                <Button
                    type="button"
                    variant="danger"
                    onClick={() => setPendingScope('device')}
                    disabled={isDeleting}
                >
                    Delete all data on this device
                </Button>
                <p className="text-sm text-gray-600">
                    You can also do this without opening the app: on Android, Settings → Apps → Pack Me Up
                    → Storage → Clear storage. Uninstalling the app removes it as well.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-bold text-primary-900">In your Solid Pod</h2>
                {isLoggedIn ? (
                    <>
                        <p className="text-gray-700">
                            Everything the app has saved lives in a single <code>pack-me-up</code> folder
                            in your pod{podUrl ? <> (<span className="break-all">{podUrl}</span>)</> : null},
                            including your backups. Deleting it leaves the rest of your pod untouched.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant="danger"
                                onClick={() => setPendingScope('pod')}
                                disabled={isDeleting}
                            >
                                Delete all data from my pod
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={() => setPendingScope('everything')}
                                disabled={isDeleting}
                            >
                                Delete everything
                            </Button>
                        </div>
                    </>
                ) : (
                    <p className="text-gray-700">
                        If you've signed in with a Solid Pod, everything the app saved is in a single{' '}
                        <code>pack-me-up</code> folder in that pod. Sign in here to delete it with one tap,
                        or delete the folder yourself using your pod provider's file manager — you don't
                        need this app installed to do that.
                    </p>
                )}
                <p className="text-sm text-gray-600">
                    If you've shared a list with someone, deleting your copy doesn't delete theirs. Revoke
                    their access from the list's share dialog before deleting if you want it gone from
                    their view too.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-bold text-primary-900">Error reports and analytics</h2>
                <p className="text-gray-700">
                    The only things that leave your device to us are crash reports and page-view counts,
                    and neither is linked to you. A crash report carries the error message, a stack trace
                    and your browser or device type — no name, no email, no account, and no IP address.
                    Analytics are cookie-free totals, like how many people opened the wizard. Because
                    there's no identifier attached to either, there's nothing we could look up and delete
                    for one person — and equally nothing in them that points back to you. Crash reports
                    are deleted automatically after {ERROR_REPORT_RETENTION} either way.
                </p>
                <p className="text-gray-700">
                    The exception is the in-app feedback form: if you send feedback and fill in your name
                    or email, that message is stored with what you typed. We can find and delete that —
                    email{' '}
                    <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="font-semibold text-primary-700 underline hover:text-primary-900"
                    >
                        {SUPPORT_EMAIL}
                    </a>{' '}
                    and we will.
                </p>
            </section>

            {pendingScope && (
                <ConfirmationDialog
                    isOpen
                    title={CONFIRMATIONS[pendingScope].title}
                    message={CONFIRMATIONS[pendingScope].message}
                    confirmText="Delete"
                    confirmVariant="danger"
                    onConfirm={() => runDeletion(pendingScope)}
                    onClose={() => setPendingScope(null)}
                />
            )}
        </div>
    )
}
