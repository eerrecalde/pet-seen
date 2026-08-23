import { expect, test } from '@playwright/test'

const petPhoto = {
  name: 'pet.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAAD0InCAAAADUlEQVR42mNk+M/wHwAF/gL+FA7QWQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

test.describe('photo adjustment', () => {
  test.skip(
    process.env.PLAYWRIGHT_LOCAL !== 'true',
    'Requires the local Vite and Supabase development runtime.',
  )
  test('opens, crops, skips, and replaces a missing-pet photo without gestures', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('bypass', 'owner@petseen.org:owner'),
    )
    await page.goto('/lost/new')
    const upload = page.locator('input[type="file"]')

    await upload.setInputFiles(petPhoto)
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Photo zoom').fill('1.5')
    await page.getByRole('button', { name: 'Use this photo' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.upload-field strong')).toContainText('pet.jpg')

    await upload.setInputFiles(petPhoto)
    await page.getByRole('button', { name: 'Replace' }).click()
    await upload.setInputFiles({ ...petPhoto, name: 'replacement.png' })
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('.upload-field strong')).toContainText(
      'replacement.jpg',
    )
  })

  test('offers the same optional adjustment step for found-pet photos', async ({
    page,
  }) => {
    await page.goto('/found/new')
    await page.locator('input[type="file"]').setInputFiles(petPhoto)
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('.upload-field strong')).toContainText('pet.jpg')
  })
})
