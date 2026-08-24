import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const quietMinutes = 30
const emailQuietMinutes = 60
const maxPushSubscriptions = 3

type PendingNotification = {
  id: string
  recipient_id: string
  watch_area: { label: string } | { label: string }[] | null
}
type Subscription = { endpoint: string; p256dh: string; auth: string }

function response(status: number, body: Record<string, string>, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function areaLabel(alert: PendingNotification) {
  const area = alert.watch_area
  return Array.isArray(area) ? area[0]?.label : area?.label
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('SIGHTING_EMAIL_FROM')
  if (!supabaseUrl || !serviceRoleKey)
    return response(500, { error: 'Watch alerts are not configured.' })

  const { sightingId } = (await request.json().catch(() => ({}))) as {
    sightingId?: string
  }
  if (!sightingId) return response(400, { error: 'A sighting is required.' })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin
    .from('watch_notifications')
    .select('id,recipient_id,watch_area:watch_areas(label)')
    .eq('sighting_id', sightingId)
    .in('status', ['pending', 'failed'])
  if (error) return response(500, { error: 'Could not load watch alerts.' })
  const pending = (data ?? []) as PendingNotification[]
  if (!pending.length)
    return response(200, { status: 'No watch alerts are waiting.' })

  if (vapidPublicKey && vapidPrivateKey && vapidSubject)
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  let minimumDelay: number | null = null
  let providerFailure = false
  for (const alert of pending) {
    const now = Date.now()
    const { data: recent } = await admin
      .from('watch_notifications')
      .select('delivered_at,status')
      .eq('recipient_id', alert.recipient_id)
      .in('status', ['push_sent', 'email_sent'])
      .order('delivered_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastDelivery = recent?.delivered_at
      ? new Date(recent.delivered_at).getTime()
      : 0
    const remainingQuiet = quietMinutes * 60_000 - (now - lastDelivery)
    if (remainingQuiet > 0) {
      minimumDelay = Math.max(
        minimumDelay ?? 0,
        Math.ceil(remainingQuiet / 60_000),
      )
      continue
    }

    const label = areaLabel(alert)
    const areaText = label ? `near ${label}` : 'near an area you watch'
    let pushSent = false
    let lastError = ''
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('owner_id', alert.recipient_id)
      .order('created_at', { ascending: false })
      .limit(maxPushSubscriptions)
    if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
      for (const subscription of (subscriptions ?? []) as Subscription[]) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              title: 'Pet Seen alert',
              body: `A pet sighting was reported ${areaText}.`,
              url: '/dashboard',
            }),
          )
          pushSent = true
        } catch (cause) {
          lastError =
            cause instanceof Error
              ? cause.message.slice(0, 500)
              : 'Push delivery failed.'
          if (/410|404/.test(lastError))
            await admin
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint)
        }
      }
    }
    if (pushSent) {
      await admin
        .from('watch_notifications')
        .update({
          status: 'push_sent',
          delivered_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', alert.id)
      continue
    }

    const { data: lastEmail } = await admin
      .from('watch_notifications')
      .select('delivered_at')
      .eq('recipient_id', alert.recipient_id)
      .eq('status', 'email_sent')
      .order('delivered_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const emailAge = lastEmail?.delivered_at
      ? now - new Date(lastEmail.delivered_at).getTime()
      : Infinity
    if (emailAge < emailQuietMinutes * 60_000) {
      minimumDelay = Math.max(
        minimumDelay ?? 0,
        Math.ceil((emailQuietMinutes * 60_000 - emailAge) / 60_000),
      )
      continue
    }
    const { data: userData } = await admin.auth.admin.getUserById(
      alert.recipient_id,
    )
    const recipient = userData.user?.email
    if (resendApiKey && fromEmail && recipient) {
      const email = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject: 'Pet Seen alert near your watch area',
          html: `<h1>Pet Seen alert</h1><p>A pet sighting was reported ${areaText}.</p><p>Sign in to Pet Seen for the latest information. Exact sighting locations are never included in watch alerts.</p>`,
        }),
      })
      if (email.ok) {
        await admin
          .from('watch_notifications')
          .update({
            status: 'email_sent',
            delivered_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', alert.id)
        continue
      }
      lastError = (await email.text()).slice(0, 500)
    }
    providerFailure = true
    await admin
      .from('watch_notifications')
      .update({
        status: 'failed',
        last_error:
          lastError ||
          'No usable push subscription or email delivery configuration.',
      })
      .eq('id', alert.id)
  }
  if (minimumDelay)
    return response(
      202,
      { status: 'Watch-alert quiet period.' },
      { 'retry-after': String(minimumDelay) },
    )
  if (providerFailure)
    return response(502, { error: 'Could not deliver every watch alert.' })
  return response(200, { status: 'processed' })
})
