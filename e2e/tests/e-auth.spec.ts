import { test, expect } from '../fixtures'
import { loginToCss } from '../helpers/login'

const CSS_ISSUER = process.env.CSS_ISSUER ?? 'http://localhost:4001'
const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'test1234'

test.describe('E – Solid Pod Authentication', () => {
  test('E1: full login flow completes and shows logged-in state', async ({ freshPage: page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Login with Solid Pod' })).toBeVisible()
    await loginToCss(page, CSS_ISSUER, TEST_EMAIL, TEST_PASSWORD)
    const accountMenu = page.getByRole('button', { name: 'Account menu' })
    await expect(accountMenu).toBeVisible()
    // the full webId lives in the dropdown
    await accountMenu.click()
    await expect(page.getByRole('menu').getByText(/localhost:4001\/testuser/)).toBeVisible()
  })

  test('E2: logout returns to unauthenticated state', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await expect(page.getByRole('button', { name: 'Login with Solid Pod' })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: 'Account menu' })).not.toBeVisible()
  })

  test('E3: Backups link appears in the account menu only when logged in', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await expect(page.getByRole('menuitem', { name: 'Backups' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await expect(page.getByRole('button', { name: 'Account menu' })).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('link', { name: 'Backups' })).not.toBeVisible()
  })

  test('E4: session restored on page reload', async ({ authedPage: page }) => {
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
    await page.reload()
    // Session should be restored from storage
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible({ timeout: 15_000 })
  })
})
