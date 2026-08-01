// Vercel Edge Middleware: content negotiation at "/". A real browser (or
// anything asking for text/html) keeps getting the SPA; a client that asks
// for application/ld+json or text/turtle at least as strongly as text/html
// gets the app's Application Capability description instead
// (https://dokieli.github.io/application-capability/). See
// src/capability/document.ts for the description itself and the reasoning
// behind it.
import { next } from '@vercel/functions'
import { APP_ORIGIN, CAPABILITY_JSONLD, CAPABILITY_TURTLE } from './src/capability/document'

export const config = { matcher: '/' }

const JSONLD_TYPE = 'application/ld+json'
const TURTLE_TYPE = 'text/turtle'
const HTML_TYPE = 'text/html'

interface AcceptEntry {
    type: string
    q: number
}

function parseAccept(header: string | null): AcceptEntry[] {
    if (!header) return [{ type: '*/*', q: 1 }]
    return header.split(',').map(part => {
        const [type, ...params] = part.trim().split(';').map(s => s.trim())
        const qParam = params.find(p => p.startsWith('q='))
        const q = qParam ? parseFloat(qParam.slice(2)) : 1
        return { type: type.toLowerCase(), q: Number.isFinite(q) ? q : 1 }
    })
}

function qualityFor(entries: AcceptEntry[], mediaType: string): number {
    const [maintype] = mediaType.split('/')
    let best = 0
    for (const entry of entries) {
        if (entry.type === mediaType || entry.type === `${maintype}/*` || entry.type === '*/*') {
            if (entry.q > best) best = entry.q
        }
    }
    return best
}

// Only an exact, explicit entry counts as "asking for" this RDF type - a bare
// `*/*` (or a missing Accept header, which we treat as `*/*`) must not be
// enough on its own, or every plain `curl /` and every ordinary page load
// with no Accept header at all would get the capability doc instead of the app.
function explicitQualityFor(entries: AcceptEntry[], mediaType: string): number {
    let best = 0
    for (const entry of entries) {
        if (entry.type === mediaType && entry.q > best) best = entry.q
    }
    return best
}

export default function middleware(request: Request) {
    const entries = parseAccept(request.headers.get('accept'))
    const jsonldQ = explicitQualityFor(entries, JSONLD_TYPE)
    const turtleQ = explicitQualityFor(entries, TURTLE_TYPE)
    const htmlQ = qualityFor(entries, HTML_TYPE)

    // Between the two RDF formats, honour whichever the client actually
    // weighted higher rather than always preferring one - only a tie falls
    // back to JSON-LD, which the ac spec calls out as the preferred format.
    if (jsonldQ > 0 && jsonldQ >= htmlQ && jsonldQ >= turtleQ) {
        return new Response(JSON.stringify(CAPABILITY_JSONLD, null, 2), {
            headers: {
                'content-type': `${JSONLD_TYPE}; charset=utf-8`,
                'content-location': `${APP_ORIGIN}/`,
                vary: 'accept',
            },
        })
    }

    if (turtleQ > 0 && turtleQ >= htmlQ) {
        return new Response(CAPABILITY_TURTLE, {
            headers: {
                'content-type': `${TURTLE_TYPE}; charset=utf-8`,
                'content-location': `${APP_ORIGIN}/`,
                vary: 'accept',
            },
        })
    }

    return next()
}
