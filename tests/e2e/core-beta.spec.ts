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
