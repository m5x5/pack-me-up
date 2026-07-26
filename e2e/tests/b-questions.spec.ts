import { test, expect } from '../fixtures'
import { fillPersonRequiredFields } from '../helpers/wizard'

async function setupWizardAndGoToQuestions(page: import('@playwright/test').Page) {
  await page.goto('/#/wizard')
  await fillPersonRequiredFields(page)
  await page.getByRole('button', { name: /Generate My Packing Questions/i }).click()
  // Use role heading to distinguish modal title from toast notification
  await expect(page.getByRole('heading', { name: /Questions Generated Successfully/i })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /Refine My Packing List Questions/i }).click()
  // handle pod prompt
  try {
    await page.getByRole('button', { name: 'Maybe Later' }).click({ timeout: 3_000 })
  } catch { /* already dismissed or logged in */ }
  await page.waitForURL(/#\/manage-questions/, { timeout: 8_000 })
}

/** Open the People editing modal via the pencil icon in the legend. */
async function openPeopleModal(page: import('@playwright/test').Page) {
  await page.locator('button[title="Edit people"]').click()
  await expect(page.getByRole('heading', { name: 'Edit People' })).toBeVisible({ timeout: 3_000 })
}

/** Open the Always Needed Items editing modal via the pencil icon in the section header. */
async function openAlwaysNeededModal(page: import('@playwright/test').Page) {
  await page.locator('button[title="Edit always needed items"]').click()
  await expect(page.getByRole('heading', { name: 'Always Needed Items' })).toBeVisible({ timeout: 3_000 })
}

test.describe('B – Editing Questions', () => {
  test('B1: manage-questions page loads with sections', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    // Use role heading to avoid strict mode (nav links also contain "My Questions & Items")
    await expect(page.getByRole('heading', { name: 'My Questions & Items' })).toBeVisible()
    // People edit button is visible in the legend
    await expect(page.locator('button[title="Edit people"]')).toBeVisible()
    // Always Needed Items section is visible
    await expect(page.getByText(/Always Needed Items/i).first()).toBeVisible()
    // Always Needed Items pencil button is visible
    await expect(page.locator('button[title="Edit always needed items"]')).toBeVisible()
  })

  test('B2: add a person to the question set', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    // Open People modal
    await openPeopleModal(page)
    // Count existing person name inputs
    const personInputs = page.locator('input[placeholder^="Person "]')
    const initialCount = await personInputs.count()
    // Click Add Person
    await page.getByRole('button', { name: '+ Add Person' }).click()
    await expect(personInputs).toHaveCount(initialCount + 1)
    // Fill in the new person's name
    await personInputs.last().fill('Charlie')
    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'Edit People' })).not.toBeVisible({ timeout: 3_000 })
    // The save triggers an async IndexedDB write. Give it time to commit before reload
    // (navigating while the transaction is open aborts it).
    await page.waitForTimeout(800)
    // Reload to confirm persistence
    await page.reload()
    await openPeopleModal(page)
    await expect(personInputs.last()).toHaveValue('Charlie', { timeout: 5_000 })
  })

  test('B3: remove a person from the question set', async ({ freshPage: page }) => {
    // Wizard creates one person "Me" — we need at least 2 to remove one
    await page.goto('/#/wizard')
    const nameInputs = page.locator('input[type="text"]')
    await nameInputs.first().fill('PersonA')
    await fillPersonRequiredFields(page, 0)
    await page.getByRole('button', { name: /Add Another Person/i }).click()
    await nameInputs.nth(1).fill('PersonB')
    await fillPersonRequiredFields(page, 1)
    await page.getByRole('button', { name: /Generate My Packing Questions/i }).click()
    await expect(page.getByRole('heading', { name: /Questions Generated Successfully/i })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Refine My Packing List Questions/i }).click()
    try { await page.getByRole('button', { name: 'Maybe Later' }).click({ timeout: 3_000 }) } catch { /* ok */ }
    await page.waitForURL(/#\/manage-questions/, { timeout: 8_000 })
    // Open People modal
    await openPeopleModal(page)
    const personInputs = page.locator('input[placeholder^="Person "]')
    // Verify both people are there
    await expect(personInputs).toHaveCount(2)
    await expect(personInputs.nth(0)).toHaveValue('PersonA')
    await expect(personInputs.nth(1)).toHaveValue('PersonB')
    // Remove person 2 (PersonB) via its × button
    const removeButtons = page.locator('button[title="Remove person"]')
    await removeButtons.nth(1).click()
    await expect(personInputs).toHaveCount(1)
    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'Edit People' })).not.toBeVisible({ timeout: 3_000 })
    // Give the async IndexedDB write time to commit before reload
    await page.waitForTimeout(800)
    // Reload and verify only PersonA remains
    await page.reload()
    await openPeopleModal(page)
    await expect(personInputs).toHaveCount(1)
    await expect(personInputs.first()).toHaveValue('PersonA')
  })

  test('B4: add an always-needed item', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    // Open Always Needed Items modal
    await openAlwaysNeededModal(page)
    // Click "+ Add Item" to append a new empty item row
    await page.getByRole('button', { name: '+ Add Item' }).click()
    // The new item uses CustomCreatableSelect in inactive mode (.cursor-text).
    // Clicking it transitions to the full react-select (ActiveSelect with autoFocus).
    await page.locator('.cursor-text').last().click()
    // Wait for the react-select control to mount (ActiveSelect renders after activation).
    const reactSelectControl = page.locator('.react-select__control').last()
    await expect(reactSelectControl).toBeVisible({ timeout: 3_000 })
    // Click the control — this is the canonical react-select interaction that reliably
    // opens the dropdown (fires onControlMouseDown → onMenuOpen → setMenuIsOpen(true)).
    await reactSelectControl.click()
    await page.keyboard.type('WaterBottleTest')
    // Click the first dropdown option — should be 'Create "WaterBottleTest"' since this name
    // is not in any wizard-generated suggestion. Menu is portaled to document.body.
    const newItemOption = page.locator('.react-select__option').filter({ hasText: /WaterBottleTest/i }).first()
    await expect(newItemOption).toBeVisible({ timeout: 5_000 })
    await newItemOption.click()
    // Save changes
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Always Needed Items' })).not.toBeVisible({ timeout: 3_000 })
    // Expand the Always Needed Items section to verify the item appears
    await page.getByRole('button', { name: /Always Needed Items/i }).first().click()
    await expect(page.getByText('WaterBottleTest')).toBeVisible({ timeout: 5_000 })
  })

  test('B6: reorder always-needed items via the move menu', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    await openAlwaysNeededModal(page)

    // Item names render in inactive CustomCreatableSelect mode (.cursor-text)
    const itemTexts = page.locator('.cursor-text')
    // First line only — the row also renders a "×" clear glyph on its own line
    const first = (await itemTexts.first().innerText()).split('\n')[0].trim()
    const second = (await itemTexts.nth(1).innerText()).split('\n')[0].trim()
    expect(first).not.toEqual(second)

    // Enter organise mode — rows collapse to name + drag handle + move menu
    await page.getByRole('button', { name: 'Organise items' }).click()
    await expect(page.locator('.cursor-text')).toHaveCount(0)

    // Send the second item to the top of the section, swapping the two.
    // The menu is portaled to document.body.
    await page.locator('[data-reorder-row]').nth(1).getByTitle('Move item').click()
    await page.getByRole('menuitem', { name: 'Move to top of section' }).click()
    await page.getByRole('button', { name: 'Finish organising' }).click()
    await expect(itemTexts.first()).toContainText(second)
    await expect(itemTexts.nth(1)).toContainText(first)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Always Needed Items' })).not.toBeVisible({ timeout: 3_000 })

    // Reopen the modal — the swapped order must have persisted
    await openAlwaysNeededModal(page)
    await expect(itemTexts.first()).toContainText(second)
    await expect(itemTexts.nth(1)).toContainText(first)
  })

  test('B7: reorder always-needed items by dragging the handle', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    await openAlwaysNeededModal(page)

    const itemTexts = page.locator('.cursor-text')
    const first = (await itemTexts.first().innerText()).split('\n')[0].trim()
    const second = (await itemTexts.nth(1).innerText()).split('\n')[0].trim()
    expect(first).not.toEqual(second)

    await page.getByRole('button', { name: 'Organise items' }).click()
    const rows = page.locator('[data-reorder-row]')
    await expect(rows.first()).toBeVisible()

    // Drag the first row's handle down into the second row, just past its top
    // edge (before its midpoint) so the item lands in exactly slot 1. Aiming
    // deeper would cross the next row's midpoint and overshoot. Low-level mouse
    // moves dispatch pointer events, driving the same code path as touch.
    // Prefix match: the handle's tooltip also mentions moving between sections
    const handle = page.locator('button[title^="Drag to reorder"]').first()
    const hb = (await handle.boundingBox())!
    const sb = (await rows.nth(1).boundingBox())!
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x + hb.width / 2, sb.y + 4, { steps: 10 })
    await page.mouse.up()

    // The drag reordered the two items (still in organise mode, rows show plain text)
    await expect(rows.first()).toContainText(second)
    await expect(rows.nth(1)).toContainText(first)

    // Leave organise mode. dnd-kit suppresses the single click that immediately
    // follows a drop, so retry until organise mode actually exits (a real user
    // never taps this fast; the suppression is invisible in practice).
    await expect(async () => {
      await page.getByRole('button', { name: 'Finish organising' }).click()
      await expect(page.getByRole('button', { name: 'Organise items' })).toBeVisible({ timeout: 1_000 })
    }).toPass()
    await expect(itemTexts.first()).toContainText(second)
    await expect(itemTexts.nth(1)).toContainText(first)

    // Persist and reopen — the dragged order must survive a save round-trip
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Always Needed Items' })).not.toBeVisible({ timeout: 3_000 })
    await openAlwaysNeededModal(page)
    await expect(itemTexts.first()).toContainText(second)
    await expect(itemTexts.nth(1)).toContainText(first)
  })

  test('B8: reorder always-needed items from the keyboard', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    await openAlwaysNeededModal(page)

    const itemTexts = page.locator('.cursor-text')
    const first = (await itemTexts.first().innerText()).split('\n')[0].trim()
    const second = (await itemTexts.nth(1).innerText()).split('\n')[0].trim()
    expect(first).not.toEqual(second)

    await page.getByRole('button', { name: 'Organise items' }).click()
    const rows = page.locator('[data-reorder-row]')
    await expect(rows.first()).toBeVisible()

    // Space picks the item up, the arrow keys move it, space drops it — no
    // pointer and no per-direction buttons involved. Each step waits for the
    // drag to catch up: a real user cannot press the next key within the same
    // frame, and dnd-kit ignores keys it receives before it has measured.
    const announcements = page.locator('[role="status"][aria-live="assertive"]')
    await page.locator('button[title^="Drag to reorder"]').first().focus()
    await page.keyboard.press('Space')
    await expect(announcements).toContainText(`Picked up ${first}`)
    await page.keyboard.press('ArrowDown')
    await expect(announcements).toContainText('position 2')
    await page.keyboard.press('Space')
    await expect(announcements).toContainText('Dropped')

    await expect(rows.first()).toContainText(second)
    await expect(rows.nth(1)).toContainText(first)

    // Persist and reopen — the keyboard move must survive a save round-trip
    await page.getByRole('button', { name: 'Finish organising' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Always Needed Items' })).not.toBeVisible({ timeout: 3_000 })
    await openAlwaysNeededModal(page)
    await expect(itemTexts.first()).toContainText(second)
    await expect(itemTexts.nth(1)).toContainText(first)
  })

  test('B5: JSON editor mode toggle is not available (editor is always visual)', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    // The JSON editor toggle does not exist in the current UI
    await expect(page.getByRole('heading', { name: 'My Questions & Items' })).toBeVisible()
    // No JSON toggle button should be present
    await expect(page.getByRole('button', { name: /^json$|edit.*json/i })).not.toBeVisible()
  })

  test('B6: a freshly set-up user is not shown the template-updates prompt', async ({ freshPage: page }) => {
    // The wizard stamps the current template version, so a brand-new set is
    // already up to date and must not nag the user with "new suggestions".
    await setupWizardAndGoToQuestions(page)
    await expect(page.getByRole('heading', { name: 'My Questions & Items' })).toBeVisible()
    await expect(page.getByText(/new suggestion/i)).not.toBeVisible()
    // Reloading (re-reading the persisted set) must not surface it either.
    await page.waitForTimeout(500)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'My Questions & Items' })).toBeVisible()
    await expect(page.getByText(/new suggestion/i)).not.toBeVisible()
  })

  test('B9: rename an item in place, without opening the option modal', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    // Expand the read-only list. Tapping a row used to do nothing — the only way
    // in was the section's pencil, which reopened every item in a modal.
    await page.getByRole('button', { name: /Always Needed Items/i }).first().click()

    const firstRow = page.getByTestId('item-row').first()
    await expect(firstRow).toBeVisible({ timeout: 5_000 })
    const originalName = (await firstRow.innerText()).split('\n')[0].trim()
    expect(originalName).not.toEqual('InlineRenameTest')
    await firstRow.click()

    const editor = page.getByTestId('item-inline-editor')
    await expect(editor).toBeVisible({ timeout: 3_000 })

    // Same react-select dance as B4: the name field is a cheap placeholder until
    // it is clicked, then the full control mounts.
    await editor.getByTestId('item-name-field').locator('.cursor-text').click()
    const control = page.locator('.react-select__control').last()
    await expect(control).toBeVisible({ timeout: 3_000 })
    await control.click()
    await page.keyboard.type('InlineRenameTest')
    const created = page.locator('.react-select__option').filter({ hasText: /InlineRenameTest/i }).first()
    await expect(created).toBeVisible({ timeout: 5_000 })
    await created.click()

    await page.getByRole('button', { name: 'Done' }).click()
    await expect(editor).not.toBeVisible({ timeout: 3_000 })

    // The edit saves as it is made, so it must survive a reload with no
    // further confirmation step.
    await page.waitForTimeout(800)
    await page.reload()
    await page.getByRole('button', { name: /Always Needed Items/i }).first().click()
    await expect(page.getByText('InlineRenameTest')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(originalName, { exact: true })).not.toBeVisible()
  })

  test('B10: add an item straight into a named section', async ({ freshPage: page }) => {
    // Contrast with B4, which is the old way in: open the modal, append a blank
    // row, fight react-select, save the whole option — and the row still landed
    // in whichever section came last.
    await setupWizardAndGoToQuestions(page)
    await page.getByRole('button', { name: /Always Needed Items/i }).first().click()

    const toiletries = page.getByTestId('item-section').filter({ hasText: 'Toiletries' }).first()
    await expect(toiletries).toBeVisible({ timeout: 5_000 })
    await toiletries.getByTestId('add-to-section').click()

    const field = page.getByLabel('New item in Toiletries')
    await expect(field).toBeVisible({ timeout: 3_000 })
    await field.fill('SectionAddTest')
    await field.press('Enter')

    // It lands under the heading it was typed into, not at the end of the list.
    await expect(toiletries.getByText('SectionAddTest')).toBeVisible({ timeout: 5_000 })
    // And the composer stays, cleared, because items go in in runs.
    await expect(field).toHaveValue('')

    // Adding saves as it goes — no confirmation step to reach for.
    await page.waitForTimeout(800)
    await page.reload()
    await page.getByRole('button', { name: /Always Needed Items/i }).first().click()
    const afterReload = page.getByTestId('item-section').filter({ hasText: 'Toiletries' }).first()
    await expect(afterReload.getByText('SectionAddTest')).toBeVisible({ timeout: 5_000 })
  })

  test('B11: a suggested name brings its section with it', async ({ freshPage: page }) => {
    await setupWizardAndGoToQuestions(page)
    await page.getByRole('button', { name: /Always Needed Items/i }).first().click()

    // The composer at the foot of the list is the one that asks where the item
    // goes, so it is the one a suggestion can answer for.
    await page.getByRole('button', { name: '+ Add item' }).first().click()
    const field = page.getByLabel(/^New item in /)
    await expect(field).toBeVisible({ timeout: 3_000 })

    // "Sunscreen" lives under Toiletries in a question elsewhere in the set;
    // taking the suggestion is what files it there without a second trip.
    await field.fill('sunscr')
    const suggestion = page.getByRole('option', { name: /Sunscreen/ }).first()
    await expect(suggestion).toBeVisible({ timeout: 3_000 })
    await suggestion.click()
    await expect(page.getByLabel('Section')).toHaveValue('Toiletries')

    await field.press('Enter')
    const toiletries = page.getByTestId('item-section').filter({ hasText: 'Toiletries' }).first()
    await expect(toiletries.getByText('Sunscreen')).toBeVisible({ timeout: 5_000 })
  })

  test('B12: an answer with no items can take its first one', async ({ freshPage: page }) => {
    // Before, an empty answer had no expander and no input at all: its only way
    // in was the option modal.
    await setupWizardAndGoToQuestions(page)
    // Pinned by position, not by its "No items" hint: adding the item removes
    // that hint, and a locator built on it would stop matching the thing it is
    // meant to be checking.
    const options = page.getByTestId('option-section')
    await expect(options.first()).toBeVisible({ timeout: 5_000 })
    let emptyIndex = -1
    for (let i = 0; i < await options.count(); i++) {
      if (await options.nth(i).getByText('No items').count()) { emptyIndex = i; break }
    }
    expect(emptyIndex).toBeGreaterThanOrEqual(0)
    const emptyOption = options.nth(emptyIndex)
    await emptyOption.getByTestId('option-expand-chevron').click()

    await emptyOption.getByRole('button', { name: '+ Add item' }).click()
    const field = emptyOption.locator('input[role="combobox"]')
    await field.fill('FirstItemTest')
    await field.press('Enter')
    await expect(emptyOption.getByText('FirstItemTest')).toBeVisible({ timeout: 5_000 })
    await expect(emptyOption.getByText('No items')).not.toBeVisible()
  })
})
