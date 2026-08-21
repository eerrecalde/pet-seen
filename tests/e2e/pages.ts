import { expect, type Page } from '@playwright/test'

export class MissingCasePage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/lost/new')
    await expect(
      this.page.getByRole('heading', { name: 'Tell us about your pet.' }),
    ).toBeVisible()
  }

  async createAndPublish(name: string) {
    await this.open()
    await this.page.getByLabel('Pet’s name').fill(name)
    await this.page.getByLabel('Breed').fill('Border collie')
    await this.page.getByLabel('Colour or markings').fill('Black and white')
    await this.page.getByRole('button', { name: 'Continue' }).click()
    await expect(
      this.page.getByRole('heading', { name: `Where was ${name} last seen?` }),
    ).toBeVisible()
    await this.page
      .getByLabel('Place or landmark')
      .fill('Victoria Park south gate')
    await this.page
      .getByLabel('Map for choosing the last seen location')
      .click({ position: { x: 220, y: 120 } })
    await this.page
      .getByRole('button', { name: 'Save and publish case' })
      .click()
    await expect(this.page.getByText('Case published.')).toBeVisible()
  }
}

export class PublicCasePage {
  constructor(private readonly page: Page) {}

  async open(slug: string, petName: string) {
    await this.page.goto(`/find/${slug}`)
    await expect(
      this.page.getByRole('heading', { name: `${petName} is missing` }),
    ).toBeVisible()
  }
}

export class SightingPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/sighting/new')
    await expect(
      this.page.getByRole('heading', { name: 'Tell us what you saw.' }),
    ).toBeVisible()
  }

  async submit(petName: string) {
    await this.open()
    await this.page
      .getByRole('button', { name: 'Choose a missing pet' })
      .click()
    await this.page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(petName) })
      .click()
    await this.page
      .getByLabel('Where did you see the pet?')
      .fill('Victoria Park lakeside path')
    await this.page
      .getByLabel('Map for choosing the last seen location')
      .click({ position: { x: 220, y: 120 } })
    await this.page
      .getByLabel('Details')
      .fill('Saw the dog heading east near the lake.')
    await this.page.getByRole('button', { name: 'Submit sighting' }).click()
    await expect(
      this.page.getByRole('heading', { name: 'Sighting shared.' }),
    ).toBeVisible()
  }
}

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/dashboard')
    await expect(
      this.page.getByRole('heading', {
        name: 'Manage your missing-pet cases.',
      }),
    ).toBeVisible()
  }

  async confirmSightingAndReunite() {
    await this.page.getByRole('button', { name: 'Confirm' }).click()
    await expect(this.page.getByText('Sighting status updated.')).toBeVisible()
    await this.page.getByRole('button', { name: 'Mark reunited' }).click()
    await expect(
      this.page.getByRole('heading', { name: 'Tell us about the reunion.' }),
    ).toBeVisible()
    await this.page
      .getByLabel('How was your pet reunited?')
      .selectOption('seen_after_report')
    await this.page.getByRole('radio', { name: 'Yes' }).check()
    await this.page.getByRole('button', { name: 'Confirm reunion' }).click()
    await expect(this.page.getByText('Case status updated.')).toBeVisible()
  }
}
