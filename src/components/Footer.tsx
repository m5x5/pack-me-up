import { Link } from 'react-router-dom'

export const FEEDBACK_EMAIL = 'tim.packmeup@gmail.com'

const linkStyles = 'text-gray-500 hover:text-primary-700 hover:underline transition-colors duration-200'

/**
 * Where the things you need once belong — the policy, the data-deletion page, a
 * way to get in touch. All three were in the top nav competing with the everyday
 * links; none of them is an everyday link.
 *
 * "Delete my data" rather than "Your data": the nav's pod switcher already uses
 * "Your data" to mean "your own pod rather than a shared one", and this is also
 * the label Google Play's reviewers are looking for.
 */
export function Footer() {
    return (
        <footer
            className="border-t border-primary-100 bg-white/40"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <nav
                aria-label="Site information"
                className="container mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
            >
                <Link to="/privacy-policy" className={linkStyles}>
                    Privacy policy
                </Link>
                <Link to="/your-data" className={linkStyles}>
                    Delete my data
                </Link>
                <a href={`mailto:${FEEDBACK_EMAIL}`} className={linkStyles}>
                    Feedback
                </a>
            </nav>
        </footer>
    )
}
