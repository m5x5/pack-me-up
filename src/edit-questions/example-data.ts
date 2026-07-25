import { PackingListQuestionSet, Person, Item } from './types';
import { generateUUID } from '../utils/uuid';

export const ACTIVITY_OPTION_IDS = {
    swimming: 'activity-option-swimming',
    beach: 'activity-option-beach',
    watersports: 'activity-option-watersports',
    cycling: 'activity-option-cycling',
    running: 'activity-option-running',
    climbing: 'activity-option-climbing',
    hiking: 'activity-option-hiking',
    sightseeing: 'activity-option-sightseeing',
    skiing: 'activity-option-skiing',
    themePark: 'activity-option-theme-park',
    formalOccasions: 'activity-option-formal-occasions',
} as const

// Stable IDs for the options of the other multiple-choice questions. Like the
// activity IDs, these let template-update matching find an option by id even
// after the user has renamed it — text matching is only the fallback.
export const WEATHER_OPTION_IDS = {
    hot: 'weather-option-hot',
    strongSun: 'weather-option-strong-sun',
    mild: 'weather-option-mild',
    rain: 'weather-option-rain',
    cold: 'weather-option-cold',
    snow: 'weather-option-snow',
} as const

export const TRANSPORT_OPTION_IDS = {
    flying: 'transport-option-flying',
    driving: 'transport-option-driving',
    train: 'transport-option-train',
    ferry: 'transport-option-ferry',
} as const

export const ACCOMMODATION_OPTION_IDS = {
    hotel: 'accommodation-option-hotel',
    selfCatering: 'accommodation-option-self-catering',
    someoneElsesHome: 'accommodation-option-someone-elses-home',
    camping: 'accommodation-option-camping',
    cruise: 'accommodation-option-cruise',
} as const

// Stable IDs for the built-in wizard questions. Using fixed IDs (rather than
// fresh UUIDs) lets template-update detection match a user's saved question
// back to its template origin exactly, even after the question text is edited.
export const TEMPLATE_QUESTION_IDS = {
    overnight: 'template-question-overnight',
    abroad: 'template-question-abroad',
    weather: 'template-question-weather',
    transport: 'template-question-transport',
    accommodation: 'template-question-accommodation',
    activities: 'template-question-activities',
} as const

// Version of the wizard template content. Bump this whenever `createExampleData`
// changes in a way existing users should be offered (new items, options, or
// questions). A saved question set stamped with an older version triggers the
// "new suggestions" review card on My Questions & Items; the stamp is updated
// once the user reviews (applies or dismisses) the suggestions. Purely
// additive detection — bumping never removes or rewrites a user's own edits.
//
// Note: only *additions* are deliverable this way. Changes that rewrite an
// existing item (a corrected age filter, a new quantity rate, flipping an item
// to communal) reach new users only; `buildTemplateUpdateSuggestions` matches
// on item text and never rewrites what the user already has.
export const WIZARD_TEMPLATE_VERSION = 2
import {
    getBabies,
    getToddlers,
    getChildren,
    getTeenagers,
    getAdults,
    getTeenagersAndAdults,
    getChildrenAndOlder,
    getToddlersAndOlder,
    getBabiesAndToddlers,
    getUnderTeenagers,
    getFemaleTeenagersAndAdults,
    AgeRangeFilter,
} from './age-specific-items';
import { getDogs, getCats, getPets, getHumans } from './pet-specific-items';

/**
 * Helper function to create an item with age-appropriate person selections
 * @param text - The item text/name
 * @param people - All people in the group
 * @param ageFilter - Optional function to filter people (defaults to all humans).
 *   Defaulting to humans (rather than everyone) keeps pets from inheriting
 *   human items; it's a no-op for groups with no pets.
 * @param quantity - Optional rate for suggested quantities: pack `perNight`
 *   per `perNights` nights (default 1), capped at `maxQuantity`
 */
function item(
    text: string,
    people: Person[],
    ageFilter?: (p: Person[]) => Person[],
    quantity?: { perNight: number; perNights?: number; maxQuantity?: number }
): Item {
    const selectedPeople = ageFilter ? ageFilter(people) : getHumans(people);
    const ageRanges = ageFilter && 'ageRanges' in ageFilter
        ? [...(ageFilter as AgeRangeFilter).ageRanges]
        : undefined;
    return {
        text,
        ...(ageRanges ? { ageRanges } : {}),
        ...(quantity ? {
            perNight: quantity.perNight,
            ...(quantity.perNights !== undefined ? { perNights: quantity.perNights } : {}),
            ...(quantity.maxQuantity !== undefined ? { maxQuantity: quantity.maxQuantity } : {}),
        } : {}),
        personSelections: people.map(p => ({
            personId: p.id,
            selected: selectedPeople.some(sp => sp.id === p.id)
        }))
    };
}

/**
 * Like `item`, but packed once for the whole group. The person selections
 * become a trigger: the item is included when at least one selected person
 * is on the trip (e.g. a litter tray only when the cat is coming).
 *
 * Take care combining this with a narrow age filter: `items()` below drops any
 * item nobody is selected for, so a communal item filtered to `getAdults`
 * disappears from the question set entirely for an adult-free group. Only
 * narrow a communal item when the filter is a genuine trigger (pets, babies),
 * not when it is a guess at who packs it.
 */
function communalItem(text: string, people: Person[], ageFilter?: (p: Person[]) => Person[]): Item {
    return { ...item(text, people, ageFilter), communal: true };
}

function items(...args: Item[]): Item[] {
    return args.filter(i => i.personSelections.some(ps => ps.selected));
}

export function createExampleData(people: Person[], selectedActivityIds: string[] = []): PackingListQuestionSet {
    const validActivityIds = Object.values(ACTIVITY_OPTION_IDS) as string[]
    const validSelectedIds = selectedActivityIds.filter(id => validActivityIds.includes(id))
    const activitiesQuestionId = TEMPLATE_QUESTION_IDS.activities

    const allActivityOptions = [
        {
            id: ACTIVITY_OPTION_IDS.swimming,
            text: "Swimming",
            order: 0,
            items: items(
                item("Swimsuit", people, getToddlersAndOlder, { perNight: 1, perNights: 4, maxQuantity: 2 }),
                item("Swim towel", people),
                item("Goggles", people, getChildrenAndOlder),
                communalItem("Wet bag", people),
                item("Baby swim nappy", people, getBabies),
                item("Baby float/Swim seat", people, getBabies),
                item("Baby sun hat with neck protection", people, getBabies),
                item("Baby rash guard/Sun suit", people, getBabies),
                item("Swim nappy (if not potty trained)", people, getToddlers),
                item("Armbands", people, getToddlers),
                item("Toddler sun hat", people, getToddlers),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.beach,
            text: "Beach",
            order: 1,
            items: items(
                item("Beach towel", people),
                item("Flip-flops", people, getToddlersAndOlder),
                communalItem("Bucket and spade", people, getUnderTeenagers),
                communalItem("Beach shade or windbreak", people),
                communalItem("Cool bag", people),
                communalItem("Beach bag", people),
                communalItem("After-sun", people),
                item("Snorkel and mask", people, getChildrenAndOlder),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.watersports,
            text: "Watersports",
            order: 2,
            items: items(
                item("Wetsuit", people, getChildrenAndOlder),
                item("Water shoes", people, getChildrenAndOlder),
                item("Waterproof bag", people, getChildrenAndOlder),
                item("Rash guard", people, getChildrenAndOlder),
                item("Buoyancy aid", people, getUnderTeenagers),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.cycling,
            text: "Cycling",
            order: 3,
            items: items(
                item("Cycling shorts", people, getChildrenAndOlder),
                item("Sports bra", people, getFemaleTeenagersAndAdults),
                item("Helmet", people, getChildrenAndOlder),
                communalItem("Bike repair kit", people, getTeenagersAndAdults),
                item("Cycling gloves", people, getChildrenAndOlder),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.running,
            text: "Running",
            order: 4,
            items: items(
                item("Running shoes", people, getChildrenAndOlder),
                item("Running clothes", people, getChildrenAndOlder),
                item("Sports bra", people, getFemaleTeenagersAndAdults),
                item("Sports watch", people, getTeenagersAndAdults),
                item("Running socks", people, getChildrenAndOlder),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.climbing,
            text: "Climbing",
            order: 5,
            items: items(
                item("Climbing shoes", people, getChildrenAndOlder),
                item("Sports bra", people, getFemaleTeenagersAndAdults),
                item("Chalk bag", people, getChildrenAndOlder),
                item("Harness", people, getChildrenAndOlder),
                item("Belay device", people, getTeenagersAndAdults),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.hiking,
            text: "Hiking",
            order: 6,
            items: items(
                item("Hiking boots", people, getChildrenAndOlder),
                item("Sports bra", people, getFemaleTeenagersAndAdults),
                item("Walking poles", people, getAdults),
                communalItem("Trail map", people, getAdults),
                communalItem("Blister plasters", people),
                item("Toddler reins/Backpack harness", people, getToddlers),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.sightseeing,
            text: "Sightseeing and city walking",
            order: 7,
            items: items(
                item("Comfortable walking shoes", people, getToddlersAndOlder),
                item("Power bank", people, getTeenagersAndAdults),
                communalItem("Offline maps downloaded", people, getTeenagersAndAdults),
                item("Modest clothing for religious sites (covers shoulders and knees)", people, getChildrenAndOlder),
                item("Easy-to-remove shoes", people, getToddlersAndOlder),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.skiing,
            text: "Skiing or snowboarding",
            order: 8,
            items: items(
                item("Ski jacket and salopettes", people, getToddlersAndOlder),
                item("Thermal base layers", people, getToddlersAndOlder),
                item("Ski socks", people, getToddlersAndOlder),
                item("Ski goggles", people, getToddlersAndOlder),
                item("Ski helmet", people, getToddlersAndOlder),
                item("Snow boots", people, getToddlersAndOlder),
                communalItem("Sunscreen", people),
                item("Lip balm with SPF", people, getChildrenAndOlder),
                communalItem("Hand warmers", people, getChildrenAndOlder),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.themePark,
            text: "Theme park or days out",
            order: 9,
            items: items(
                item("Comfortable walking shoes", people, getToddlersAndOlder),
                item("Poncho", people),
                item("Power bank", people, getTeenagersAndAdults),
                communalItem("Cool bag", people),
                item("Ear defenders", people, getUnderTeenagers),
            )
        },
        {
            id: ACTIVITY_OPTION_IDS.formalOccasions,
            text: "Formal occasions",
            order: 10,
            items: items(
                item("Formal outfit", people),
                item("Dress shoes", people, getToddlersAndOlder),
                item("Watch", people, getTeenagersAndAdults),
                item("Jewellery", people, getTeenagersAndAdults),
                item("Evening bag/Clutch", people, getTeenagersAndAdults),
            )
        }
    ]

    const activityOptions = validSelectedIds.length > 0
        ? allActivityOptions.filter(opt => validSelectedIds.includes(opt.id))
        : allActivityOptions

    return {
        _id: "1",
        people,
        alwaysNeededItems: items(
            item("Day bag / Backpack", people, getChildrenAndOlder),
            item("Snacks", people, getToddlersAndOlder),
            item("Water bottle", people, getToddlersAndOlder),
            item("Phone", people, getTeenagersAndAdults),
            item("Phone charger", people, getTeenagersAndAdults),
            item("Power bank", people, getTeenagersAndAdults),
            item("Headphones", people, getChildrenAndOlder),
            item("Wallet and bank cards", people, getTeenagersAndAdults),
            communalItem("House keys", people),
            // Health — nothing here is reliably replaceable away from home
            item("Prescription medication", people),
            item("Glasses / contact lenses", people, getChildrenAndOlder),
            item("Contact lens solution", people, getTeenagersAndAdults),
            communalItem("First aid kit", people),
            communalItem("Plasters", people),
            communalItem("Pain relief (paracetamol / ibuprofen)", people),
            communalItem("Children's paracetamol / ibuprofen", people, getUnderTeenagers),
            communalItem("Thermometer", people),
            communalItem("Hand sanitiser", people),
            communalItem("Tissues", people),
            communalItem("Reusable bags", people),
            // Baby
            item("Nappies (pack/supply)", people, getBabies, { perNight: 6 }),
            communalItem("Wipes", people, getBabiesAndToddlers),
            communalItem("Nappy bags", people, getBabies),
            communalItem("Change mat", people, getBabies),
            item("Nappy cream", people, getBabies),
            item("Bibs", people, getBabies),
            item("Muslins/Burp cloths", people, getBabies),
            item("Bottles (if bottle feeding)", people, getBabies),
            communalItem("Bottle brush and steriliser bags", people, getBabies),
            item("Formula/Baby food", people, getBabies, { perNight: 4 }),
            item("Dummy (if used)", people, getBabies),
            item("Teething gel", people, getBabies),
            item("Spare clothes", people, getBabies, { perNight: 1, perNights: 2, maxQuantity: 6 }),
            communalItem("Pram/Buggy", people, getBabiesAndToddlers),
            communalItem("Pram rain cover", people, getBabiesAndToddlers),
            communalItem("Baby carrier/Sling", people, getBabies),
            // Toddler
            item("Pull-ups/Toddler nappies", people, getToddlers, { perNight: 4 }),
            communalItem("Potty (travel potty)", people, getToddlers),
            item("Spare clothes", people, getToddlers, { perNight: 1, perNights: 3, maxQuantity: 4 }),
            item("Sippy cup/Toddler cup", people, getToddlers),
            item("Comfort item (teddy/blanket)", people, getToddlers),
            // Child
            item("Colouring book and pens", people, getChildren),
            communalItem("Playing cards/Travel games", people, getChildrenAndOlder),
            item("Tablet and charger", people, getChildrenAndOlder),
            item("Ear defenders", people, getUnderTeenagers),
            // Pet items — only appear when a matching pet is in the group
            communalItem("Pet food", people, getPets),
            communalItem("Food & water bowls", people, getPets),
            communalItem("Travel water bottle and folding bowl", people, getPets),
            item("Pet bed/blanket", people, getPets),
            item("Pet medication", people, getPets),
            item("Vaccination/health records", people, getPets),
            communalItem("Pet first aid kit", people, getPets),
            communalItem("Tick remover", people, getPets),
            communalItem("Vet contact details", people, getPets),
            item("Lead/Leash", people, getDogs),
            item("Collar & ID tag", people, getDogs),
            communalItem("Poo bags", people, getDogs),
            item("Dog toy", people, getDogs),
            item("Pet towel", people, getDogs),
            item("Dog travel harness or crate", people, getDogs),
            communalItem("Litter tray & litter", people, getCats),
            item("Cat carrier", people, getCats),
        ),
        questions: [
            {
                id: TEMPLATE_QUESTION_IDS.overnight,
                type: "saved",
                text: "Will you be staying overnight?",
                order: 0,
                questionType: "single-choice",
                options: [
                    {
                        id: generateUUID(),
                        text: "Yes",
                        order: 0,
                        items: items(
                            item("Toothbrush", people, getToddlersAndOlder),
                            communalItem("Toothpaste", people),
                            communalItem("Shampoo", people),
                            communalItem("Shower gel", people),
                            item("Hairbrush/Comb", people, getChildrenAndOlder),
                            item("Deodorant", people, getChildrenAndOlder),
                            item("Toiletries bag", people, getChildrenAndOlder),
                            item("Face wash", people, getChildrenAndOlder),
                            item("Skincare products", people, getTeenagers),
                            item("Razor / shaving kit", people, getTeenagersAndAdults),
                            item("Menstrual products", people, getFemaleTeenagersAndAdults, { perNight: 1, perNights: 7, maxQuantity: 2 }),
                            item("Bra", people, getFemaleTeenagersAndAdults),
                            item("Pyjamas", people, undefined, { perNight: 1, perNights: 3, maxQuantity: 3 }),
                            item("Underwear", people, getToddlersAndOlder, { perNight: 1, maxQuantity: 10 }),
                            item("Socks", people, undefined, { perNight: 1, maxQuantity: 10 }),
                            item("T-shirt/Top", people, undefined, { perNight: 1, maxQuantity: 10 }),
                            item("Trousers/Shorts", people, undefined, { perNight: 1, perNights: 3, maxQuantity: 5 }),
                            item("Jumper", people, undefined, { perNight: 1, perNights: 4, maxQuantity: 2 }),
                            communalItem("Laundry bag", people),
                            communalItem("Travel detergent", people),
                            item("Travel pillow", people, getTeenagersAndAdults),
                            item("Earplugs and eye mask", people, getTeenagersAndAdults),
                            communalItem("Baby monitor", people, getBabies),
                            item("Nightlight", people, getUnderTeenagers),
                            communalItem("Blackout blind", people, getBabiesAndToddlers),
                            item("Baby sleeping bag/Swaddle", people, getBabies),
                            communalItem("Extra bedding/sheets", people, getBabies),
                            item("Bedtime bottle", people, getBabies),
                            item("Bedtime books", people, getToddlers),
                            item("Night nappy/Pull-up", people, getToddlers),
                            item("Favourite toy/Stuffed animal", people, getChildren),
                            item("Torch", people, getChildrenAndOlder),
                        )
                    },
                    {
                        id: generateUUID(),
                        text: "No",
                        order: 1,
                        items: []
                    }
                ]
            },
            {
                id: TEMPLATE_QUESTION_IDS.abroad,
                type: "saved",
                text: "Are you travelling abroad?",
                order: 1,
                questionType: "single-choice",
                options: [
                    {
                        id: generateUUID(),
                        text: "Yes",
                        order: 0,
                        items: items(
                            item("Passport", people),
                            item("Visa", people),
                            item("EHIC/GHIC card", people),
                            communalItem("Travel insurance documents", people),
                            communalItem("Booking confirmations", people),
                            communalItem("Local currency", people, getAdults),
                            communalItem("Copies of important documents", people, getAdults),
                            item("Travel adapter", people, getTeenagersAndAdults),
                            item("Pet passport/Animal health certificate", people, getPets),
                        )
                    },
                    {
                        id: generateUUID(),
                        text: "No",
                        order: 1,
                        items: []
                    }
                ]
            },
            {
                id: TEMPLATE_QUESTION_IDS.weather,
                type: "saved",
                text: "What weather do you expect?",
                order: 2,
                questionType: "multiple-choice",
                options: [
                    {
                        id: WEATHER_OPTION_IDS.hot,
                        text: "Hot",
                        order: 0,
                        items: items(
                            communalItem("Sunscreen", people),
                            item("Sun hat", people, getChildrenAndOlder),
                            item("Sunglasses", people, getChildrenAndOlder),
                            item("Sandals", people, getToddlersAndOlder),
                            communalItem("Insect repellent", people),
                            communalItem("After-sun", people),
                            communalItem("Antihistamines", people),
                            communalItem("Baby sunscreen (SPF 50+)", people, getBabies),
                            item("Sun protective baby clothing", people, getBabies),
                            communalItem("Shade cover/Parasol for pram", people, getBabies),
                            communalItem("Toddler sunscreen", people, getToddlers),
                            item("Sun protective clothing", people, getToddlers),
                            communalItem("Kids sunscreen", people, getChildren),
                        )
                    },
                    {
                        id: WEATHER_OPTION_IDS.strongSun,
                        text: "Strong sun",
                        order: 1,
                        items: items(
                            communalItem("Sunscreen", people),
                            item("Sun hat", people, getChildrenAndOlder),
                            item("Sunglasses", people, getChildrenAndOlder),
                            item("Lip balm with SPF", people, getChildrenAndOlder),
                        )
                    },
                    {
                        id: WEATHER_OPTION_IDS.mild,
                        text: "Mild",
                        order: 2,
                        items: items(
                            item("Light jacket", people),
                            item("Long-sleeved shirts", people),
                            item("Comfortable walking shoes", people, getToddlersAndOlder),
                        )
                    },
                    {
                        id: WEATHER_OPTION_IDS.rain,
                        text: "Rain",
                        order: 3,
                        items: items(
                            item("Raincoat", people),
                            communalItem("Umbrella", people),
                            item("Waterproof shoes/boots", people),
                            communalItem("Waterproof rucksack cover", people, getChildrenAndOlder),
                        )
                    },
                    {
                        id: WEATHER_OPTION_IDS.cold,
                        text: "Cold",
                        order: 4,
                        items: items(
                            item("Winter coat", people, getChildrenAndOlder),
                            item("Gloves", people, getChildrenAndOlder),
                            item("Scarf", people, getChildrenAndOlder),
                            item("Warm hat/Beanie", people, getChildrenAndOlder),
                            item("Thermal underwear", people, getChildrenAndOlder),
                            item("Warm boots", people, getToddlersAndOlder),
                            item("Baby snowsuit/Pramsuit", people, getBabies),
                            item("Baby mittens", people, getBabies),
                            item("Baby warm hat with ear coverage", people, getBabies),
                            communalItem("Blanket for carrier/pram", people, getBabies),
                            item("Toddler snowsuit/Winter coat", people, getToddlers),
                            item("Toddler mittens (not gloves - easier)", people, getToddlers),
                            item("Toddler warm hat", people, getToddlers),
                        )
                    },
                    {
                        id: WEATHER_OPTION_IDS.snow,
                        text: "Snow or ice",
                        order: 5,
                        items: items(
                            item("Snow boots", people, getToddlersAndOlder),
                            item("Thermal socks", people, getToddlersAndOlder),
                            item("Ice grips for shoes", people, getAdults),
                        )
                    }
                ]
            },
            {
                id: TEMPLATE_QUESTION_IDS.transport,
                type: "saved",
                text: "How are you getting there?",
                order: 3,
                questionType: "multiple-choice",
                options: [
                    {
                        id: TRANSPORT_OPTION_IDS.flying,
                        text: "Flying",
                        order: 0,
                        items: items(
                            communalItem("Boarding passes", people),
                            item("Hand luggage liquids bag", people, getTeenagersAndAdults),
                            item("Medication in hand luggage", people),
                            item("Travel pillow", people, getTeenagersAndAdults),
                            communalItem("Downloaded films and music", people),
                            item("Milk or dummy for take-off and landing", people, getBabies),
                            item("Spare clothes in cabin bag", people, getBabiesAndToddlers),
                        )
                    },
                    {
                        id: TRANSPORT_OPTION_IDS.driving,
                        text: "Driving",
                        order: 1,
                        items: items(
                            item("Driving licence", people, getAdults),
                            communalItem("Car keys", people),
                            communalItem("Breakdown cover documents", people, getAdults),
                            communalItem("Car charger", people),
                            item("Car seat", people, getUnderTeenagers),
                            communalItem("Travel sickness tablets", people),
                            communalItem("Sick bags", people),
                            communalItem("Snacks for the journey", people),
                            communalItem("Window sun shades", people, getUnderTeenagers),
                        )
                    },
                    {
                        id: TRANSPORT_OPTION_IDS.train,
                        text: "Train or coach",
                        order: 2,
                        items: items(
                            communalItem("Tickets", people),
                            communalItem("Downloaded films and music", people),
                            communalItem("Snacks for the journey", people),
                        )
                    },
                    {
                        id: TRANSPORT_OPTION_IDS.ferry,
                        text: "Ferry",
                        order: 3,
                        items: items(
                            communalItem("Tickets", people),
                            communalItem("Seasickness remedies", people),
                            communalItem("Cabin overnight bag", people),
                        )
                    }
                ]
            },
            {
                id: TEMPLATE_QUESTION_IDS.accommodation,
                type: "saved",
                text: "Where will you be staying?",
                order: 4,
                questionType: "multiple-choice",
                options: [
                    {
                        id: ACCOMMODATION_OPTION_IDS.hotel,
                        text: "Hotel or B&B",
                        order: 0,
                        items: items(
                            communalItem("Booking confirmations", people),
                        )
                    },
                    {
                        id: ACCOMMODATION_OPTION_IDS.selfCatering,
                        text: "Self-catering (cottage, apartment, villa)",
                        order: 1,
                        items: items(
                            communalItem("Booking confirmations", people),
                            communalItem("Towels", people),
                            communalItem("Dish soap and sponge", people),
                            communalItem("Dishwasher tablets", people),
                            communalItem("Tea towels", people),
                            communalItem("Bin bags", people),
                            communalItem("Tea and coffee", people),
                            communalItem("Sharp knife", people),
                            communalItem("Foil and cling film", people),
                            communalItem("Corkscrew", people, getAdults),
                            communalItem("Highchair or booster seat", people, getBabiesAndToddlers),
                        )
                    },
                    {
                        id: ACCOMMODATION_OPTION_IDS.someoneElsesHome,
                        text: "Someone else's home",
                        order: 2,
                        items: items(
                            communalItem("Host gift", people),
                            communalItem("Towels", people),
                            communalItem("Travel cot", people, getBabiesAndToddlers),
                            communalItem("Travel cot sheet", people, getBabiesAndToddlers),
                            communalItem("Stair gate", people, getBabiesAndToddlers),
                            communalItem("Blackout blind", people, getBabiesAndToddlers),
                        )
                    },
                    {
                        id: ACCOMMODATION_OPTION_IDS.camping,
                        text: "Camping or caravan",
                        order: 3,
                        items: items(
                            communalItem("Tent", people),
                            item("Sleeping bag", people),
                            item("Sleeping mat", people),
                            item("Head torch", people, getChildrenAndOlder),
                            communalItem("Camping stove and gas", people, getAdults),
                            communalItem("Matches or lighter", people, getAdults),
                            communalItem("Camp chairs", people),
                            communalItem("Washing-up bowl and liquid", people),
                            communalItem("Towels", people),
                            communalItem("Bin bags", people),
                            item("Wellies", people, getToddlersAndOlder),
                        )
                    },
                    {
                        id: ACCOMMODATION_OPTION_IDS.cruise,
                        text: "Cruise ship",
                        order: 4,
                        items: items(
                            communalItem("Booking confirmations", people),
                            communalItem("Seasickness remedies", people),
                            item("Lanyard for key card", people, getChildrenAndOlder),
                            item("Formal outfit", people),
                            communalItem("Port daypack", people),
                        )
                    }
                ]
            },
            {
                id: activitiesQuestionId,
                type: "saved",
                text: "What activities will you be doing?",
                order: 5,
                questionType: "multiple-choice",
                options: activityOptions
            }
        ]
    };
}
