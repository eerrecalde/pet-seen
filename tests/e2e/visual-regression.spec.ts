import { test, expect, type Page } from '@playwright/test'
import { DashboardPage, MissingCasePage, PublicCasePage, SightingPage } from './pages'
import { createStagingOwner, deleteStagingOwner, signInPage, type StagingOwner, useFixedTime } from './staging'

function volatileUi(page: Page) {
  return [
    page.locator('.maplibregl-canvas'),
    page.locator('.location-map'),
    page.locator('.pet-photo, .pet-placeholder'),
    page.locator('input[type="datetime-local"]'),
    page.locator('.account-email'),
  ]
}

test.describe.serial('staging visual regression', () => {
  let owner: StagingOwner
  let slug = ''
  const petName = 'Snapshot Scout'

  test.beforeAll(async () => { owner = await createStagingOwner() })
  test.afterAll(async () => { await deleteStagingOwner(owner) })

  test('missing-case page matches its snapshot', async ({ page }) => {
    await signInPage(page, owner.session)
    await new MissingCasePage(page).open()
    await expect(page).toHaveScreenshot('missing-case-page.png', { fullPage: true, mask: volatileUi(page), animations: 'disabled' })
    await new MissingCasePage(page).createAndPublish(petName)
    await page.goto('/dashboard')
    slug = new URL(await page.getByRole('link', { name: 'View public page' }).getAttribute('href') ?? '', 'https://petseen-staging.pages.dev').pathname.split('/').pop() ?? ''
  })

  test('public-case page matches its snapshot', async ({ page }) => {
    await useFixedTime(page)
    await new PublicCasePage(page).open(slug, petName)
    await expect(page).toHaveScreenshot('public-case-page.png', { fullPage: true, mask: volatileUi(page), animations: 'disabled' })
  })

  test('sighting page matches its snapshot', async ({ page }) => {
    await useFixedTime(page)
    await new SightingPage(page).open()
    await expect(page).toHaveScreenshot('sighting-page.png', { fullPage: true, mask: volatileUi(page), animations: 'disabled' })
  })

  test('owner dashboard matches its snapshot', async ({ page }) => {
    await signInPage(page, owner.session)
    await new DashboardPage(page).open()
    await expect(page).toHaveScreenshot('owner-dashboard-page.png', { fullPage: true, mask: volatileUi(page), animations: 'disabled' })
  })
})
