# Wizard content evaluation

An assessment of the built-in wizard template (`src/edit-questions/example-data.ts`)
against one goal: **a typical family — adults, teens, children, toddlers, babies,
sometimes a pet — packing for a wide range of trip types.**

Every line reference and every number below was derived against the code as it
stood *before* any of this was acted on, so they describe the starting point,
not the current file.

**Status:** Tiers A and B (§5) are implemented — the content fixes and the new
transport/accommodation coverage — as is §4's explicit category scheme, with the
ordering mechanism it needed and a consented backfill for existing users (§7).
Still outstanding from Tier C: the gender rework and conditional questions.
Deliberate departures from the recommendations below are recorded in §6.

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
   dedicated baby item. A family selecting "Cold" gets `Winter coat`, `Gloves`,
   `Scarf`, `Warm hat/Beanie`, `Thermal underwear` and `Warm boots` for the baby
   *and* the baby snowsuit set. "Hot" gives the baby both `Sunscreen` and
   `Baby sunscreen (SPF 50+)`; across a family of five that is **eight sunscreen
   rows under four different names**.
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

1. **"How are you getting there?"** — **`questionType: 'multiple-choice'`**.
   Options: *Flying / Driving / Train or coach / Ferry / Cruise ship*. The
   highest-impact addition; gates the entire air-travel and car-travel item sets,
   neither of which exists today.
2. **"Where will you be staying?"** — **`questionType: 'multiple-choice'`**.
   Options: *Hotel or B&B / Self-catering (cottage, apartment, villa) /
   Someone else's home / Camping or caravan / Cruise ship*. **Replaces** the
   current self-catering question. Same information, four more archetypes
   unlocked.
   Both of these questions must be multi-select — see §2, which is where the
   real design work is.
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
| `:408-418` "Warm" | Its items are *light jacket, layers, long-sleeved shirts* — that's **Mild**. Someone picking "Warm" for a 25 °C trip gets a jacket and no sunscreen | Relabel to "Mild (10–18 °C)"; anchor every option with a temperature range |
| `:384` Sunscreen | Exists **only** under "Hot" — a ski family is never offered it | Add a "Strong sun" weather option carrying `Sunscreen` / `Sun hat` / `Sunglasses`, or duplicate those three into Snow and Beach |
| `:372-439` Weather | Mixes two axes: three temperatures plus one condition ("Rain"), and Hot + Warm are selectable together | Split temperature options from condition options (Rain, Snow/ice, Strong sun, Insects) |
| `:277` "Passport/ID" | A weekend at grandparents does not need a passport, and its text differs from `:320` "Passport", so both survive dedup and adults get **two passport rows** on any abroad trip | Delete `:277` |
| `:126-167` Watersports / Cycling / Running / Climbing | Every item except the gender-filtered `Sports bra` is `getTeenagersAndAdults` — a 9-year-old cycling gets **nothing**, including a helmet | Widen to `getChildrenAndOlder` |
| `:264` "Will you be staying overnight?" | The create-list form already captures `nights` — the same fact asked twice in two formats | Derive from `nights > 0` |

The three Yes/No questions (`:300-305`, `:330-335`, `:356-361`) all have a "No"
branch carrying **zero items**, so answering them can be a pure no-op. If
self-catering moves into the accommodation question, merge the remaining two into
one multiple-choice *"About this trip — tick all that apply"*.

### `getAdults` on a communal item can delete it outright

`items()` (`:92-94`) drops any item whose `personSelections` are all `false`.
That is correct behaviour — but combined with `getAdults` it means an
**adult-free group loses the item from the question set entirely**, not just from
one person. Verified for a group of one teenager + one child:

- `Toothpaste` (`:274`, `communalItem(..., getAdults)`) — **nobody gets
  toothpaste.**
- The self-catering "Yes" option becomes **zero items** — a question the user can
  still answer that produces literally nothing.
- The abroad "Yes" option drops from eight items to one (`Passport`), losing
  travel insurance, visa, currency, adapter, document copies and the GHIC card.
- `Pain relief (paracetamol / ibuprofen)` (`:245`) also vanishes.

**Severity, honestly:** an adult-free group *is* constructible — nothing in
`wizardSchema` (`src/pages/wizard-types.ts`) or `AGE_RANGE_OPTIONS` requires an
Adult, so a solo teenager can complete the wizard — but for the target audience
(families) it is rare. Treat it as a **correctness bug worth a one-line fix, not
a headline**: change `:274` to `communalItem("Toothpaste", people)` and `:245`,
`:321` (`Travel insurance documents`) to drop `getAdults`.

### Remove or merge

- **Climbing** (`:157-169`) — belay device and chalk bag; sub-2% of families.
- **Running + Cycling** → merge into "Sport & exercise"; both adult-only and
  heavily overlapping (both carry `Sports bra`, which dedup then collapses — see
  §2).
- **Visiting religious sites** (`:198-208`) — all five items are "wear modest
  clothes"; fold into Sightseeing as a single line.

### Order

Current: overnight → abroad → self-catering → activities → weather.

**Weather in last place is the main error.** It applies to 100% of trips and
generates the most clothing, but sits behind the longest, most optional question.
Recommended: universal-and-cheap first, long-and-optional last —
trip basics → **weather** → transport → accommodation → medical → **activities**.

---

## 2. Multi-select: transport and accommodation

Families genuinely mix. They fly out and hire a car. They spend two nights at
grandparents and a week in a cottage. They drive a road trip with one night
camping. **Both new questions must be `questionType: 'multiple-choice'`.**

### The schema and UI already support it — no changes needed

- `QuestionTypeSchema` (`types.ts:97`) is `'single-choice' | 'multiple-choice'`,
  and `OptionSchema` has no exclusivity or grouping fields.
- The answering form renders multiple-choice as **checkboxes** with a
  "(select all that apply)" hint (`create-packing-list.tsx:878-940`).
- `generateQuestionBasedItems` treats `selectedOptionIds` as a set and emits
  items from **every** selected option (`generatePackingListItems.ts:97-111`).
- The question editor can already set the type (`questions-page.tsx:1267,1411`).

So shipping these as multi-select is a content-only change. The consequences
below are what the rest of the document had not addressed.

### Consequence 1: exact-text collisions dedupe; near-duplicates do not

`deduplicateItems` keys on `${personId}::${itemText.trim().toLowerCase()}`
(`create-packing-list.tsx:22-30`) and runs over
`[...questionBasedItems, ...alwaysNeededItems]` (`:630`). Communal items use
`personId: ''`, so they dedupe against each other too.

The activities question is already the proof. Selecting Cycling + Running +
Hiking for two adults yields 30 rows pre-dedup, **28 post-dedup**: `Sports bra`
appears in all three options but survives once — and lands under **Cycling**,
because that option has the lowest `order`. Running and Hiking silently lose it.

The same will happen to accommodation. Ticking *Someone else's home* + *Camping
or caravan*, both of which need towels:

- `Towels` in both → **one row**, filed under whichever option has the lower
  `order`. The packer sees it under one heading and may read the other as needing
  none.
- `Bath towel` in one and `Towels` in the other → **two rows.** Near-duplicates
  do not dedupe at all.

**Rule to write the options against:** any item that could legitimately appear in
two options must use **byte-identical text** in both, so dedup collapses it.
Anything that must genuinely appear twice must be worded distinctly and
deliberately (`Beach towel` vs `Bath towel`, never `Towel` twice).

A second, sharper hazard: dedup keeps the **first** row and discards the rest
*including its quantity rate*. If `Towels` is `{ perNight: 1, perNights: 3 }`
under Self-catering and rateless under Hotel, and Hotel sorts first, the family
gets one towel for the whole trip. **Where an item is duplicated across options,
give it the same rate in both.**

### Consequence 2: mutual exclusivity is not expressible — and should not be

`OptionSchema` has no `exclusiveWith`, and `QuestionTypeSchema` has no
"exactly one" beyond `single-choice`. There is no way to say "Camping excludes
Hotel".

That is the right outcome. Every candidate exclusion is a real trip: camping +
hotel is the road trip with one night under canvas; cruise + hotel is the
pre-cruise overnight. **Do not add an exclusivity mechanism.** The one genuinely
nonsensical answer — every option ticked — costs about fifteen deletable rows,
far cheaper than a schema field plus editor UI plus a merge story. If a warning
is ever wanted it belongs in the answering form, not the stored question set.

### Consequence 3: self-catering becomes an option, not a question

Delete the "Are you self-catering?" question and move its four items (`:350-353`)
into a **"Self-catering (cottage, apartment, villa)"** option under "Where will
you be staying?". Multi-select is what makes this safe: the two-nights-at-
grandparents-then-a-cottage family ticks both *Someone else's home* and
*Self-catering* and gets both item sets — something the Yes/No question could
never express. It also removes one interaction and one always-empty "No" branch.

### Consequence 4: headings multiply

`defaultCategoryFor` (`item-sections.ts:24-26`) uses the **option text** for
multiple-choice questions. A family ticking Flying + Driving + Hotel +
Self-catering gets **four new top-level cards** on the packing list on top of
today's seven. That is the strongest argument for the explicit-category scheme in
§4 — under it, the accommodation and transport items land in `Documents & Money`,
`Kit & Gear` and `Food & Kitchen` alongside everything else, and ticking a fifth
option adds rows rather than cards.

### Recommended option item lists

Keep each list short; the goal is coverage of what is *only* needed under that
option.

| Option | Items (exact text) |
|---|---|
| Hotel or B&B | `Booking confirmation`, `Room key card holder` — deliberately tiny; the hotel supplies the rest |
| Self-catering (cottage, apartment, villa) | `Dish soap and sponge`, `Dishwasher tablets`, `Tea towels`, `Shopping bags`, `Bin bags`, `Tea and coffee`, `Sharp knife`, `Foil`, `Corkscrew` — all `communalItem` |
| Someone else's home | `Host gift`, `Travel cot`, `Travel cot sheet`, `Stair gate`, `Blackout blind`, `Towels` |
| Camping or caravan | `Tent`, `Sleeping bag`, `Sleeping mat`, `Head torch`, `Camping stove and gas`, `Camp chairs`, `Wellies`, `Towels` |
| Cruise ship | `Lanyard for key card`, `Seasickness remedies`, `Formal outfit`, `Port daypack` |
| Flying | `Boarding passes`, `Hand luggage liquids bag`, `Travel pillow`, `Downloaded films and music`, `Medication in hand luggage`, `Milk or dummy for take-off and landing` |
| Driving | `Car seat`, `Booster seat`, `Driving licence`, `Breakdown cover documents`, `Car charger`, `Travel sickness tablets`, `Sick bags`, `Screen wash` |
| Train or coach | `Tickets`, `Downloaded films and music`, `Snacks for the journey` |
| Ferry | `Tickets`, `Seasickness remedies`, `Cabin overnight bag` |

`Towels` appears in three options above with **identical text**, so dedup gives
one row; likewise `Downloaded films and music`, `Tickets` and `Seasickness
remedies`. `Formal outfit` under Cruise ship is deliberately byte-identical to
`:191` under "Formal occasions", so a cruise with a formal night produces one row
rather than two.

---

## 3. Items

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
antihistamines, hand sanitiser, tissues, towels, toiletries broken out (shampoo,
shower gel, hairbrush), laundry bag and travel detergent, wet bag, child ear
defenders, kids' tablet and charger, breast pump and nursing kit, high chair.

For pets: travel water bottle and collapsible bowl, dog crate or travel harness
(legally required in a car), pet towel, tick remover, pet first aid, vet contact
details.

### Wrongly assigned

| Item | Line | Problem |
|---|---|---|
| `Helmet`, `Cycling shorts`, `Cycling gloves` | 137-142 | `getTeenagersAndAdults`. Children cycle — a child sent out without a helmet is the most dangerous mis-assignment in the file |
| `Scarf` | 426 | Unfiltered, so it reaches **babies**. Strangulation hazard |
| `Gloves` | 425 | Unfiltered, reaching toddlers — directly contradicting `Toddler mittens (not gloves - easier)` (`:435`) in the same option |
| `Visa` | 322 | `getAdults`. Children hold their own visas, and theirs are what get forgotten |
| `EHIC/GHIC card` | 326 | `getAdults`. Same — every traveller has their own card |
| `Toiletries bag` | 279 | `getTeenagersAndAdults` — children get no toiletries at all |
| `Headphones` | 241 | `getTeenagersAndAdults` — children on a plane are the actual use case |
| `Nightlight` | 289 | `getBabies` — toddlers and children need one more, in an unfamiliar room |
| `Personal care items` | 297 | `getTeenagers` only — adults apparently don't wash their faces |
| `Flashlight` | 296 | `getChildren` — adults need the torch |
| `Toothpaste` | 274 | `communalItem` + `getAdults` — vanishes for adult-free groups (see §1) |

### Communal vs per-person

The whole **self-catering option** (`:350-353`) is per-person, so two adults each
get their own dishwasher tablets, tea towels and washing-up sponge. Also wrongly
per-person: `Sunscreen` (`:384`), `Local currency` (`:323`), `Copies of important
documents` (`:325`), `Trail map` (`:179`), `Bike repair kit` (`:141`),
`Baby monitor` (`:288`), `Change mat` (`:225`), `Umbrella` (`:403`),
`Poop bags` (`:254`).

On the 177-row worked example below this removes **11 rows** (15 if "Rain" is also
selected, because `Umbrella` currently fans out to all five people).

Going the other way, `Travel adapter` (`:324`) is communal — one adapter for a
family of five with five phones.

### Quantities

Exactly five items in the whole template carry a rate, all in the overnight
option. Verified against `suggestedQuantity`
(`generatePackingListItems.ts:27-32`): `ceil(nights × perNight / perNights)`,
capped at `maxQuantity`, floor 1.

| Item | Line | Rate | 7 nights | 14 nights | Verdict |
|---|---|---|---|---|---|
| `Pyjamas` | 278 | 1/night, cap 2 | 2 | 2 | Right |
| `Underwear` | 283 | 1/night, no cap | 7 | 14 | Right rate, no cap; a 30-night trip suggests 30 pairs |
| `Socks` | 284 | 1/night, no cap | 7 | 14 | Same |
| `T-shirt/Top` | 285 | 1 per 2 nights | 4 | 7 | Too few for children |
| `Jumper` | 287 | 1 per 4 nights | 2 | 4 | Too many — jumpers are bulky; use `{ perNight: 1, perNights: 4, maxQuantity: 2 }` |

`Trousers/Shorts` (`:286`) has **no rate at all**, so `suggestedQuantity` returns
`undefined` and the row carries no number whatsoever — one undifferentiated line
for a fortnight. Give it `{ perNight: 1, perNights: 3, maxQuantity: 5 }`.

**`Nappies (pack/supply)` (`:222`) has no rate either** — it is *the* item that
scales with trip length. Concrete rates to add:

| Item | Line | Rate |
|---|---|---|
| `Nappies (pack/supply)` | 222 | `{ perNight: 6 }` |
| `Baby wipes` | 223 | `{ perNight: 1, perNights: 3 }` |
| `Pull-ups/Toddler nappies` | 232 | `{ perNight: 4 }` |
| `Formula/Baby food` | 229 | `{ perNight: 4 }` |
| `Wipes` (toddler) | 234 | `{ perNight: 1, perNights: 4 }` |
| `Pet food` | 247 | `{ perNight: 2 }` |
| `Poop bags` | 254 | `{ perNight: 3 }` |
| `Underwear` | 283 | add `maxQuantity: 10` |
| `Socks` | 284 | add `maxQuantity: 10` |

Capping underwear implies doing laundry, so ship those two caps together with
the laundry question and the missing `Laundry bag` / `Travel detergent` items —
otherwise the cap is a lie.

### Remove or reword

- `First aid kit` (`:180`, hiking, `communalItem` + `getAdults`) — delete it.
  `:243` is the same text with a broader trigger and always applies; today the
  hiking copy wins dedup and drags the family's first aid kit under "Hiking".
- `Water bottle` (`:140`, cycling, `getTeenagersAndAdults`) — delete it. `:221`
  is the same text with `getToddlersAndOlder`.
- `Light, breathable clothing` (`:387`) and `Comfortable layers` (`:414`) are
  **advice, not items**. Unpackable — delete.
- `Entertainment (books/small toys)` (`:239`), `Accessories (watch, jewelry,
  etc.)` (`:193`) and `Personal care items (face wash, etc.)` (`:297`) are vague
  catch-alls — split into real items.
- `Spare clothes (×3-4 sets)` (`:231`) → `Spare clothes` with
  `{ perNight: 1, perNights: 2, maxQuantity: 6 }`; `Spare clothes (×2-3 sets)`
  (`:235`) → `Spare clothes` with `{ perNight: 1, perNights: 3, maxQuantity: 4 }`.
  Note these two share text once the counts are stripped, and go to different
  people (baby vs toddler), so dedup leaves both — which is correct.
- `Phone Charger` (`:276`) → `Phone charger`, then delete it: `:242` already
  carries the same text in always-needed and only survives at `:276` because
  question items are concatenated first.
- The file is otherwise consistently British, so: `Favorite toy/Stuffed animal`
  → `Favourite toy/Stuffed animal` (`:295`), `jewelry` → `jewellery` (`:193`),
  `Flashlight` → `Torch` (`:296`), `Poop bags` → `Poo bags` (`:254`).

### Gender

`getFemaleTeenagersAndAdults` / `getMaleTeenagersAndAdults`
(`age-specific-items.ts:60-69`) drive four items: `Bra`, `Menstrual products`,
`Shaving kit`, `Sports bra`. Three real problems, restated correctly after
checking the forms:

1. **The wizard requires gender, but never says so.** `wizardPersonSchema`
   (`wizard-types.ts:14`) has `gender: GenderSchema` — not optional. Leaving the
   select on "Select gender..." fails validation, so the form simply refuses to
   submit — and `wizard.tsx:273-286` renders **no error message under the gender
   select**, unlike the age-range field which does. The user is blocked with no
   visible reason. *(The earlier claim that a woman who skipped the field
   silently loses her bra is wrong for the wizard path — she cannot get past it.)*
2. **Gender cannot be set or changed after the wizard.** `PeopleModal`
   (`questions-page.tsx:1138-1246`) — the only people editor outside the wizard —
   has name, birthday and age-group controls and **no gender control at all**.
   `addPerson` creates `{ id, name }`, so anyone added later has
   `gender: undefined` permanently. Verified: two adults with no gender get an
   overnight list with no `Bra`, no `Menstrual products` and no `Shaving kit`,
   and no way to fix it in the app.
3. **`'other'` and `'prefer-not-to-say'`** are offered in `GENDER_OPTIONS` and
   then receive nothing from any gender-filtered item.
4. **The gender filters carry no `ageRanges` tag** — deliberately, per the
   comment at `age-specific-items.ts:10-15` — so `age-promotion.ts:29,99`
   skips them and a girl becoming a teenager is never prompted for a bra or
   menstrual products, arguably the most important age-up transition the app has.

Also: `Shaving kit` (`:282`) as male-only is a poor assumption; razors are
near-universal.

**Recommended direction:** treat gender-linked items as *suggested-on* rather
than *filtered-to* — select by age band, pre-tick by gender where known, and
leave them visible but unticked when gender is unset. That fixes 2, 3 and 4 at
once without stereotyping. Independently and cheaply: render the gender
validation error in `wizard.tsx`, and add a gender select to `PeopleModal`.

---

## 4. Categories

### What the family actually sees today

No template item carries a `category`, so every heading is derived
(`generatePackingListItems.ts:19-21`): `'Essentials'` for always-needed items,
the **option text** for multiple-choice questions, and the **question text** for
single-choice ones. The view page pins `Essentials` first and `Other` last
(`view-packing-list.tsx:88-92`).

Worked example — **2 adults, 1 child, 1 toddler, 1 baby**, answering
overnight Yes + abroad Yes + self-catering Yes + Swimming + Hiking + Hot,
7 nights. 180 rows generated, 3 removed by dedup, **177 rows shown**:

| Heading | Rows |
|---|---|
| Essentials *(pinned first)* | 35 |
| **Will you be staying overnight?** | **54** |
| Are you travelling abroad? | 15 |
| Are you self-catering? | 8 |
| Swimming | 23 |
| Hiking | 14 |
| Hot | 28 |

Three problems follow:

- **A question is not a heading.** It is addressed to the person *configuring*
  the app, not the person packing. At 54 rows — 31% of the list — that one card
  is the entire wardrobe, the entire washbag, half the documents and the baby's
  sleep setup, whose members live in four different rooms. `Check all`
  (`view-packing-list.tsx:1271`) is useless at that size and would be genuinely
  useful on a coherent six-item "Documents & Money".
- **Related items are split by provenance.** The passport sits in one card and
  the visa, currency and GHIC card in another, purely because they came from
  different questions. And `Essentials` is pinned first although half its 35 rows
  are nappies, wipes, formula and pull-ups — the most replaceable things on the
  list.
- **The axis is wrong.** "Swimming" reads well only because a swim bag *is* a
  real bundle; "Hot" is not — sun hats go in the suitcase, sunscreen in the
  washbag, the pram parasol in the car. The scheme groups by **why an item was
  suggested**; the packer needs **what kind of thing it is**.

### Category decided by dedup order

Dedup is `personId` + lowercased text (`create-packing-list.tsx:22-30`) and
question items are concatenated *before* always-needed ones (`:630`). So where
the same text exists in both lists, the question copy wins and takes the heading
with it. On the worked example exactly three rows are removed, all of them this:

- `First aid kit` at `:180` (hiking) beats `:243` (always-needed) → the family's
  first aid kit is filed under **"Hiking"**.
- `Phone charger` (`:242`) vs `Phone Charger` (`:276`) → the charger moves out of
  Essentials into **"Will you be staying overnight?"** (one row per adult).

These dedupe *correctly* — no duplicate lines — but the heading is an accident of
list order. Items with genuinely different text do **not** dedupe, and those are
real duplicates: `Sunscreen` / `Baby sunscreen (SPF 50+)` / `Toddler sunscreen` /
`Kids sunscreen` all fire for one family (8 rows), as do `Passport/ID` (`:277`)
and `Passport` (`:320`) for every adult.

### Recommended scheme: functional, eleven names

Rejected alternatives, on specific grounds:

- **By-person** — already the default view (`view-packing-list.tsx:136`); a
  person-shaped category would be redundant inside a person card. (This is also
  why "Baby & Toddler" should not be a category.)
- **By-bag** (hand/hold/boot) — depends on a transport mode the app does not ask
  about yet, and collides with the existing shared-vs-personal axis.
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
the house once. Under this mapping `Essentials` simply stops being used.

Only populated categories appear, so a childless city break sees seven and a day
trip four. In the default per-person view the largest single group today is 13
rows (a female adult's share of "Will you be staying overnight?"); breaking that
across Clothes / Toiletries / Documents makes every `Check all` a real action.

### Constraints to design for before shipping this

1. **The template-update flow will not deliver categories.**
   `buildTemplateUpdateSuggestions` matches items by **normalised text only**
   (`template-updates.ts:125-137`; `normalize` is trim + lowercase,
   `item-locations.ts:25-27`) and only ever emits *additions*. A category-only
   change therefore produces zero suggestions, `hasTemplateUpdates` returns false
   on the empty list (`template-updates.ts:231-234`), the review card never
   appears, and `applyTemplateUpdates` — the only writer of `templateVersion` —
   is never called. **Bumping `WIZARD_TEMPLATE_VERSION` for a category-only
   change is a complete no-op.** Verified. Existing users would never receive
   categories; only sets created fresh from `createExampleData` would carry them.

2. **A backfill needs a safe gate.** `applySectionLayout` deliberately stores
   `undefined` for "back in the main pile" (`item-sections.ts:113`), so a
   backfill cannot distinguish *"the user un-categorised this deliberately"* from
   *"this predates categories"*. Only backfill question sets where
   `sectionNamesIn(qs)` returns `[]` — the user has never used sections anywhere
   — combined with a version check and exact text match.

3. **Never stamp `category: 'Essentials'` explicitly.** It is the default label
   for the always-needed list (`item-sections.ts:17`), so an explicit stamp is an
   unstable no-op that `applySectionLayout` strips on the first drag, churning
   `lastModified` for nothing.

4. **Rename and remove are per-item-list.** `renameSection` / `removeSection`
   (`item-sections.ts:264-281`) restamp a single `Item[]`. Today derived
   categories never span lists, so this is invisible — but the proposed
   categories span five to eight lists each. A user renaming `Clothes` →
   `Wardrobe` inside one option would end up with **both** names as sections on
   the generated list. This is the biggest thing to solve before shipping:
   either scope rename/remove across the whole question set, or warn in the UI.

5. **Ordering needs a new mechanism.** A category's rank is currently
   `min(order)` of its items (`groupByCategory.ts:61-62,74`), which was coherent
   while categories *were* questions. Under a cross-cutting scheme it is
   arbitrary, and reordering one item in the editor would silently reshuffle
   top-level cards on the packing list. `pinFirst`/`pinLast` is a two-slot hack
   that cannot carry eleven names — generalise `CategoryGroupingOptions` to take
   an explicit `order?: string[]`, with unlisted labels falling back to
   min-order.

LWW merge safety is unaffected: `category` stays a per-item field, so a bad merge
can only ever misplace the single item it touched — pinned by
`item-category-compat.test.ts`.

---

## 5. Implementation risk

### Tier A — content-only edits to `example-data.ts`, no version bump needed to be correct

These change what *new* users get. Existing users keep their saved set until they
choose to change it; that is acceptable for fixes to filters, rates and
communal-ness, because template updates are additive-only and cannot rewrite an
existing item anyway.

Safe: dropping `getAdults` from `Toothpaste`/`Pain relief`/`Travel insurance
documents`; widening cycling/watersports/climbing to `getChildrenAndOlder`;
adding age filters so `Scarf`/`Gloves`/`Winter coat` skip babies; adding
`perNight` rates; flipping items to `communalItem`; British spellings; deleting
the duplicate `First aid kit`, `Water bottle` and `Passport/ID`.

**Tests that break:**

- `example-data.test.ts:270-278` `'includes travel document items selected for
  adults only'` — asserts the baby is **not** selected for `Visa`. Widening
  `Visa` past `getAdults` breaks it. Remove `'Visa'` from that array and give it
  its own assertion. (`Local currency` and `Copies of important documents`
  stay fine even when made communal — `communalItem` preserves
  `personSelections` as a trigger.)
- `example-data.test.ts:143-147` `'includes Headphones and Phone charger in
  alwaysNeededItems for adults'` — safe as long as you delete the **overnight**
  `Phone Charger` (`:276`) and keep the always-needed `Phone charger` (`:242`).
  Deleting the wrong one breaks this.
- `template-updates.test.ts:24-36, 48-60, 119-134, 136-148` all remove
  `'Sunscreen'` from the `'Hot'` option and expect exactly one suggestion.
  **Moving `Sunscreen` out of "Hot" breaks four tests.** Adding a "Strong sun"
  option that *also* contains `Sunscreen` breaks them differently (two
  suggestions). Safest sequencing: leave `Sunscreen` in `Hot` and add the new
  option carrying `Sun cream (high SPF)` under a distinct text, or update these
  four tests to target a different item.
- `example-data.test.ts:149-159` and `:221-230` (`'no item ... has all
  personSelections unselected'`) are invariants over the whole set — they pass
  automatically for any new content routed through `items()`. Do not bypass
  `items()`.
- `item-category-compat.test.ts` uses only hand-written fixtures and never calls
  `createExampleData`. **No content change can break it.**

### Tier B — new coverage; needs `WIZARD_TEMPLATE_VERSION` bumped to 2 to reach existing users

New questions, new options and new items *are* deliverable by
`buildTemplateUpdateSuggestions`, so bumping the version genuinely does something
here — unlike categories.

Covers: the transport and accommodation questions; the new activity options;
relabelling "Warm" → "Mild"; the medical and laundry questions; all the Tier-1
missing items.

**Tests that break:**

- `template-updates.test.ts:62-66` `'does not resurrect items from a question the
  user deleted'` does `findQuestion(set, TEMPLATE_QUESTION_IDS.selfCatering)!`.
  **Removing the self-catering question makes this throw a TypeError**, not just
  fail. Retarget it at `TEMPLATE_QUESTION_IDS.overnight` or the new accommodation
  question, and delete the `selfCatering` key from `TEMPLATE_QUESTION_IDS` (which
  also breaks `example-data.test.ts:28`).
- Removing Climbing breaks `example-data.test.ts:17` (`ACTIVITY_OPTION_IDS.climbing`
  identity), `:59` (`expect(optionIds).toContain(...climbing)`), `:78-87`
  (`'filters activity options to only selected activities'` uses cycling +
  climbing) and `:341-351` (`'includes Sports bra for female adults in cycling,
  hiking, and climbing'`).
- Merging Running into Cycling breaks `example-data.test.ts:15-16` and
  `:325-333` (`'includes Sports bra selected for female adult runner'`).
- Adding new activity options is **free**: `ALL_ACTIVITY_OPTION_IDS` is derived
  from `Object.values(ACTIVITY_OPTION_IDS)`, so `:63-76` self-updates.
- Adding whole new questions is **free** for `template-updates.test.ts`, because
  `baseSet()` regenerates the current template — the `toHaveLength(1)`
  assertions at `:74, :87` stay true.

### Tier C — needs schema, UI or generator changes

| Change | What it needs |
|---|---|
| Explicit categories on every template item | The rename-scoping fix (constraint 4) and `CategoryGroupingOptions.order` (constraint 5), plus a gated backfill — a version bump alone will not deliver it |
| Gender as *suggested-on* rather than *filtered-to* | Generator change in `item()`/`example-data.ts`. Breaks the six assertions in `example-data.test.ts:299-376` (`'does not include Menstrual products for male-only group'`, `'does not include Shaving kit for female-only group'`, and the four `selected === false` checks) |
| Tagging gender filters with `ageRanges` | Directly contradicts `example-data.test.ts:436-446` `'leaves everyone-items and gender-filtered items untagged'`, which asserts `bra.ageRanges` is `undefined`, and the deliberate comment at `age-specific-items.ts:10-15`. Both must be updated together |
| Gender select in `PeopleModal` | UI only (`questions-page.tsx:1138-1246`); `PersonSchema.gender` already exists and is optional |
| Gender validation error in the wizard | UI only (`wizard.tsx:273-286`); copy the `errors.people[index].ageRange` pattern |
| Conditional questions (`dependsOn`) | New field on `CommonQuestionSchema`, RDF serialisation, editor UI and answering-form logic. The largest of these |
| Laundry question modulating `perNight` | `suggestedQuantity` currently takes only `(item, nights)`; needs a multiplier or a second cap source |

---

## Suggested sequencing

**First — Tier A content fixes, self-contained:**

1. Rates: `Trousers/Shorts`, `Nappies`, pull-ups, formula, wipes, pet food; caps
   on underwear and socks (ship with the laundry bag items).
2. Drop `getAdults` from `Toothpaste`, `Pain relief` and `Travel insurance
   documents`.
3. Stop unfiltered Hot/Cold items reaching babies.
4. Widen cycling, watersports and climbing kit to `getChildrenAndOlder`.
5. Make the self-catering items, sunscreen, umbrella, trail map, bike repair kit,
   change mat and baby monitor communal; make `Travel adapter` per-person.
6. Delete the duplicate `First aid kit` (`:180`), `Water bottle` (`:140`),
   `Passport/ID` (`:277`) and `Phone Charger` (`:276`); British spellings.
7. Add the Tier-1 missing items.

**Second — Tier B, bump `WIZARD_TEMPLATE_VERSION` to 2:**

8. Add the transport and accommodation questions, both multiple-choice, with the
   option item lists in §2; delete the self-catering question.
9. Add Beach, Sightseeing, Skiing and Theme park; remove Climbing; merge Running
   and Cycling.
10. Relabel "Warm" → "Mild" with temperature anchors; add a "Strong sun" option.

**Third — Tier C:**

11. Render the wizard's gender validation error; add a gender select to
    `PeopleModal`.
12. Rework gender to suggested-on, and tag those items with `ageRanges`.
13. Explicit categories, with the rename-scoping and ordering work first.
14. Conditional questions (`dependsOn`), so laundry only appears for longer trips
    and camping items only when accommodation includes a tent.

---

## 6. Departures from the recommendations above

Two things recommended above were deliberately not done.

**Climbing was kept, and Running and Cycling were not merged.** The argument for
removing them was scan cost. But the activities question is multiple-choice, and
`generateQuestionBasedItems` only emits items from *selected* options
(`generatePackingListItems.ts:97-111`) — so an unticked option costs one
checkbox on the answering form and **nothing at all** on the packing list. That
makes the case for removal much weaker than §1 assumed, while merging Running
into Cycling would hand a bike repair kit to someone who only runs. All three
options were kept and their age filters widened to `getChildrenAndOlder`
instead, which was the real defect.

**Weather options were not given temperature anchors.** Renaming "Hot" to
"Hot (25°C and above)" would break text-matching for every existing user:
template options are matched by id then normalised text
(`template-updates.ts:110-112`), and saved weather options carry UUIDs from
before `WEATHER_OPTION_IDS` existed, so text is the only thing that can match.
Renaming would offer every user a duplicate option alongside the one they have.
Only "Warm" → "Mild" was renamed, because there the wrong label is the defect
being fixed and the duplicate is worth it. Anchoring the rest needs an option
migration story first.

### Both weather-option renames stayed minimal for the same reason

Only "Warm" → "Mild" was renamed. See above.

---

## 7. Categories, as implemented

§4's functional scheme now ships. Three things it needed beyond stamping labels
on items:

**An explicit order.** `CATEGORY_ORDER` in `item-sections.ts` replaces the
`pinFirst: 'Essentials'` hack, and `groupItemsByCategory` takes an `order`
option. Listed labels rank by position; unlisted ones — question and option text
for uncategorised items, plus any name the user invents — keep the old
lowest-item-order behaviour and sort after them, so a partly-categorised list
still reads sensibly. `ALWAYS_NEEDED_CATEGORY` leads the list so sets written
before categories existed are displayed exactly as before.

**A delivery route for existing users.** Constraint 1 above still holds — a
category-only change produces no `addItem` suggestions, so bumping the version
alone would reach nobody. Rather than migrate silently, there is a new
`setCategories` suggestion in the same review card: *"Sort 41 items into 9
sections"*, ticked by default, declinable independently of the additive
suggestions. It is only offered when `sectionNamesIn(qs)` is empty — once the
user has made a section of their own, an absent category means "back in the main
pile" and there is no way to tell that from legacy data, so we don't ask. Applying
it only ever fills a gap: an item that already carries a category keeps it.

**A fix to "+ Add Item".** Once every template item carries a category, a new
item — which has none — falls into the default section, and
`buildSectionSequence` puts that first. So the new row appeared at the *top* of
the editor, nowhere near the button that created it. New items now inherit the
last item's section. This is what broke E2E C8, which drove the editor by
`.last()` selectors.

### What the family now sees

Same worked example as §4 (5 people, week abroad, self-catering plus a night at
grandparents, flying and driving, swimming, beach and hiking) — 272 rows
generated, 6 removed by dedup across options, 266 shown:

| Section | Rows |
|---|---|
| Documents & Money | 19 |
| Medicines & First Aid | 16 |
| Tech & Chargers | 14 |
| Toiletries | 24 |
| Clothes | 56 |
| Sleep & Comfort | 18 |
| Nappies & Changing | 7 |
| Toys & Games | 1 |
| Food & Kitchen | 13 |
| Kit & Gear | 30 |

No heading is a question any more. The largest is Clothes at 56 — bigger than
the old overnight blob's 54, and that is fine: 56 clothing rows are one trip to
the wardrobe, where the blob mixed wardrobe, washbag, document drawer and
nursery under a question mark.

### Still open

The cross-list rename hazard (constraint 4) is **not** fixed.
`renameSection`/`removeSection` still restamp one item list, and these categories
span five to eight. Renaming `Clothes` inside one option leaves the others alone,
so the generated list would show both names. Nothing is lost and the user can
rename in each place, but it should be scoped across the question set.
