import { createClient } from 'npm:@supabase/supabase-js@2'

type OutboxItem = { id: string, kind: 'owner_sighting_email' | 'watch_sighting_alert', aggregate_id: string, attempts: number }

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function invokeDelivery(url: string, serviceKey: string, item: OutboxItem) {
  const functionName = item.kind === 'owner_sighting_email' ? 'send-sighting-owner-email' : 'send-watch-notifications'
  const delivery = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': 'application/json', 'x-petseen-internal': serviceKey },
    body: JSON.stringify({ sightingId: item.aggregate_id }),
  })
  if (!delivery.ok) throw new Error((await delivery.text()).slice(0, 500) || `${functionName} returned ${delivery.status}`)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return response(500, { error: 'Workflow delivery is unavailable.' })

  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.rpc('claim_workflow_outbox', { target_limit: 20 })
  if (error) return response(500, { error: 'Could not claim notification work.' })

  let delivered = 0
  for (const item of (data ?? []) as OutboxItem[]) {
    try {
      await invokeDelivery(url, serviceKey, item)
      await admin.rpc('complete_workflow_outbox', { target_id: item.id, succeeded: true })
      delivered += 1
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Delivery failed.'
      console.error('Workflow outbox delivery failed', { outboxId: item.id, kind: item.kind, attempts: item.attempts, message })
      await admin.rpc('complete_workflow_outbox', { target_id: item.id, succeeded: false, failure_reason: message })
    }
  }
  return response(200, { claimed: (data ?? []).length, delivered })
})
