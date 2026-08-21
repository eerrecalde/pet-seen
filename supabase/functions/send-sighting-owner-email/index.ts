import { createClient } from '@supabase/supabase-js'

type Notification = {
  id: string
  status: 'pending' | 'sent' | 'failed'
  sighting: {
    seen_at: string
    location_description: string | null
    details: string | null
    missing_case: { pet: { name: string } | null } | null
  } | null
}

function response(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('SIGHTING_EMAIL_FROM')
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail)
    return response(500, {
      error: 'Sighting email delivery is not configured.',
    })

  const { sightingId } = (await request
    .json()
    .catch(() => ({ sightingId: null }))) as { sightingId?: string | null }
  if (!sightingId) return response(400, { error: 'A sighting is required.' })

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: notification } = await admin
    .from('owner_email_notifications')
    .select(
      'id,status,sighting:sightings(seen_at,location_description,details,missing_case:missing_cases(pet:pets(name)))',
    )
    .eq('sighting_id', sightingId)
    .maybeSingle<Notification>()
  if (!notification)
    return response(204, { status: 'No owner notification is needed.' })
  if (notification.status === 'sent')
    return response(200, { status: 'already sent' })

  const { data: notificationRow } = await admin
    .from('owner_email_notifications')
    .select('recipient_id')
    .eq('id', notification.id)
    .single()
  const { data: userData, error: userError } = notificationRow
    ? await admin.auth.admin.getUserById(notificationRow.recipient_id)
    : { data: { user: null }, error: new Error('Recipient missing') }
  const recipient = userData.user?.email
  if (userError || !recipient)
    return response(422, { error: 'The case owner has no email address.' })

  const petName = notification.sighting?.missing_case?.pet?.name ?? 'a pet'
  const location =
    notification.sighting?.location_description || 'the private map location'
  const seenAt = notification.sighting
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/London',
      }).format(new Date(notification.sighting.seen_at))
    : 'recently'
  const details = notification.sighting?.details
    ? `<p>${notification.sighting.details.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]!)}</p>`
    : ''

  const delivery = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient],
      subject: `New sighting reported for ${petName}`,
      html: `<h1>New sighting reported</h1><p>Someone reported seeing ${petName} near ${location} on ${seenAt}.</p>${details}<p>Sign in to Pet Seen to view the exact location and review the report.</p>`,
    }),
  })
  if (!delivery.ok) {
    const lastError = (await delivery.text()).slice(0, 500)
    await admin
      .from('owner_email_notifications')
      .update({ status: 'failed', last_error: lastError })
      .eq('id', notification.id)
    return response(502, { error: 'Could not send the sighting email.' })
  }
  await admin
    .from('owner_email_notifications')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', notification.id)
  return response(200, { status: 'sent' })
})
