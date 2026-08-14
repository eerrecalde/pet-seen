import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

type PendingNotification = { id: string, recipient_id: string, watch_area: { label: string } | { label: string }[] | null }
type Subscription = { endpoint: string, p256dh: string, auth: string }

function response(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('SIGHTING_EMAIL_FROM')
  if (!supabaseUrl || !serviceRoleKey) return response(500, { error: 'Watch alerts are not configured.' })

  const { sightingId } = await request.json().catch(() => ({ sightingId: null })) as { sightingId?: string | null }
  if (!sightingId) return response(400, { error: 'A sighting is required.' })
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin.from('watch_notifications').select('id,recipient_id,watch_area:watch_areas(label)').eq('sighting_id', sightingId).eq('status', 'pending')
  if (error) return response(500, { error: 'Could not load watch alerts.' })
  const pending = (data ?? []) as PendingNotification[]
  if (!pending.length) return response(200, { status: 'No watch alerts are waiting.' })

  if (vapidPublicKey && vapidPrivateKey && vapidSubject) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const groups = new Map<string, PendingNotification[]>()
  for (const notification of pending) groups.set(notification.recipient_id, [...(groups.get(notification.recipient_id) ?? []), notification])
  for (const [recipientId, alerts] of groups) {
    const watchNames = [...new Set(alerts.map((alert) => {
      const area = alert.watch_area
      return Array.isArray(area) ? area[0]?.label : area?.label
    }).filter(Boolean))]
    const areaText = watchNames.length === 1 ? `near ${watchNames[0]}` : 'near areas you watch'
    let pushSent = false
    let lastError = ''
    const { data: subscriptions } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('owner_id', recipientId)
    if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
      for (const subscription of (subscriptions ?? []) as Subscription[]) {
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: 'Pet Seen alert', body: `A pet sighting was reported ${areaText}.`, url: '/dashboard' }))
          pushSent = true
        } catch (deliveryError) {
          lastError = deliveryError instanceof Error ? deliveryError.message.slice(0, 500) : 'Push delivery failed.'
          if (/410|404/.test(lastError)) await admin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
      }
    }
    if (pushSent) {
      await admin.from('watch_notifications').update({ status: 'push_sent', delivered_at: new Date().toISOString(), last_error: null }).in('id', alerts.map((alert) => alert.id))
      continue
    }
    const { data: userData } = await admin.auth.admin.getUserById(recipientId)
    const recipient = userData.user?.email
    if (resendApiKey && fromEmail && recipient) {
      const email = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${resendApiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: fromEmail, to: [recipient], subject: 'Pet Seen alert near your watch area', html: `<h1>Pet Seen alert</h1><p>A pet sighting was reported ${areaText}.</p><p>Sign in to Pet Seen for the latest information. Exact sighting locations are never included in watch alerts.</p>` }) })
      if (email.ok) { await admin.from('watch_notifications').update({ status: 'email_sent', delivered_at: new Date().toISOString(), last_error: null }).in('id', alerts.map((alert) => alert.id)); continue }
      lastError = (await email.text()).slice(0, 500)
    }
    await admin.from('watch_notifications').update({ status: 'failed', last_error: lastError || 'No usable push subscription or email delivery configuration.' }).in('id', alerts.map((alert) => alert.id))
  }
  return response(200, { status: 'processed' })
})
