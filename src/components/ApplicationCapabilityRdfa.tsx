import { APPLICATION, CAPABILITIES, INVOCATIONS, REQUIREMENTS } from '../capability/document'

const PREFIX = [
    'ac: https://www.w3.org/ns/ac#',
    'as: https://www.w3.org/ns/activitystreams#',
    'odrl: http://www.w3.org/ns/odrl/2/',
    'hydra: http://www.w3.org/ns/hydra/core#',
    'dpv: https://w3id.org/dpv#',
    'pmu: https://pack-me-up.app/vocab#',
].join(' ')

/**
 * The same Application Capability description served via content
 * negotiation at "/" (src/capability/document.ts, /middleware.ts), restated
 * as RDFa attributes in the footer so a plain browser GET of the SPA's HTML
 * carries the triples too, with no Accept header gymnastics required
 * (https://dokieli.github.io/application-capability/).
 *
 * Literal values use `<span property=… content=…/>` rather than `<meta>`:
 * React 19 auto-hoists `<meta>` into `<head>` wherever it's rendered, which
 * would pull it out from under its `typeof` ancestor and break the subject
 * it's meant to describe. `content` is a general RDFa attribute, not
 * `<meta>`-specific, so the empty `<span>` carries the same triple without
 * being hoisted. Every element here is otherwise empty, so this adds no
 * visible footprint to the footer. SHACL shapes aren't restated: ac:shape
 * just points at their fragment on the negotiated JSON-LD/Turtle document,
 * which stays the one place they're defined.
 */
export function ApplicationCapabilityRdfa() {
    const invocationById = new Map(INVOCATIONS.map(invocation => [invocation.id, invocation]))

    return (
        <div prefix={PREFIX} typeof="ac:Application" resource={APPLICATION.id}>
            <span property="as:name" content={APPLICATION['as:name']} />

            {CAPABILITIES.map(capability => {
                const invocation = invocationById.get(capability.invocation)
                return (
                    <div key={capability.id} property="ac:capability" typeof="ac:Capability" resource={capability.id}>
                        <span property="ac:action" resource={capability.action} />
                        <span property="ac:output" content={capability.output} />
                        <link property="ac:resourceType" resource={capability.resourceType} />
                        {capability.shape && <link property="ac:shape" resource={capability.shape} />}
                        {invocation && (
                            <div property="ac:invocation" typeof="ac:UriTemplateInvocation" resource={invocation.id}>
                                <span property="hydra:template" content={invocation.template} />
                            </div>
                        )}
                    </div>
                )
            })}

            {REQUIREMENTS.map(requirement => (
                <div key={requirement.id} property="ac:requirement" typeof="ac:Requirement" resource={requirement.id}>
                    {requirement.cspDirective && (
                        <span property="ac:cspDirective" content={requirement.cspDirective} />
                    )}
                    {requirement.browserPermission && (
                        <span property="ac:browserPermission" content={requirement.browserPermission} />
                    )}
                    <span property="dpv:hasPurpose" resource={requirement.hasPurpose} />
                </div>
            ))}
        </div>
    )
}
