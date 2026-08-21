import { expect, test } from '@playwright/test'
import {
  createStagingFoundPetReport,
  createStagingStaff,
  deleteStagingFoundPetReport,
  deleteStagingOwner,
  foundPetAuditEvents,
  foundPetPhotoExists,
  foundPetReportExists,
  signInPage,
  type StagingFoundPetReport,
  type StagingStaff,
} from './staging'

test.describe.serial('found-pet lifecycle on staging', () => {
  let staff: StagingStaff
  let managed: StagingFoundPetReport
  let stale: StagingFoundPetReport
  let retention: StagingFoundPetReport

  test.beforeAll(async () => {
    staff = await createStagingStaff()
    managed = await createStagingFoundPetReport({
      withPhoto: true,
      submittedBy: staff.session,
    })
    stale = await createStagingFoundPetReport({
      foundAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      submittedBy: staff.session,
    })
    retention = await createStagingFoundPetReport({
      lifecycleStatus: 'resolved',
      lifecycleChangedAt: new Date(
        Date.now() - 366 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      withPhoto: true,
      submittedBy: staff.session,
    })
  })

  test.afterAll(async () => {
    await Promise.all([
      deleteStagingFoundPetReport(managed),
      deleteStagingFoundPetReport(stale),
      deleteStagingFoundPetReport(retention),
    ])
    await deleteStagingOwner(staff)
  })

  test('staff can resolve, reopen, expire, delete, and run critical housekeeping', async ({
    page,
  }) => {
    await signInPage(page, staff.session)
    await page.goto('/moderation')
    await expect(
      page.getByRole('heading', { name: 'Report review' }),
    ).toBeVisible()

    const activeCard = page.locator('.found-match-card', {
      hasText: managed.details,
    })
    await expect(activeCard).toBeVisible()
    await activeCard.getByRole('button', { name: 'Resolve' }).click()
    await expect(
      page.getByText('Resolved or expired reports (2)'),
    ).toBeVisible()
    await page.locator('.lifecycle-archive summary').click()
    const resolvedCard = page.locator('.found-match-card', {
      hasText: managed.details,
    })
    await expect(
      resolvedCard.getByText('Resolved', { exact: true }),
    ).toBeVisible()
    await resolvedCard.getByRole('button', { name: 'Reopen report' }).click()
    await expect(activeCard).toBeVisible()
    await activeCard.getByRole('button', { name: 'Expire' }).click()
    await expect(page.locator('.lifecycle-archive')).toContainText(
      managed.details,
    )
    await page.locator('.lifecycle-archive summary').click()
    const expiredCard = page.locator('.found-match-card', {
      hasText: managed.details,
    })
    await expiredCard.getByRole('button', { name: 'Delete report' }).click()
    await expect(page.getByText(managed.details)).toHaveCount(0)
    await expect.poll(() => foundPetReportExists(managed.id)).toBe(false)
    await expect
      .poll(() => foundPetPhotoExists(managed.sourceObjectPath!))
      .toBe(false)
    await expect
      .poll(() => foundPetAuditEvents(managed.id, staff.session))
      .toContain('deleted')

    await page.getByRole('button', { name: 'Run housekeeping' }).click()
    await expect.poll(() => foundPetReportExists(stale.id)).toBe(true)
    await expect.poll(() => foundPetReportExists(retention.id)).toBe(false)
    await page.reload()
    await page.locator('.lifecycle-archive summary').click()
    await expect(page.locator('.lifecycle-archive')).toContainText(
      stale.details,
    )
    await expect
      .poll(() => foundPetPhotoExists(retention.sourceObjectPath!))
      .toBe(false)
    await expect
      .poll(() => foundPetAuditEvents(stale.id, staff.session))
      .toContain('expired')
    await expect
      .poll(() => foundPetAuditEvents(retention.id, staff.session))
      .toContain('retention_deleted')
  })
})
