import {
  getSupabaseClient,
  unwrapSupabaseResult,
} from '../../lib/supabase-error'
export type FollowUpReport = {
  id: string
  species: 'dog' | 'cat'
  breed: string | null
  colour: string | null
  custody_status: 'with_reporter' | 'with_vet_or_rescue' | 'not_in_custody'
  found_at: string
  link: {
    status: 'pending_owner' | 'confirmed'
    case: { pet: { name: string } | null } | null
  } | null
}
export type FollowUpMessage = {
  id: string
  sender_id: string
  body: string
  created_at: string
}
export async function fetchReporterFollowUp(userId: string) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('claim_found_pet_reporter_access'),
    'We could not verify your reports.',
  )
  const data = await unwrapSupabaseResult(
    client
      .from('found_pet_reports')
      .select(
        'id,species,breed,colour,custody_status,found_at,link:found_pet_case_links(status,case:missing_cases(pet:pets(name)))',
      )
      .eq('reporter_id', userId)
      .order('found_at', { ascending: false }),
    'We could not load your reports.',
  )
  const reports = (data ?? []).map((report) => ({
    ...report,
    link: Array.isArray(report.link) ? (report.link[0] ?? null) : report.link,
  })) as unknown as FollowUpReport[]
  const ids = reports
    .filter((report) => report.link?.status === 'confirmed')
    .map((report) => report.id)
  if (!ids.length)
    return { reports, messages: {} as Record<string, FollowUpMessage[]> }
  const messages = await unwrapSupabaseResult(
    client
      .from('found_pet_messages')
      .select('id,sender_id,body,created_at,found_pet_report_id')
      .in('found_pet_report_id', ids)
      .order('created_at'),
    'We could not load messages.',
  )
  return {
    reports,
    messages: (messages ?? []).reduce<Record<string, FollowUpMessage[]>>(
      (all, message) => ({
        ...all,
        [message.found_pet_report_id]: [
          ...(all[message.found_pet_report_id] ?? []),
          message,
        ],
      }),
      {},
    ),
  }
}
export async function sendReporterMessage(input: {
  reportId: string
  body: string
}) {
  const client = getSupabaseClient()
  await unwrapSupabaseResult(
    client.rpc('send_found_pet_message', {
      target_report_id: input.reportId,
      message_body: input.body,
    }),
    'We could not send your message.',
  )
}
