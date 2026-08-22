import { expect, test } from '@playwright/test'

const searchedPlace = {
  display_name:
    'SW1A 1AA, City of Westminster, Greater London, England, United Kingdom',
  lat: '51.501009',
  lon: '-0.141588',
}

async function mockPlaceSearch(page: import('@playwright/test').Page) {
  await page.route('https://nominatim.openstreetmap.org/search**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([searchedPlace]),
    }),
  )
}

async function choosePostcodeResult(page: import('@playwright/test').Page) {
  await page
    .getByRole('searchbox', { name: /Search by postcode or place/ })
    .fill('SW1A 1AA')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: searchedPlace.display_name }).click()
}

test.describe('report locations', () => {
  test('a sighting starts without a London pin and accepts a postcode result', async ({
    page,
  }) => {
    await mockPlaceSearch(page)
    await page.goto('/sighting/new')

    await expect(page.locator('.maplibregl-marker')).toHaveCount(0)
    await expect(
      page.getByText(
        'Tap the map or drag a pin to confirm the exact place you saw the pet.',
      ),
    ).toBeVisible()

    await choosePostcodeResult(page)

    await expect(page.locator('.maplibregl-marker')).toHaveCount(1)
    await expect(
      page.getByText(
        'Location selected. Drag the pin or tap the map to adjust it.',
      ),
    ).toBeVisible()
    await expect(page.getByLabel('Where did you see the pet?')).toHaveValue(
      searchedPlace.display_name,
    )
  })

  test('a found-pet report retains postcode and map alternatives when GPS is unavailable', async ({
    page,
  }) => {
    await mockPlaceSearch(page)
    await page.goto('/found/new')

    await expect(page.locator('.maplibregl-marker')).toHaveCount(0)
    await page.getByRole('button', { name: 'Use my location' }).click()
    await expect(
      page.getByText(
        /cannot provide a location|could not access your location/i,
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('searchbox', { name: /Search by postcode or place/ }),
    ).toBeVisible()

    await choosePostcodeResult(page)

    await expect(page.locator('.maplibregl-marker')).toHaveCount(1)
    await expect(page.getByLabel('Where did you find the pet?')).toHaveValue(
      searchedPlace.display_name,
    )
  })
})
