import { test, expect } from '@playwright/test'
import {
  DashboardPage,
  MissingCasePage,
  PublicCasePage,
  SightingPage,
} from './pages'
import {
  createStagingOwner,
  deleteStagingOwner,
  signInPage,
  type StagingOwner,
  useFixedTime,
} from './staging'

test.describe.serial('core beta loop on staging', () => {
  let owner: StagingOwner
  let slug = ''
  const petName = 'Playwright Scout'

  test.beforeAll(async () => {
    owner = await createStagingOwner()
  })
  test.afterAll(async () => {
    await deleteStagingOwner(owner)
  })

  test('owner can publish a missing-pet case', async ({ page }) => {
    await signInPage(page, owner.session)
    const missingCase = new MissingCasePage(page)
    await missingCase.createAndPublish(petName)
    await page.goto('/dashboard')
    const publicLink = page.getByRole('link', { name: 'View public page' })
    await expect(publicLink).toBeVisible()
    slug =
      new URL(
        (await publicLink.getAttribute('href')) ?? '',
        'https://petseen-staging.pages.dev',
      ).pathname
        .split('/')
        .pop() ?? ''
    expect(slug).not.toBe('')
  })

  test('public page shows the published case', async ({ page }) => {
    await useFixedTime(page)
    await new PublicCasePage(page).open(slug, petName)
  })

  test('a visitor can view the full pet photo and close the dialog', async ({
    page,
  }) => {
    await useFixedTime(page)
    await new PublicCasePage(page).open(slug, petName)

    const photoTrigger = page.getByRole('button', {
      name: `View full photo of ${petName}`,
    })
    await photoTrigger.click()

    const dialog = page.getByRole('dialog', { name: petName })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.modal-photo')).toBeVisible()
    await expect(dialog.getByRole('heading', { name: petName })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(photoTrigger).toBeFocused()

    await photoTrigger.click()
    await dialog.getByRole('button', { name: 'Close dialog' }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('neighbour can submit a linked sighting', async ({ page }) => {
    await useFixedTime(page)
    await new SightingPage(page).submit(petName)
  })

  test('owner can confirm the sighting and mark the pet reunited', async ({
    page,
  }) => {
    await signInPage(page, owner.session)
    const dashboard = new DashboardPage(page)
    await dashboard.open()
    await dashboard.confirmSightingAndReunite()
  })
})
