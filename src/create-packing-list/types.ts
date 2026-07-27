export interface PackingList {
    id: string
    _rev?: string
    name: string
    createdAt: string
    lastModified?: string // ISO timestamp for conflict resolution
    sharedFromPodUrl?: string // set when this list was cached from a foreign pod; local-only, not serialized to RDF
    ownerWebId?: string       // WebID of the foreign pod owner; local-only, not serialized to RDF
    nights?: number    // how many nights away; drives suggested quantities
    // Trip context, all optional so the quick-create flow still works without
    // them. Dates are plain YYYY-MM-DD calendar days, not timestamps.
    destination?: string
    startDate?: string
    endDate?: string
    items: PackingListItem[]
    deletedItems?: PackingListItem[]
    guests?: Array<{ id: string; name: string }>
    // How this list was generated, remembered so it can later be re-run against
    // an updated question set ("Update from questions"). Both optional and
    // additive: legacy lists created before this existed have neither, and fall
    // back to reconstructing the inputs from their items' question/option ids.
    questionAnswers?: Array<{ questionId: string; selectedOptionIds: string[] }>
    selectedPeopleIds?: string[]
    // The order this list's sections are shown in, copied from the question set
    // at generation time (see `section-order.ts`). Stamped on the list rather
    // than read live from the question set so that a list shared from someone
    // else's pod arrives in the order its owner arranged, and so that changing
    // the order later doesn't reshuffle a list somebody is packing from.
    // Absent — as on every list generated before this existed, and on any set
    // whose owner never chose an order — means the `CATEGORY_ORDER` default.
    sectionOrder?: string[]
}

export interface PackingListItem {
    id: string
    itemText: string
    personId: string   // '' for communal and custom items
    personName: string // '' for communal items
    questionId: string
    optionId: string
    packed: boolean
    communal?: boolean // packed once for the whole group; absent = per-person
    quantity?: number  // how many to pack; absent = unspecified (1)
    category?: string
    order?: number     // position in the question set at generation time; absent on legacy items (sorted alphabetically)
    reviewed?: boolean
    lastModified?: string // ISO timestamp; absent on legacy items
}

export interface PackingListFormData {
    name: string
    // react-hook-form's valueAsNumber yields NaN for an empty input
    nights?: number
    destination?: string
    startDate?: string
    endDate?: string
    questionAnswers: {
        questionId: string
        selectedOptionIds: string[]
    }[]
} 