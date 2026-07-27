import { useEffect } from 'react'

/**
 * Lock background page scroll while a modal is open.
 *
 * Besides being correct modal behaviour, it is what keeps the page — and on a
 * phone the browser's URL bar — from moving while a drag is happening inside.
 * A moving URL bar resizes the viewport, which moves every row the drag has
 * already measured, mid-gesture.
 */
export function useBodyScrollLock() {
    useEffect(() => {
        const body = document.body
        const html = document.documentElement
        const previous = {
            body: body.style.overflow,
            html: html.style.overflow,
            overscroll: body.style.overscrollBehavior,
        }
        // Both: the scrolling element is <body> on some browsers and <html> on
        // others (notably mobile). Chaining is stopped too.
        body.style.overflow = 'hidden'
        html.style.overflow = 'hidden'
        body.style.overscrollBehavior = 'none'
        return () => {
            body.style.overflow = previous.body
            html.style.overflow = previous.html
            body.style.overscrollBehavior = previous.overscroll
        }
    }, [])
}
