import { expect, test } from '@playwright/test'
import { deflateSync } from 'node:zlib'

function crc32(bytes: Buffer) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
  }
  return (value ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, body: Buffer) {
  const name = Buffer.from(type)
  const chunk = Buffer.alloc(12 + body.length)
  chunk.writeUInt32BE(body.length, 0)
  name.copy(chunk, 4)
  body.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([name, body])), 8 + body.length)
  return chunk
}

function createPetPhoto() {
  const width = 2300
  const height = 1800
  const row = Buffer.alloc(width * 4 + 1)
  for (let column = 0; column < width; column += 1) {
    const offset = 1 + column * 4
    row[offset] = 211
    row[offset + 1] = column % 2 ? 137 : 158
    row[offset + 2] = 91
    row[offset + 3] = 255
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row))
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return {
    name: 'pet.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([
      Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
      pngChunk('IHDR', header),
      pngChunk('IDAT', deflateSync(pixels)),
      pngChunk('IEND', Buffer.alloc(0)),
    ]),
  }
}

const petPhoto = createPetPhoto()

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
    await page.getByLabel('Zoom').fill('1.5')
    const usePhoto = page.getByRole('button', { name: 'Use this photo' })
    await expect(usePhoto).toBeEnabled()
    await usePhoto.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.upload-field strong')).toContainText('pet.jpg')

    await upload.setInputFiles(petPhoto)
    await page.getByRole('button', { name: 'Replace' }).click()
    await upload.setInputFiles({ ...petPhoto, name: 'replacement.png' })
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('.upload-field strong')).toContainText(
      'replacement.jpg',
    )

    await page.getByLabel('Pet’s name').fill('Photo test dog')
    await page.getByLabel('Breed').fill('Test breed')
    await page.getByLabel('Colour or markings').fill('Black')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Place or landmark').fill('Photo test location')
    await page
      .getByLabel('Map for choosing the last seen location')
      .click({ position: { x: 220, y: 120 } })
    await page.getByRole('button', { name: 'Save and publish case' }).click()
    await expect(page.getByText('Case published.')).toBeVisible()
  })

  test('offers the same optional adjustment step for found-pet photos', async ({
    page,
  }) => {
    await page.goto('/found/new')
    await page.locator('input[type="file"]').setInputFiles(petPhoto)
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Use this photo' }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('.upload-field strong')).toContainText('pet.jpg')
    await page.getByLabel('Details').fill('Photo test found-pet report.')
    await page
      .getByLabel('Where did you find the pet?')
      .fill('Photo test location')
    await page
      .getByLabel('Map for choosing the last seen location')
      .click({ position: { x: 220, y: 120 } })
    await page.getByRole('button', { name: 'Save found-pet report' }).click()
    await expect(
      page.getByRole('heading', { name: 'Found-pet report saved.' }),
    ).toBeVisible()
  })

  test('shows the submitted found-pet photo in the authorised staff queue', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('bypass', 'moderator@petseen.org:moderator'),
    )
    await page.goto('/moderation')

    const report = page
      .locator('.found-match-card')
      .filter({ hasText: 'Photo test found-pet report.' })
      .first()
    await expect(report).toBeVisible()
    await expect(report.locator('img')).toBeVisible()
  })
})
