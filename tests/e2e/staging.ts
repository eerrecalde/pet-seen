import { createClient, type Session } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const url = required('PLAYWRIGHT_STAGING_SUPABASE_URL')
const anonKey = required('PLAYWRIGHT_STAGING_SUPABASE_ANON_KEY')
const serviceRoleKey = required('PLAYWRIGHT_STAGING_SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set for staging Playwright tests.`)
  return value
}

export type StagingOwner = { id: string, session: Session }
export type StagingStaff = { id: string, session: Session }
export type StagingFoundPetReport = { id: string, details: string, sourceObjectPath: string | null, displayObjectPath: string | null }

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

export async function createStagingStaff(): Promise<StagingStaff> {
  const email = `playwright-staff-${crypto.randomUUID()}@petseen.invalid`
  const password = `Pw-${crypto.randomUUID()}-9a!`
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createError || !created.user) throw createError ?? new Error('Could not create the Playwright staff member.')
  const { error: roleError } = await admin.from('user_roles').insert({ user_id: created.user.id, role: 'moderator' })
  if (roleError) { await admin.auth.admin.deleteUser(created.user.id); throw roleError }
  const browserClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await browserClient.auth.signInWithPassword({ email, password })
  if (error || !data.session) { await admin.auth.admin.deleteUser(created.user.id); throw error ?? new Error('Could not create a browser session for the Playwright staff member.') }
  return { id: created.user.id, session: data.session }
}

export async function createStagingFoundPetReport(options: { foundAt?: string, lifecycleStatus?: 'active' | 'resolved' | 'expired', lifecycleChangedAt?: string, withPhoto?: boolean, submittedBy?: Session } = {}): Promise<StagingFoundPetReport> {
  const details = `Playwright found-pet lifecycle ${crypto.randomUUID()}`
  const submissionToken = crypto.randomUUID()
  const submitter = options.submittedBy ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { authorization: `Bearer ${options.submittedBy.access_token}` } } }) : publicClient
  const { data: id, error } = await submitter.rpc('submit_found_pet_report', {
    found_species: 'dog', found_breed: 'Test breed', found_colour: 'Black and white', found_details: details,
    found_custody_status: 'with_reporter', latitude: 51.5074, longitude: -0.1278,
    found_time: options.foundAt ?? new Date().toISOString(), place_description: 'Playwright test location',
    custody_information: null, submission_token: submissionToken, follow_up_email: null,
  })
  if (error || !id) throw error ?? new Error('Could not create the Playwright found-pet report.')
  const lifecycleStatus = options.lifecycleStatus ?? 'active'
  const { error: updateError } = await admin.from('found_pet_reports').update({
    moderation_status: 'approved', moderated_at: new Date().toISOString(), lifecycle_status: lifecycleStatus,
    lifecycle_reason: lifecycleStatus === 'active' ? null : 'test', lifecycle_changed_at: options.lifecycleChangedAt ?? new Date().toISOString(),
  }).eq('id', id)
  if (updateError) { await admin.from('found_pet_reports').delete().eq('id', id); throw updateError }
  if (!options.withPhoto) return { id, details, sourceObjectPath: null, displayObjectPath: null }
  const sourceObjectPath = `source/${id}.jpg`
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ap//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z', 'base64')
  const bucket = submitter.storage.from('found-pet-photos')
  const { error: uploadError } = await bucket.upload(sourceObjectPath, jpeg, { contentType: 'image/jpeg' })
  if (uploadError) { await admin.from('found_pet_reports').delete().eq('id', id); throw uploadError }
  const { error: attachError } = await submitter.rpc('attach_found_pet_photo', { target_report_id: id, submission_token: submissionToken })
  if (attachError) { await bucket.remove([sourceObjectPath]); await admin.from('found_pet_reports').delete().eq('id', id); throw attachError }
  return { id, details, sourceObjectPath, displayObjectPath: null }
}

export async function foundPetReportExists(reportId: string) {
  const { data, error } = await admin.from('found_pet_reports').select('id').eq('id', reportId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function foundPetPhotoExists(path: string) {
  const slash = path.lastIndexOf('/')
  const { data, error } = await admin.storage.from('found-pet-photos').list(path.slice(0, slash), { search: path.slice(slash + 1) })
  if (error) throw error
  return data.some((file) => file.name === path.slice(slash + 1))
}

export async function foundPetAuditEvents(reportId: string, staffSession: Session) {
  const staffClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { authorization: `Bearer ${staffSession.access_token}` } } })
  const { data, error } = await staffClient.from('found_pet_report_moderation_audit').select('event').eq('found_pet_report_id', reportId)
  if (error) throw error
  return (data ?? []).map((entry) => entry.event)
}

export async function deleteStagingFoundPetReport(report: StagingFoundPetReport | undefined) {
  if (!report || !await foundPetReportExists(report.id)) return
  if (report.sourceObjectPath || report.displayObjectPath) await admin.storage.from('found-pet-photos').remove([report.sourceObjectPath, report.displayObjectPath].filter((path): path is string => Boolean(path)))
  await admin.from('found_pet_reports').delete().eq('id', report.id)
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
