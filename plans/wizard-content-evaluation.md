# Wizard content evaluation

An assessment of the built-in wizard template (`src/edit-questions/example-data.ts`)
against one goal: **a typical family — adults, teens, children, toddlers, babies,
sometimes a pet — packing for a wide range of trip types.**

Three areas were reviewed: the question set, the items, and the categories the
generated packing list is grouped by. No code changes are proposed here; this is
the case for what should be added, changed and removed.

---

## Headline

The template models **one trip archetype: a hotel or villa holiday with adult
hobbies.** It serves beach packages, weddings abroad and hiking well. It has no
representation at all of **flying, driving, or camping** — three of the most
common family trips — and no concept of **accommodation type** or **laundry
availability**, which are the two facts that most change what a family packs.

Separately, and independently of coverage, two structural defects distort every
list it generates:

1. **Unfiltered items include babies.** `item()` defaults to `getHumans`
   (`example-data.ts:64`), so a generic item goes to the baby as well as the
   dedicated baby item. A family selecting "Cold" gets generic winter kit for the
   baby *and* the baby snowsuit; "Hot" produces four separate sunscreen lines.
2. **Category is decided by deduplication order, not by content.** Every section
   heading is derived, not stamped — and where two lists carry the same item, the
   copy that survives dedup determines the heading.

---

## 1. Questions

### Coverage by trip archetype

| Archetype | Served? | Critical gap |
|---|---|---|
| Day trip | Good | Picnic/cool bag, buggy |
| Weekend at grandparents | Partial | Travel cot, stair gate, high chair, blackout blind; "self-catering?" is unanswerable here |
| UK hotel break | Good | Over-packs towels/toiletries the hotel supplies |
| Beach package | Partial | No "Beach" option — Swimming is pool-shaped (goggles, swim cap, kickboard). No beach towel, bucket & spade, cool bag, after-sun |
| Long-haul flight | **None** | Hand-luggage liquids, travel pillow, downloaded content, meds in carry-on, boarding passes, milk for take-off |
| Road trip | **None** | Car seats, sickness tablets, sick bags, car charger, breakdown docs, driving licence |
| Camping / glamping | **None** | Tent, sleeping bags, mats, head torches, stove, camp chairs, wellies |
| Festival | **None** | Wellies, poncho, kids' ear defenders, cash, portable charger |
| Ski / snow | **None** | No ski option despite full baby/toddler snowsuit kit existing under "Cold" |
| Cruise | Partial | Seasickness remedies, lanyard, port daypack |
| City break | Partial | No sightseeing option: day pack, power bank, offline maps |
| Self-catering cottage | Thin | The Yes branch is **four** washing-up items (`:349-354`) |
| Visiting friends with a baby | Partial | Travel cot, sterilising, high chair, host gift |
| Wedding abroad | Good | Gift, garment bag, spare tights |
| Medical needs | **None** | No prescription meds anywhere — the most serious single gap in the app |

### Add — ranked

1. **"How are you getting there?"** *(multiple choice: flying / driving / train
   or coach / ferry or cruise / public transport there)* — the highest-impact
   addition. Gates the entire air-travel and car-travel item sets, neither of
   which exists today.
2. **"Where will you be staying?"** *(hotel or B&B / self-catering / someone
   else's home / camping or caravan / festival / cruise ship)* — **replaces** the
   current self-catering question. Same information, three more archetypes
   unlocked.
3. **More activity options** — ranked by family frequency: Beach, Sightseeing &
   city walking, Skiing & snowboarding, Theme park, Spa & hotel pool,
   Snorkelling. Beach and sightseeing alone cover the two most common family
   holidays.
4. **"Will you be able to wash clothes?"** — should modulate the `perNight`
   quantities rather than add items. Nothing else halves the size of a suitcase.
5. **"Does anyone need medication or medical kit?"** — low interaction cost, and
   the one gap where forgetting is genuinely dangerous.

### Change

| Where | Problem | Fix |
|---|---|---|
| `:408-418` "Warm" | Its items are *light jacket, layers, long-sleeved shirts* — that's **Mild**. Someone picking "Warm" for a 25°C trip gets a jacket and no sunscreen | Relabel to "Mild"; anchor every option with a temperature range |
| `:384` Sunscreen | Exists **only** under "Hot" — a ski family is never offered it | Move to a "Strong sun" condition, or duplicate into Snow and Beach |
| `:377-439` Weather | Mixes two axes: three temperatures plus one condition ("Rain"), and Hot + Warm are selectable together | Split temperature options from condition options (Rain, Snow/ice, Strong sun, Insects) |
| `:277` "Passport/ID" | A weekend at grandparents does not need a passport, and it collides with `:320` "Passport" | Delete the overnight one |
| `:122-168` Watersports / Cycling / Running / Climbing | Every item is `getTeenagersAndAdults` — a 9-year-old cycling gets **nothing**, including a helmet | Widen to `getChildrenAndOlder` |
| `:264` "Will you be staying overnight?" | The create-list form already captures `nights` — the same fact asked twice in two formats | Derive from `nights > 0` |

The three Yes/No questions (`:300-305`, `:330-335`, `:356-361`) all have a "No"
branch carrying **zero items** — three of five interactions with a 50% chance of
being a no-op. If self-catering moves into the accommodation question, merge the
remaining two into one multiple-choice *"About this trip — tick all that apply"*.

### Remove or merge

- **Climbing** (`:157-169`) — belay device and chalk bag; sub-2% of families.
- **Running + Cycling** → merge into "Sport & exercise"; both adult-only and
  heavily overlapping.
- **Visiting religious sites** (`:198-208`) — all five items are "wear modest
  clothes"; fold into Sightseeing as a single line.

### Order

Current: overnight → abroad → self-catering → activities → weather.

**Weather in last place is the main error.** It applies to 100% of trips and
generates the most clothing, but sits behind the longest, most optional question.
Recommended: universal-and-cheap first, long-and-optional last —
trip basics → **weather** → transport → accommodation → medical → **activities**.

---

## 2. Items

### Missing — trip is materially broken without these

| # | Item | Note |
|---|---|---|
| 1 | **Prescription / regular medication** | Absent entirely. Pets get `Pet medication` (`:250`); humans get nothing |
| 2 | **Children's medicine + thermometer** | `Pain relief` (`:245`) is `getAdults` only. A family with a feverish toddler abroad has nothing |
| 3 | **Glasses, contact lenses, lens solution** | Absent |
| 4 | **Car seat / booster seat** | Legally required, cannot be improvised |
| 5 | **Wallet, bank cards, cash, driving licence** | Only `Local currency` (`:323`), abroad-only, adults-only |
| 6 | **House and car keys** | Absent |
| 7 | **Tickets, boarding passes, booking confirmations** | Absent |
| 8 | **Pram / buggy + rain cover** | Only exists under **Hiking** (`:183`) — yet "Hot" packs a pram parasol (`:391`) for a pram that was never packed |
| 9 | **Travel cot + sheet** | `Extra bedding/sheets` (`:291`) exists with nothing to put it on |
| 10 | **Baby carrier / sling** | Only under Hiking (`:181`) |
| 11 | **Steriliser / bottle brush** | `Bottles` (`:228`) with no way to clean them |
| 12 | **Nappy cream** | Guaranteed need |
| 13 | **Phone, power bank** | Chargers appear twice; the phone appears nowhere |

Also missing and frequently forgotten: insect repellent, after-sun,
antihistamines, travel sickness tablets and sick bags, hand sanitiser, tissues,
towels, toiletries broken out (shampoo, shower gel, hairbrush), laundry bag and
travel detergent, wet bag, blackout blind, child ear defenders, kids' tablet and
charger, travel pillow, breast pump and nursing kit, high chair, and — for
self-catering — bin bags, foil, a sharp knife, corkscrew, tea and coffee.

For pets: travel water bottle and collapsible bowl, dog crate or travel harness
(legally required in a car), pet towel, tick remover, pet first aid, vet contact
details.

### Wrongly assigned

| Item | Line | Problem |
|---|---|---|
| `Toothpaste` | 274 | Communal **and** `getAdults` — in an adult-free group the trigger never fires and `items()` drops it. **Nobody gets toothpaste** |
| `Helmet`, `Cycling shorts`, `Cycling gloves` | 137-142 | `getTeenagersAndAdults`. Children cycle — a child sent out without a helmet is the most dangerous mis-assignment in the file |
| `Scarf` | 426 | Unfiltered, so it reaches **babies**. Strangulation hazard |
| `Gloves` | 425 | Unfiltered, reaching toddlers — directly contradicting `Toddler mittens (not gloves - easier)` (`:435`) in the same option |
| `Visa`, `EHIC/GHIC card` | 322, 325 | `getAdults`. Every traveller has their own, and the children's are what get forgotten |
| `Toiletries bag` | 279 | `getTeenagersAndAdults` — children get no toiletries at all |
| `Headphones` | 241 | `getTeenagersAndAdults` — children on a plane are the actual use case |
| `Nightlight` | 289 | `getBabies` — toddlers and children need one more, in an unfamiliar room |
| `Personal care items` | 297 | `getTeenagers` only — adults apparently don't wash their faces |
| `Flashlight` | 296 | `getChildren` — adults need the torch |

### Communal vs per-person

The whole **self-catering option** (`:350-353`) is per-person, so two adults each
get their own dishwasher tablets, tea towels and washing-up sponge. Also wrongly
per-person: `Sunscreen` (`:384`), `Copies of important documents` (`:326`),
`Local currency` (`:323`), `Trail map` (`:179`), `Bike repair kit` (`:141`),
`Baby monitor` (`:288`), `Change mat` (`:225`), `Umbrella` (`:403`),
`Poop bags` (`:254`). Roughly **20 redundant lines** on a family-of-five
self-catering week.

Going the other way, `Travel adapter` (`:324`) is communal — one adapter for a
family of five with five phones.

### Quantities

Only five items in the whole template carry a rate, all in the overnight option.

| Item | Line | Current | 14 nights | Verdict |
|---|---|---|---|---|
| `Trousers/Shorts` | 286 | **none** | **1** | Worst quantity bug in the file — one pair for a fortnight |
| `T-shirt/Top` | 285 | 1 per 2 nights | 7 | Too few for children |
| `Jumper` | 287 | 1 per 4 nights | 4 | Too many — jumpers are bulky |
| `Underwear`, `Socks` | 283-284 | 1/night, no cap | 14 | Right rate, no cap; a 30-night trip suggests 30 pairs |

**`Nappies` (`:222`) has no rate at all** — it is *the* item that scales with trip
length. Same for pull-ups, formula, wipes, pet food and poo bags.

Note that capping underwear implies doing laundry, which makes the missing
laundry bag and travel detergent a prerequisite for honest caps. Ship them
together with the laundry question.

### Remove or reword

- `First aid kit` (`:180`, hiking) — identical to `:243`.
- `Water bottle` (`:140`, cycling) — identical to `:221`.
- `Light, breathable clothing` (`:387`) and `Comfortable layers` (`:414`) are
  **advice, not items**. Unpackable.
- `Entertainment (books/small toys)` (`:239`), `Accessories (watch, jewelry,
  etc.)` (`:193`) and `Personal care items (face wash, etc.)` (`:297`) are vague
  catch-alls — split into real items.
- Quantities baked into names: `Spare clothes (×3-4 sets)` (`:231`) should use
  `perNight`/`maxQuantity` now that the mechanism exists.
- The file is otherwise consistently British, so: `Favorite toy` → `Favourite
  toy` (`:295`), `jewelry` → `jewellery` (`:193`), `Flashlight` → `Torch`
  (`:296`), `Poop bags` → `Poo bags` (`:254`).

### Gender

`getFemaleTeenagersAndAdults` / `getMaleTeenagersAndAdults` are used for four
items, and the handling has three real problems:

1. **`gender` is optional** and the filters match `'male'`/`'female'` exactly. A
   woman who skipped the gender field gets **no bra, no menstrual products, no
   sports bra**, silently and with no error.
2. `'other'` and `'prefer-not-to-say'` are offered in the UI and then receive
   nothing from any gender-filtered item.
3. The gender filters carry **no `ageRanges` tag**
   (`age-specific-items.ts:14-17`), so age-up detection never revisits them — a
   girl becoming a teenager is never prompted for a bra or menstrual products,
   arguably the most important age-up transition the app has.

Also: `Shaving kit` (`:282`) as male-only is a poor assumption; razors are
near-universal.

**Recommended direction:** treat gender-linked items as *suggested-on* rather
than *filtered-to* — select by age band, pre-tick by gender where known, and
leave them visible but unticked when gender is unset. That fixes all three at
once without stereotyping.

---

## 3. Categories

### What the family actually sees today

No template item carries a `category`, so every heading is derived
(`generatePackingListItems.ts:19-21`): `'Essentials'` for always-needed items,
the **option text** for multiple-choice questions, and the **question text** for
single-choice ones.

For a family of five, overnight + abroad + self-catering + hiking + swimming +
hot — 177 rows:

| Heading | Rows |
|---|---|
| Essentials *(pinned first)* | 32 |
| **Will you be staying overnight?** | **53** |
| Are you travelling abroad? | 13 |
| Are you self-catering? | 8 |
| Swimming | 23 |
| Hiking | 13 |
| Hot | 28 |

**A question is not a heading.** "Will you be staying overnight?" is addressed to
the person *configuring* the app; the person *packing* answered it ten minutes
ago. And at 53 rows — 31% of the list — it is the entire wardrobe, the entire
washbag, half the documents and the baby's whole sleep setup in one block, whose
members live in four different rooms. The `Check all` button is useless at that
size, while it would be genuinely useful on a coherent six-item "Documents &
Money".

Meanwhile the passport sits in one card and the visa, currency and GHIC card in
another, purely because they came from different questions.

Activity headings ("Swimming", "Hiking") read well — but only because a swim bag
*is* a real bundle. "Hot" is not: sun hats go in the suitcase, sunscreen in the
washbag, the pram parasol in the car. The scheme groups by **why an item was
suggested**; the packer needs **what kind of thing it is**.

### Category decided by dedup order

Deduplication is `personId` + lowercased text
(`create-packing-list.tsx:22-30`), and question items are concatenated *before*
always-needed ones (`create-packing-list.tsx:630`). So where the same item exists
in both lists, the question copy wins:

- `First aid kit` exists at `:180` (hiking) and `:243` (always-needed) → the
  family's first aid kit is filed under **"Hiking"**.
- `Phone charger` (`:242`) and `Phone Charger` (`:276`) differ only in
  capitalisation → the charger moves out of Essentials into **"Will you be
  staying overnight?"**.

Both dedupe correctly, so these do *not* produce duplicate lines — but the
heading an item lands under is currently an accident of list order.

Items with genuinely different text do **not** dedupe, and those are real
duplicates: `Sunscreen` / `Baby sunscreen` / `Toddler sunscreen` / `Kids
sunscreen` all fire for one family, as do `Passport/ID` and `Passport`.

### Recommended scheme: functional, ten names

Rejected alternatives, on specific grounds:

- **By-person** — already exists as the default view; a person-shaped category
  would be redundant inside a person card. (This is also why "Baby & Toddler"
  should not be a category.)
- **By-bag** (hand/hold/boot) — depends on a transport mode the app does not ask
  about, and collides with the existing shared-vs-personal axis.
- **By-packing-stage** — only two useful buckets, and it is trip-specific,
  whereas `category` is stored on the *question set*. One item cannot be "night
  before" for one trip and not another.

Recommended, in the order they should appear:

| # | Category | Why here |
|---|---|---|
| 1 | Documents & Money | Highest consequence, lowest volume — a forgotten passport ends the trip |
| 2 | Medicines & First Aid | Hard to replace abroad, easy to overlook |
| 3 | Tech & Chargers | The classic 11pm "where's my charger" |
| 4 | Toiletries | One room, one bag |
| 5 | Clothes | The bulk — wardrobe and drawers as a block |
| 6 | Sleep & Comfort | Follows Clothes (pyjamas), leads the kids' run |
| 7 | Nappies & Changing | |
| 8 | Toys & Games | |
| 9 | Food & Kitchen | |
| 10 | Kit & Gear | Bulky, garage or car boot, loaded last |
| 11 | Pet Care | Conditional — only materialises when a pet is in the group |

The principle is **irreplaceability descending, bulk ascending**, with rooms kept
contiguous (bathroom → bedroom → nursery → kitchen → garage) so the family walks
the house once. This also fixes today's inversion, where `Essentials` is pinned
to the top but is mostly nappies and formula — the least urgent, most replaceable
things on the list.

Only populated categories appear, so a childless city break sees seven and a day
trip four. Per-person — the default view — the largest group drops from 13 rows
to 11, and every `Check all` becomes a real action.

### Constraints to design for before shipping this

1. **The template-update flow will not deliver categories.**
   `buildTemplateUpdateSuggestions` matches on **normalised text only**
   (`template-updates.ts:125-143`), so a category-only change produces zero
   suggestions and **bumping `WIZARD_TEMPLATE_VERSION` for it is a no-op.**
   Existing users would never receive categories; only sets created fresh from
   `createExampleData` would carry them.

2. **A backfill needs a safe gate.** `applySectionLayout` deliberately stores
   `undefined` for "back in the main pile" (`item-sections.ts:113`), so a
   backfill cannot distinguish *"the user un-categorised this deliberately"* from
   *"this predates categories"*. Only backfill question sets where
   `sectionNamesIn(qs)` returns `[]` — the user has never used sections anywhere
   — combined with a version check and exact text match.

3. **Never stamp `category: 'Essentials'` explicitly.** It is the default label
   for the always-needed list, so an explicit stamp is an unstable no-op that
   `applySectionLayout` strips on the first drag, churning `lastModified` for
   nothing. Under the mapping above, `Essentials` simply stops being used.

4. **Rename and remove are per-item-list.** `renameSection` / `removeSection`
   (`item-sections.ts:264-281`) restamp a single `Item[]`. Today derived
   categories never span lists, so this is invisible — but the proposed
   categories span five to eight lists each. A user renaming `Clothes` →
   `Wardrobe` inside one option would end up with **both** names as sections on
   the generated list. This is the biggest thing to solve before shipping:
   either scope rename/remove across the whole question set, or warn in the UI.

5. **Ordering needs a new mechanism.** A category's rank is currently
   `min(order)` of its items (`groupByCategory.ts:61-62`), which was coherent
   while categories *were* questions. Under a cross-cutting scheme it is
   arbitrary, and reordering one item in the editor would silently reshuffle
   top-level cards on the packing list. `pinFirst`/`pinLast` is a two-slot hack
   that cannot carry ten names — generalise `CategoryGroupingOptions` to take an
   explicit `order?: string[]`, with unlisted labels falling back to min-order.

LWW merge safety is unaffected: `category` stays a per-item field, so a bad merge
can only ever misplace the single item it touched.

---

## Suggested sequencing

**First — cheap, self-contained content fixes, no schema change:**

1. Give `Trousers/Shorts` a quantity rate, and cap underwear/socks.
2. Add rates to `Nappies`, pull-ups, formula, wipes, pet food.
3. Drop `getAdults` from `Toothpaste` and `Travel insurance documents`.
4. Fix the unfiltered-items-reach-babies cascade in Hot and Cold.
5. Widen cycling, watersports and climbing kit to `getChildrenAndOlder`.
6. Make the self-catering items communal; same for sunscreen, umbrella, trail
   map, bike repair kit, change mat, baby monitor.
7. Delete the duplicate `First aid kit` and `Water bottle`; fix `Phone Charger`
   capitalisation; British spellings throughout.
8. Add the Tier 1 missing items — medication, children's medicine, glasses, car
   seat, wallet and cards, keys, tickets, pram, travel cot, sling, steriliser,
   nappy cream, phone and power bank.

**Second — new coverage, needs a template version bump:**

9. Add the transport question and the accommodation question (the latter
   replacing self-catering).
10. Add Beach, Sightseeing, Skiing and Theme park activity options; remove
    Climbing; merge Running and Cycling.
11. Relabel "Warm" → "Mild" with temperature anchors; move sunscreen off "Hot".

**Third — needs schema or UI work:**

12. Fix the gender filters so unset and non-binary people are not silently
    skipped, and tag them with `ageRanges` so age-up detection reaches them.
13. Explicit categories, with the rename-scoping and ordering work above.
14. Conditional questions (`dependsOn`), so laundry only appears for longer
    trips and camping items only when accommodation includes a tent.
