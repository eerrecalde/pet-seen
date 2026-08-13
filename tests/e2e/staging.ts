import { createClient, type Session } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const url = required('PLAYWRIGHT_STAGING_SUPABASE_URL')
const anonKey = required('PLAYWRIGHT_STAGING_SUPABASE_ANON_KEY')
const serviceRoleKey = required('PLAYWRIGHT_STAGING_SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set for staging Playwright tests.`)
  return value
}

export type StagingOwner = { id: string, session: Session }

const fixedNow = new Date('2026-08-13T12:00:00.000Z').valueOf()

export async function createStagingOwner(): Promise<StagingOwner> {
  const email = `playwright-${crypto.randomUUID()}@petseen.invalid`
  const password = `Pw-${crypto.randomUUID()}-9a!`
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createError || !created.user) throw createError ?? new Error('Could not create the Playwright owner.')
  const browserClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await browserClient.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw error ?? new Error('Could not create a browser session for the Playwright owner.')
  }
  return { id: created.user.id, session: data.session }
}

export async function signInPage(page: Page, session: Session) {
  const projectRef = new URL(url).hostname.split('.')[0]
  await page.addInitScript(({ key, value, now }) => {
    window.localStorage.setItem(key, value)
    const RealDate = Date
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(args.length === 0 ? now : args[0])
      }

      static now() { return now }
    }
    window.Date = FixedDate as DateConstructor
  }, {
    key: `sb-${projectRef}-auth-token`, value: JSON.stringify(session), now: fixedNow,
  })
}

export async function useFixedTime(page: Page) {
  await page.addInitScript((now) => {
    const RealDate = Date
    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(args.length === 0 ? now : args[0])
      }

      static now() { return now }
    }
    window.Date = FixedDate as DateConstructor
  }, fixedNow)
}

export async function deleteStagingOwner(owner: StagingOwner | undefined) {
  if (owner) await admin.auth.admin.deleteUser(owner.id)
}
