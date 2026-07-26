# AGENTS.md

How this app actually works, for anyone (human or agent) changing it.

`CLAUDE.md` covers conventions — testing, E2E pod isolation, data-access layers,
the persistence guard, PR rules. Read it too; this file doesn't repeat it.

## The one model everything hangs off

There is a single `PackingListQuestionSet` per user: **people**, an
**always-needed item list**, and **questions**, each with **options**, each with
their own item list. A **packing list** is a snapshot generated from it by
answering the questions. Nothing about a generated list feeds back automatically.

```
Person[]  +  Item[] (always-needed)  +  Question[] → Option[] → Item[]
                            │
                            ├─ answers + selected people + nights
                            ▼
                      PackingListItem[]  (one packing list)
```

## How one `Item` becomes rows on a list

`create-packing-list/generatePackingListItems.ts`. Worth knowing before touching
content or the generator:

- **Per-person fan-out.** An item produces one row per selected person in
  `personSelections`. Five selected people means five rows.
- **`communal: true` means one row for the whole group**, with `personId: ''`.
  Its `personSelections` stop being "who gets one" and become a **trigger**: the
  item appears if *any* selected person is ticked. This is how "litter tray only
  if the cat is coming" works. Flipping an item to communal is the main lever for
  cutting list bloat.
- **Quantities** come from `perNight` / `perNights` / `maxQuantity` against the
  trip's `nights`: `ceil(nights × perNight / perNights)`, capped, floor 1. No
  rate means no number shown at all — not "1".
- **Duplicates collapse.** Identity is `personId` + trimmed lower-cased text, so
  the same item reaching one person from two answers becomes one row, and the
  surviving row takes the largest quantity of the copies
  (`create-packing-list/deduplicate.ts`). Two things follow for content: an item
  meant to appear in several options needs **byte-identical text** in each, and
  things that must appear twice need genuinely different names.

### `items()` can delete an item outright

In `edit-questions/example-data.ts`, `items(...)` drops any item that **nobody**
is selected for. Combined with a narrow age filter this removes it from the
question set entirely, not just from one person — a `communalItem` filtered to
`getAdults` disappears for a group with no adults. Only narrow a communal item
when the filter is a real trigger (pets, babies), not a guess at who packs it.

## Age and gender filters

`edit-questions/age-specific-items.ts`. Age filters (`getBabies`,
`getChildrenAndOlder`, …) carry an `ageRanges` tag which is stamped onto the
items they build. That tag is what lets **age promotion** revisit an item when
someone moves up a bracket (`age-promotion.ts`). Gender filters deliberately
carry **no** tag, so gender-linked items are never revisited — a known gap.

`Person.gender` is optional and the filters match `'male'` / `'female'` exactly,
so a person with no gender, or `'other'`, silently receives none of those items.

## Sections (item categories)

`edit-questions/item-sections.ts`. A section is just a `category` string stamped
on **every item in it** — there is no section entity and no boundary marker. That
is deliberate: per-item last-write-wins merges and older clients can only ever
misplace the one item they touched, never scramble a whole section.

- An item with no `category` falls back to a **derived** label: the option text
  for multiple-choice questions, the **question** text for single-choice ones,
  and `ALWAYS_NEEDED_CATEGORY` for the always-needed list.
- `CATEGORY_ORDER` fixes the display order of the built-in sections. Labels not
  in it sort after them by item order.
- **Never stamp the default label explicitly** (`'Essentials'` on an
  always-needed item). It is an unstable no-op that the editor strips on the
  first drag.
- `renameSection` / `removeSection` operate on **one item list**. A category
  spanning several options is only half-renamed by them — an open problem.

## Changing the built-in content

`edit-questions/example-data.ts` is the only source of default content, and
`createExampleData()` is called from three places: the wizard, the
age-promotion catalog, and the template-update diff. A content change affects all
three.

**Template updates to existing users are additive only.**
`edit-questions/template-updates.ts` matches by normalised item text and can only
offer *additions* — new items, options, questions, plus a one-off offer to file an
uncategorised set into sections. So:

- A **corrected** filter, quantity rate or communal flag reaches **new users
  only**. Nothing rewrites an item a user already has.
- Bumping `WIZARD_TEMPLATE_VERSION` for a change that yields no additions is a
  **no-op**: `hasTemplateUpdates` short-circuits on the empty list, so the review
  card never appears and the version is never stamped.

**IDs vs text.** Questions and options use stable IDs (`TEMPLATE_QUESTION_IDS`,
`ACTIVITY_OPTION_IDS`, …) precisely so a user's renamed copy still matches;
matching falls back to normalised text only when the ID misses. Renaming an
option whose saved copies predate its stable ID therefore reads as a **new**
option, and the user ends up offered a duplicate. Prefer keeping option text
stable unless the wording itself is the bug.

## Gotchas that cost real time

- **`tsc -b` is incremental**, so a local pass can hide a failure that CI (a cold
  build) hits. Use `npx tsc -b --force` before trusting a green typecheck.
  `npm test` runs the typecheck first, so a type error looks like "no tests ran".
- **A broken typecheck fails both CI jobs**, unit and E2E — `npm run build` runs
  `tsc -b` too, so no browser ever launches. Check for a type error before
  investigating an E2E failure.
- **E2E specs drive the question editor positionally** (`.last()`, "+ Add Item").
  Changing where a new row appears, or the editor's grouping, breaks them —
  `c-packing-lists.spec.ts` C8 is the sensitive one.
- **The wizard reveal names the first distinctive items** it finds
  (`pages/wizard-reveal.ts`), so reordering the always-needed list changes the
  reveal text and its tests.
