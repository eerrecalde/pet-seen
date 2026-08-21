import {
  getSupabaseClient,
  unwrapSupabaseResult,
} from '../../lib/supabase-error'

/** Staff-only transport boundary. Pages never access Supabase directly. */
export const moderationApi = {
  isAuthorized: async () =>
    unwrapSupabaseResult(
      getSupabaseClient().rpc('is_authorized_staff'),
      'We could not verify staff access.',
    ),
  load: async () => {
    const client = getSupabaseClient()
    const [content, found, sightings] = await Promise.all([
      unwrapSupabaseResult(
        client
          .from('content_reports')
          .select(
            'id,reason,details,status,created_at,case:missing_cases(public_slug,title,pet:pets(name))',
          )
          .order('created_at', { ascending: false }),
        'We could not load content reports.',
      ),
      unwrapSupabaseResult(
        client
          .from('found_pet_reports')
          .select(
            'id,species,breed,colour,details,custody_status,location_description,found_at,created_at,moderation_status,lifecycle_status,lifecycle_reason,automated_screening_note,photo:found_pet_photos(source_object_path,display_object_path),link:found_pet_case_links(case_id,status,case:missing_cases(public_slug,pet:pets(name))),ai_scores:ai_found_pet_match_scores(case_id,deterministic_score,ai_similarity_score,combined_score,confidence,explanation,priority_review,created_at)',
          )
          .order('created_at', { ascending: false }),
        'We could not load found-pet reports.',
      ),
      unwrapSupabaseResult(
        client
          .from('sightings')
          .select(
            'id,seen_at,location_description,details,ai_scores:ai_unlinked_sighting_match_scores(case_id,deterministic_score,ai_similarity_score,combined_score,confidence,explanation,priority_review,created_at)',
          )
          .is('case_id', null)
          .order('created_at', { ascending: false }),
        'We could not load sightings.',
      ),
    ])
    return { content, found, sightings }
  },
  updateContentStatus: async (id: string, status: string) =>
    unwrapSupabaseResult(
      getSupabaseClient()
        .from('content_reports')
        .update({ status })
        .eq('id', id),
      'We could not update this report.',
    ),
  housekeeping: async () =>
    unwrapSupabaseResult(
      getSupabaseClient().functions.invoke('housekeep-found-pet-reports'),
      'We could not run housekeeping.',
    ),
  sightingCandidates: async (id: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().rpc('unlinked_sighting_case_candidates', {
        target_sighting_id: id,
      }),
      'We could not find candidates.',
    ),
  foundCandidates: async (id: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().rpc('found_pet_case_candidates', {
        target_report_id: id,
      }),
      'We could not find candidates.',
    ),
  linkSighting: async (sightingId: string, caseId: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().rpc('link_unlinked_sighting_to_case', {
        target_sighting_id: sightingId,
        target_case_id: caseId,
      }),
      'We could not link this sighting.',
    ),
  linkFound: async (reportId: string, caseId: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().rpc('link_found_pet_report_to_case', {
        target_report_id: reportId,
        target_case_id: caseId,
      }),
      'We could not link this report.',
    ),
  scoreSighting: async (sightingId: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().functions.invoke(
        'score-unlinked-sighting-candidates',
        { body: { sightingId } },
      ),
      'We could not analyse this sighting.',
    ),
  scoreFound: async (reportId: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().functions.invoke('score-found-pet-candidates', {
        body: { reportId },
      }),
      'We could not analyse this report.',
    ),
  reviewFound: async (reportId: string, decision: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().functions.invoke('moderate-found-pet-report', {
        body: { reportId, decision },
      }),
      'We could not review this report.',
    ),
  manageFound: async (reportId: string, action: string, reason: string) =>
    unwrapSupabaseResult(
      getSupabaseClient().functions.invoke('manage-found-pet-report', {
        body: { reportId, action, reason },
      }),
      'We could not manage this report.',
    ),
  signedPhoto: async (path: string) => {
    const data = await unwrapSupabaseResult(
      getSupabaseClient()
        .storage.from('found-pet-photos')
        .createSignedUrl(path, 60),
      'We could not load this photo.',
    )
    return data?.signedUrl ?? null
  },
}
