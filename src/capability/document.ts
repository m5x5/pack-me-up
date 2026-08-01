/**
 * The app's Application Capability description (https://dokieli.github.io/application-capability/),
 * served at "/" via content negotiation instead of the SPA when a client asks
 * for `application/ld+json` or `text/turtle` (see /middleware.ts).
 *
 * This describes Pack Me Up as a Solid-aware web app: what it can do
 * (Capabilities), how another agent invokes those actions (Invocations, as
 * RFC 6570 URI Templates resolved against the app's own origin), and what it
 * needs from its environment (Requirements: CSP directives, browser
 * permissions). Two representations are hand-maintained here - JSON-LD (the
 * spec's preferred format) and Turtle - and MUST describe the same triples.
 * If you change one, change the other.
 *
 * Grounded in the app's real shape, not aspirational: the vocabulary
 * (`pmu:`) and predicates match src/services/rdfVocab.ts and
 * src/services/rdfSerialization.ts exactly, the invocation templates match
 * routes in src/App.tsx, and the Requirements match actual browser API and
 * network usage (src/components/SharePackingListModal.tsx,
 * src/components/Toast.tsx, src/sentry.ts, Solid pod fetches).
 *
 * Some terms couldn't be verified against a live spec while this was written
 * (network access to w3.org and the ODRL/DPV vocabularies was blocked) -
 * flagged inline below with "unverified:". Worth a spec-in-hand review
 * before this is treated as normative.
 */

export const APP_ORIGIN = 'https://packmeup.tim-gent.com'

/**
 * Local context extension on top of https://www.w3.org/ns/ac.jsonld.
 * `resourceType`, `shape`, `action`, `hasPurpose`, `capability`,
 * `requirement`, `invocation`, `mapping.property` etc. are already defined
 * (and @protected) there - only the terms this document adds are declared
 * here. SHACL terms are added as their own compact-IRI keys (e.g.
 * "sh:targetClass") rather than bare aliases like "targetClass", so nothing
 * here can collide with an ac.jsonld term.
 */
const CONTEXT = [
    'https://www.w3.org/ns/ac.jsonld',
    {
        pmu: 'https://pack-me-up.app/vocab#',
        schema: 'https://schema.org/',
        dcterms: 'http://purl.org/dc/terms/',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        sh: 'http://www.w3.org/ns/shacl#',
        'sh:targetClass': { '@type': '@id' },
        'sh:path': { '@type': '@id' },
        'sh:class': { '@type': '@id' },
        'sh:datatype': { '@type': '@id' },
        'sh:nodeKind': { '@type': '@id' },
    },
]

// ---------------------------------------------------------------------------
// Capabilities + Invocations
// ---------------------------------------------------------------------------

const application = {
    id: `${APP_ORIGIN}/#i`,
    type: 'ac:Application',
    'as:name': 'Pack Me Up',
    capability: [
        `${APP_ORIGIN}/#capability-view-packing-list`,
        `${APP_ORIGIN}/#capability-view-question-set`,
        `${APP_ORIGIN}/#capability-create-packing-list`,
        `${APP_ORIGIN}/#capability-setup-wizard`,
    ],
    requirement: [
        `${APP_ORIGIN}/#requirement-scripts`,
        `${APP_ORIGIN}/#requirement-connect`,
        `${APP_ORIGIN}/#requirement-clipboard`,
    ],
}

// View a packing list - your own, or one shared into a foreign pod. The
// invocation is the spec's own "#open={open}" idiom: a single variable
// carrying the full resource IRI. The app doesn't parse that form yet - see
// the "future invocations" notes in the PR description; today's share links
// (buildSharedListUrl in src/services/solidPod.ts) instead spell podUrl and
// owner out as separate query parameters on a legacy-shaped path.
const capabilityViewPackingList = {
    id: `${APP_ORIGIN}/#capability-view-packing-list`,
    type: 'Capability',
    // unverified: odrl:use is a well-attested ODRL Vocabulary action, but
    // the exact ODRL 2.2 action list couldn't be re-checked against the spec.
    action: 'odrl:use',
    output: 'text/html',
    resourceType: 'pmu:PackingList',
    shape: `${APP_ORIGIN}/#PackingListShape`,
    invocation: `${APP_ORIGIN}/#invoke-view-packing-list`,
}

const invokeViewPackingList = {
    id: `${APP_ORIGIN}/#invoke-view-packing-list`,
    type: 'UriTemplateInvocation',
    template: '#open-packing-list={open}',
    mapping: [{ variable: 'open', property: 'ac:open' }],
}

// View a question/items set - today, own data only (see suggestion 2 below
// for extending this to shared question sets the way lists already are).
const capabilityViewQuestionSet = {
    id: `${APP_ORIGIN}/#capability-view-question-set`,
    type: 'Capability',
    action: 'odrl:use',
    output: 'text/html',
    resourceType: 'pmu:QuestionSet',
    shape: `${APP_ORIGIN}/#QuestionSetShape`,
    invocation: `${APP_ORIGIN}/#invoke-view-question-set`,
}

const invokeViewQuestionSet = {
    id: `${APP_ORIGIN}/#invoke-view-question-set`,
    type: 'UriTemplateInvocation',
    template: '#/manage-questions',
    mapping: [],
}

// Start the "create a new packing list" flow. No target resource exists yet,
// so there's no resourceType/shape to match against - just an action.
const capabilityCreatePackingList = {
    id: `${APP_ORIGIN}/#capability-create-packing-list`,
    type: 'Capability',
    action: 'as:Create',
    output: 'text/html',
    resourceType: 'pmu:PackingList',
    invocation: `${APP_ORIGIN}/#invoke-create-packing-list`,
}

const invokeCreatePackingList = {
    id: `${APP_ORIGIN}/#invoke-create-packing-list`,
    type: 'UriTemplateInvocation',
    template: '#/create-packing-list',
    mapping: [],
}

// Run the guided setup wizard, which generates a starter QuestionSet.
const capabilitySetupWizard = {
    id: `${APP_ORIGIN}/#capability-setup-wizard`,
    type: 'Capability',
    action: 'as:Create',
    output: 'text/html',
    resourceType: 'pmu:QuestionSet',
    invocation: `${APP_ORIGIN}/#invoke-setup-wizard`,
}

const invokeSetupWizard = {
    id: `${APP_ORIGIN}/#invoke-setup-wizard`,
    type: 'UriTemplateInvocation',
    template: '#/wizard',
    mapping: [],
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

const requirementScripts = {
    id: `${APP_ORIGIN}/#requirement-scripts`,
    type: 'Requirement',
    cspDirective: "script-src 'self'",
    // unverified: dpv:ServiceProvision is a commonly-cited DPV purpose term;
    // couldn't re-check it against the current DPV taxonomy.
    hasPurpose: 'dpv:ServiceProvision',
}

// Solid pods are arbitrary, user-chosen HTTPS origins (any Community Solid
// Server, Inrupt PodSpaces, or self-hosted pod a person points the app at),
// so this can't be a fixed allowlist the way requirement-scripts' script-src
// can. Sentry error reporting (src/sentry.ts) also needs an origin here, but
// it's covered by the same https: wildcard so isn't called out separately.
const requirementConnect = {
    id: `${APP_ORIGIN}/#requirement-connect`,
    type: 'Requirement',
    cspDirective: "connect-src 'self' https:",
    hasPurpose: 'dpv:ServiceProvision',
}

// navigator.clipboard.writeText - copying a share link
// (SharePackingListModal.tsx) and copying error details (Toast.tsx).
const requirementClipboard = {
    id: `${APP_ORIGIN}/#requirement-clipboard`,
    type: 'Requirement',
    browserPermission: 'clipboard-write',
    hasPurpose: 'dpv:ServiceProvision',
}

// ---------------------------------------------------------------------------
// SHACL shapes
//
// Not exhaustive - each covers the predicates that define the type (present
// on every instance, or structurally load-bearing), not every optional field
// PMU_NS carries. Cross-checked against packingListToDataset/
// questionSetToDataset in src/services/rdfSerialization.ts.
// ---------------------------------------------------------------------------

const packingListShape = {
    id: `${APP_ORIGIN}/#PackingListShape`,
    type: 'sh:NodeShape',
    'sh:targetClass': 'pmu:PackingList',
    'sh:property': [
        { 'sh:path': 'schema:name', 'sh:datatype': 'xsd:string', 'sh:minCount': 1, 'sh:maxCount': 1 },
        { 'sh:path': 'dcterms:created', 'sh:datatype': 'xsd:dateTime', 'sh:minCount': 1, 'sh:maxCount': 1 },
        { 'sh:path': 'dcterms:modified', 'sh:datatype': 'xsd:dateTime', 'sh:maxCount': 1 },
        { 'sh:path': 'pmu:destination', 'sh:datatype': 'xsd:string', 'sh:maxCount': 1 },
        // Stored as plain YYYY-MM-DD strings, not xsd:date, to avoid timezone drift.
        { 'sh:path': 'pmu:tripStartDate', 'sh:datatype': 'xsd:string', 'sh:maxCount': 1 },
        { 'sh:path': 'pmu:tripEndDate', 'sh:datatype': 'xsd:string', 'sh:maxCount': 1 },
        { 'sh:path': 'pmu:hasItem', 'sh:nodeKind': 'sh:IRI', 'sh:class': 'pmu:PackingListItem' },
        { 'sh:path': 'pmu:hasDeletedItem', 'sh:nodeKind': 'sh:IRI', 'sh:class': 'pmu:PackingListItem' },
        { 'sh:path': 'pmu:hasGuest', 'sh:nodeKind': 'sh:IRI' },
        { 'sh:path': 'pmu:selectedPersonId', 'sh:datatype': 'xsd:string' },
        { 'sh:path': 'pmu:hasAnswer', 'sh:nodeKind': 'sh:IRI' },
    ],
}

const questionSetShape = {
    id: `${APP_ORIGIN}/#QuestionSetShape`,
    type: 'sh:NodeShape',
    'sh:targetClass': 'pmu:QuestionSet',
    'sh:property': [
        { 'sh:path': 'dcterms:modified', 'sh:datatype': 'xsd:dateTime', 'sh:maxCount': 1 },
        { 'sh:path': 'pmu:hasPerson', 'sh:nodeKind': 'sh:IRI', 'sh:class': 'pmu:Person' },
        { 'sh:path': 'pmu:hasQuestion', 'sh:nodeKind': 'sh:IRI', 'sh:class': 'pmu:Question' },
        { 'sh:path': 'pmu:hasAlwaysNeededItem', 'sh:nodeKind': 'sh:IRI', 'sh:class': 'pmu:QuestionItem' },
        { 'sh:path': 'pmu:alwaysNeededEmptySection', 'sh:datatype': 'xsd:string' },
        { 'sh:path': 'pmu:hasSectionOrderEntry', 'sh:nodeKind': 'sh:IRI', 'sh:class': 'pmu:SectionOrderEntry' },
        { 'sh:path': 'pmu:templateVersion', 'sh:datatype': 'xsd:integer', 'sh:maxCount': 1 },
    ],
}

export const CAPABILITY_JSONLD = {
    '@context': CONTEXT,
    '@graph': [
        application,
        capabilityViewPackingList,
        invokeViewPackingList,
        capabilityViewQuestionSet,
        invokeViewQuestionSet,
        capabilityCreatePackingList,
        invokeCreatePackingList,
        capabilitySetupWizard,
        invokeSetupWizard,
        requirementScripts,
        requirementConnect,
        requirementClipboard,
        packingListShape,
        questionSetShape,
    ],
}

// Hand-maintained Turtle representation of the exact same triples as
// CAPABILITY_JSONLD above - see the module doc comment.
export const CAPABILITY_TURTLE = `@prefix ac: <https://www.w3.org/ns/ac#> .
@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix hydra: <http://www.w3.org/ns/hydra/core#> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dpv: <https://w3id.org/dpv#> .
@prefix pmu: <https://pack-me-up.app/vocab#> .
@prefix schema: <https://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

<${APP_ORIGIN}/#i> a ac:Application ;
    as:name "Pack Me Up" ;
    ac:capability
        <${APP_ORIGIN}/#capability-view-packing-list>,
        <${APP_ORIGIN}/#capability-view-question-set>,
        <${APP_ORIGIN}/#capability-create-packing-list>,
        <${APP_ORIGIN}/#capability-setup-wizard> ;
    ac:requirement
        <${APP_ORIGIN}/#requirement-scripts>,
        <${APP_ORIGIN}/#requirement-connect>,
        <${APP_ORIGIN}/#requirement-clipboard> .

# View a packing list - your own, or one shared into a foreign pod.
<${APP_ORIGIN}/#capability-view-packing-list> a ac:Capability ;
    ac:action odrl:use ;
    ac:output "text/html" ;
    ac:resourceType pmu:PackingList ;
    ac:shape <${APP_ORIGIN}/#PackingListShape> ;
    ac:invocation <${APP_ORIGIN}/#invoke-view-packing-list> .

<${APP_ORIGIN}/#invoke-view-packing-list> a ac:UriTemplateInvocation ;
    hydra:template "#open-packing-list={open}" ;
    hydra:mapping [ hydra:variable "open" ; hydra:property ac:open ] .

# View a question/items set - today, own data only.
<${APP_ORIGIN}/#capability-view-question-set> a ac:Capability ;
    ac:action odrl:use ;
    ac:output "text/html" ;
    ac:resourceType pmu:QuestionSet ;
    ac:shape <${APP_ORIGIN}/#QuestionSetShape> ;
    ac:invocation <${APP_ORIGIN}/#invoke-view-question-set> .

<${APP_ORIGIN}/#invoke-view-question-set> a ac:UriTemplateInvocation ;
    hydra:template "#/manage-questions" .

# Start the "create a new packing list" flow.
<${APP_ORIGIN}/#capability-create-packing-list> a ac:Capability ;
    ac:action as:Create ;
    ac:output "text/html" ;
    ac:resourceType pmu:PackingList ;
    ac:invocation <${APP_ORIGIN}/#invoke-create-packing-list> .

<${APP_ORIGIN}/#invoke-create-packing-list> a ac:UriTemplateInvocation ;
    hydra:template "#/create-packing-list" .

# Run the guided setup wizard, which generates a starter QuestionSet.
<${APP_ORIGIN}/#capability-setup-wizard> a ac:Capability ;
    ac:action as:Create ;
    ac:output "text/html" ;
    ac:resourceType pmu:QuestionSet ;
    ac:invocation <${APP_ORIGIN}/#invoke-setup-wizard> .

<${APP_ORIGIN}/#invoke-setup-wizard> a ac:UriTemplateInvocation ;
    hydra:template "#/wizard" .

<${APP_ORIGIN}/#requirement-scripts> a ac:Requirement ;
    ac:cspDirective "script-src 'self'" ;
    dpv:hasPurpose dpv:ServiceProvision .

# Solid pods are arbitrary, user-chosen HTTPS origins, so this can't be a
# fixed allowlist. Sentry error reporting is covered by the same https: wildcard.
<${APP_ORIGIN}/#requirement-connect> a ac:Requirement ;
    ac:cspDirective "connect-src 'self' https:" ;
    dpv:hasPurpose dpv:ServiceProvision .

# navigator.clipboard.writeText - copying a share link and copying error details.
<${APP_ORIGIN}/#requirement-clipboard> a ac:Requirement ;
    ac:browserPermission "clipboard-write" ;
    dpv:hasPurpose dpv:ServiceProvision .

<${APP_ORIGIN}/#PackingListShape> a sh:NodeShape ;
    sh:targetClass pmu:PackingList ;
    sh:property
        [ sh:path schema:name ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ],
        [ sh:path dcterms:created ; sh:datatype xsd:dateTime ; sh:minCount 1 ; sh:maxCount 1 ],
        [ sh:path dcterms:modified ; sh:datatype xsd:dateTime ; sh:maxCount 1 ],
        [ sh:path pmu:destination ; sh:datatype xsd:string ; sh:maxCount 1 ],
        [ sh:path pmu:tripStartDate ; sh:datatype xsd:string ; sh:maxCount 1 ],
        [ sh:path pmu:tripEndDate ; sh:datatype xsd:string ; sh:maxCount 1 ],
        [ sh:path pmu:hasItem ; sh:nodeKind sh:IRI ; sh:class pmu:PackingListItem ],
        [ sh:path pmu:hasDeletedItem ; sh:nodeKind sh:IRI ; sh:class pmu:PackingListItem ],
        [ sh:path pmu:hasGuest ; sh:nodeKind sh:IRI ],
        [ sh:path pmu:selectedPersonId ; sh:datatype xsd:string ],
        [ sh:path pmu:hasAnswer ; sh:nodeKind sh:IRI ] .

<${APP_ORIGIN}/#QuestionSetShape> a sh:NodeShape ;
    sh:targetClass pmu:QuestionSet ;
    sh:property
        [ sh:path dcterms:modified ; sh:datatype xsd:dateTime ; sh:maxCount 1 ],
        [ sh:path pmu:hasPerson ; sh:nodeKind sh:IRI ; sh:class pmu:Person ],
        [ sh:path pmu:hasQuestion ; sh:nodeKind sh:IRI ; sh:class pmu:Question ],
        [ sh:path pmu:hasAlwaysNeededItem ; sh:nodeKind sh:IRI ; sh:class pmu:QuestionItem ],
        [ sh:path pmu:alwaysNeededEmptySection ; sh:datatype xsd:string ],
        [ sh:path pmu:hasSectionOrderEntry ; sh:nodeKind sh:IRI ; sh:class pmu:SectionOrderEntry ],
        [ sh:path pmu:templateVersion ; sh:datatype xsd:integer ; sh:maxCount 1 ] .
`
