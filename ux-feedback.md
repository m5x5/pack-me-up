# Pack Me Up — UX Feedback Report

**Tested:** Local dev build (equivalent to packmeup.tim-gent.com)
**Date:** 20 June 2026
**Persona:** Marco Bellini — busy marketing manager, 34, planning a 10-day Italy trip with his partner Sofia. Moderate tech-savviness. Used to TripIt and Google Keep. Impatient with friction; expects polish.

---

## Narrative Journal

### First Impression — Landing Page

The landing page loads cleanly. The headline **"Smart Packing Lists, Made Simple"** is clear and the three-step explainer (Set up once → Fine-tune questions → Pack for every trip) is a solid value proposition. I understand what this app does immediately — that's not a given in this niche.

What strikes me as a real user: the **"Own your data / Solid Pod"** angle is *very* prominent — it's basically the first thing under the logo. This feels like leading with the infrastructure rather than the benefit. Normal travellers don't know what a Solid Pod is and won't care. The privacy pitch is valid but it may alienate casual users before they even try the product.

The CTA is clear: **"Get Started with the Wizard"**. Good. I click it.

---

### Wizard — Who's Packing?

The wizard is simple and sensible. I fill in "Marco" (Adult Male) and click "Add Another Person" to add "Sofia" (Adult Female). The form is clean and the age/gender dropdowns make sense for tailoring item lists. This feels purposeful.

One small friction: the **Name field has no visible label** — just an empty text box. As a new user I guessed it was for names, but a label would remove ambiguity.

I click **"Generate My Packing Questions"** and get a success modal almost instantly.

---

### Post-Wizard — Two Modals in a Row

After the wizard, I get **two consecutive modals**, one after the other:

1. **"Questions Generated Successfully"** — two buttons: "Create My First Packing List" and "Refine My Packing List Questions"
2. **"Great! Your Questions Are Ready — Set Up a Solid Pod"** — two buttons: "Set Up Solid Pod" and "Maybe Later"

This is a double-interruption right at the start. The second modal (Solid Pod upsell) fires immediately after clicking through the first. It breaks the forward momentum. Most users will click "Maybe Later" without reading — and some will feel a little annoyed at being asked about infrastructure before they've even seen a packing list.

I click "Maybe Later" and land on the Create Packing List page.

---

### Create Packing List — The Core Flow

This is the core of the app and it works well. The form asks:

- **Packing List Name** (free text)
- **Who is going on this trip?** (checkbox — both Marco and Sofia shown)
- **Will you be staying overnight?** (Yes / No)
- **Are you self-catering?** (Yes / No)
- **What activities?** (multi-select checkboxes)
- **What weather do you expect?** (multi-select checkboxes)

This is exactly right. It's fast to fill in and the questions are sensible for a real trip. I fill it in for Italy (overnight, not self-catering, Swimming + Hiking, Hot + Rain) and click **"Create Packing List"**.

---

### The Packing List — Genuinely Impressive

The generated list is **the clear star of the app**. It gave me 74 items split across both Marco (36 items) and Sofia (38 items), grouped into sensible categories:

- Essentials
- Hot weather items
- Rain items  
- Activity-specific items (Running, Swimming)
- Overnight items

Gender-awareness works — Sofia's list includes items Marco's doesn't (bra, menstrual products, sports bra). This is a meaningful differentiator over a generic packing list app.

The **"Check all"** per-section is a nice touch for fast clearing of a category. The **progress counter** ("6 / 74 packed — 8%") updates correctly. Items collapse by section.

There's an **"Add" button** per person to add custom items, which is essential for any real trip.

---

### View Lists

The lists index page is clean: shows list name, creation date, progress (e.g. "6 / 74 — 8%"), and three actions: Rename, Duplicate, Delete. Duplicate is a thoughtful feature — useful for recurring trip types.

---

### Manage Questions & Items

This page is very powerful but also where the UI gets complex. You can:

- Switch between traveller profiles (Marco / Sofia tabs)
- See all questions with their options and item counts
- Expand/collapse options to see what items they include
- Add new options or new questions

The depth of customisation here is great for power users. For a casual user, however, it could feel overwhelming. There's no explanatory text on this page — it drops you into a dense tree of questions and items without signposting what to do.

---

### Mobile View

The landing page renders responsibly on mobile (390px). The nav collapses behind a hamburger menu. The Create List form also looks usable on mobile. No obvious layout breaks spotted.

---

## Bugs & UX Issues

| # | Type | Title | Description | Severity |
|---|------|-------|-------------|----------|
| 1 | UX Issue | Two modals fire back-to-back after wizard | After clicking "Create My First Packing List" in the success modal, the Solid Pod upsell modal fires immediately. Double interruption kills flow. | High |
| 2 | UX Issue | Solid Pod / "Own your data" prominently above the fold on landing | The Solid Pod concept (an infrastructure detail most users don't know) is positioned as primary UI. This will confuse or deter casual users. Consider moving it below the fold or to a footer note. | High |
| 3 | UX Issue | Name field in wizard has no visible label | The "Name" input has no label element — only implied by placeholder text. Accessibility gap and UX rough edge. | Medium |
| 4 | UX Issue | Overnight section heading used verbatim as category name in list | In the generated list, one category is titled "Will you be staying overnight?" — the literal question text. This is confusing in context; something like "Overnight Essentials" would be cleaner. | Medium |
| 5 | UX Issue | No explanation text on Manage Questions page | Dropping into the Manage Questions page gives no orientation. New users have no idea how edits here affect their future lists. A short explainer at the top would help. | Medium |
| 6 | Missing Feature | No way to set a trip date on the packing list | No date picker on the Create List form — the date shown in View Lists is just the creation date. For a holiday planner, trip start/end dates are key context. | Medium |
| 7 | Missing Feature | No ability to share / export list | Can't share the list with Sofia (partner), export to PDF, or copy to clipboard. For a two-person holiday, the second person can't see their items. | High |
| 8 | Missing Feature | No destination / notes field | There's nowhere to record where you're going. A "Destination" or "Notes" field would make lists more meaningful to return to. | Low |
| 9 | UX Issue | "Feedback" nav item opens a mailto: link | Opens the user's email client which is jarring. An in-app form or a link to a form would be more effective and feel more polished. | Low |
| 10 | UX Issue | Create List form has no "Select all" for people | With multiple travellers, you'd want to include everyone by default. Currently you must manually tick each person. | Low |
| 11 | UX Issue | Running items appear even though "Running" wasn't selected | I checked Swimming and Hiking but the generated list includes "Running" items (Running clothes, running shoes, etc.). The selections did not seem to filter correctly on this run. | High |
| 12 | Missing Feature | No way to delete or reorder items within a list | Items can be checked off or added, but cannot be removed or reordered within a generated list. | Medium |

---

## Overall Assessment

### What's working well

- **Core concept is solid and differentiated.** Per-person, per-activity packing lists with gender-aware item generation is genuinely better than static generic lists.
- **Wizard onboarding is fast** — 60 seconds from landing to a real packing list, which is excellent.
- **Generated list quality is high** — 74 items for two adults across multiple conditions, sensibly grouped. This would actually help someone pack.
- **Section-level "Check all"** and collapsible groups make the list usable on mobile.
- **Duplicate list feature** is a thoughtful power-user touch.
- **Manage Questions is impressively deep** for a v1 product.

### What's holding it back

1. **The Solid Pod angle is a liability at the top of the funnel.** Most users will hit the landing page, see "Login with Solid Pod / Own your data" prominently, not know what that means, and bounce. The product should lead with the travel/packing value prop and only introduce Solid as an opt-in upgrade at a natural moment (e.g. after they've created their first list and want to sync).

2. **The double-modal post-wizard** is the worst single UX moment in the flow. It's the point of maximum user excitement (they just set up their profile!) and it interrupts twice. Merge these into one or eliminate the Solid Pod nag entirely from this moment.

3. **No sharing.** A packing list for two people where only one person can see it is a real limitation. This is probably the single most-requested feature from any real user.

4. **The running items bug** (if real) is a credibility killer — users will distrust the list if it shows items for activities they didn't select.

### Traction verdict

**Yes, with caveats.** The core loop — wizard → questions → personalised list in under 2 minutes — is genuinely good and differentiated. The per-person gender-aware items is a feature I haven't seen elsewhere.

The main risk to traction is the **Solid Pod positioning**. It makes the app look like a tech project rather than a consumer product. If the Solid branding/messaging were moved to a secondary position and the app led purely on "personalised packing lists for couples and families", this could get decent organic traction in travel communities (Reddit r/travel, packing-focused Facebook groups, etc.).

The missing sharing feature is table-stakes for a couples/family app and needs to be on the roadmap before any marketing push.

---

## Screenshots

All screenshots captured from local dev server (identical build to production).

See `/tmp/ux-screenshots/` for the full set. Key screens:

- `01-landing.png` — Landing page first impression
- `02-wizard.png` — Wizard setup
- `05-wizard-both-people.png` — Two-person wizard completed
- `06-after-generate.png` — Success modal (first of two)
- `09-after-maybe-later.png` — Solid Pod modal (second interruption)
- `10-create-packing-list.png` — Create list form
- `14-list-view.png` — Generated packing list
- `16-view-lists.png` — Lists index
- `17-manage-questions.png` — Manage Questions page
- `18-mobile-landing.png` — Mobile landing page
- `19-mobile-create-list.png` — Mobile create list
