import { createClient } from '@supabase/supabase-js'

type Notification = {
  id: string
  status: 'pending' | 'sent' | 'failed'
  report: {
    found_at: string
    location_description: string | null
  } | null
  case: { pet: { name: string } | null } | null
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
    return response(500, { error: 'Owner email delivery is not configured.' })

  const { notificationId } = (await request
    .json()
    .catch(() => ({ notificationId: null }))) as {
    notificationId?: string | null
  }
  if (!notificationId)
    return response(400, { error: 'A match notification is required.' })

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: notification } = await admin
    .from('owner_found_pet_match_notifications')
    .select(
      'id,status,report:found_pet_reports(found_at,location_description),case:missing_cases(pet:pets(name))',
    )
    .eq('id', notificationId)
    .maybeSingle<Notification>()
  if (!notification)
    return response(204, { status: 'No owner notification is needed.' })
  if (notification.status === 'sent')
    return response(200, { status: 'already sent' })

  const { data: notificationRow } = await admin
    .from('owner_found_pet_match_notifications')
    .select('recipient_id')
    .eq('id', notification.id)
    .single()
  const { data: userData, error: userError } = notificationRow
    ? await admin.auth.admin.getUserById(notificationRow.recipient_id)
    : { data: { user: null }, error: new Error('Recipient missing') }
  const recipient = userData.user?.email
  if (userError || !recipient)
    return response(422, { error: 'The case owner has no email address.' })

  const petName = notification.case?.pet?.name ?? 'your pet'
  const foundAt = notification.report
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/London',
      }).format(new Date(notification.report.found_at))
    : 'recently'
  const location = notification.report?.location_description
    ? ` near ${notification.report.location_description}`
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
      subject: `Possible match reported for ${petName}`,
      html: `<h1>Possible match reported</h1><p>A pet that may match ${petName} was reported${location} on ${foundAt}.</p><p>Sign in to Pet Seen to review the private report and confirm or decline the match.</p>`,
    }),
  })
  if (!delivery.ok) {
    const lastError = (await delivery.text()).slice(0, 500)
    await admin
      .from('owner_found_pet_match_notifications')
      .update({ status: 'failed', last_error: lastError })
      .eq('id', notification.id)
    return response(502, { error: 'Could not send the possible-match email.' })
  }
  await admin
    .from('owner_found_pet_match_notifications')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', notification.id)
  return response(200, { status: 'sent' })
})
