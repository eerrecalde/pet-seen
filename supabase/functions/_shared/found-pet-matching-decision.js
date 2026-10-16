/**
 * Provider-independent matching policy used by the staged pipeline and its
 * verification harness. It deliberately returns recommendations only: callers
 * own persistence, linking, and notifications.
 */
export async function decideFoundPetMatches({ report, candidates, adapters }) {
  const decisions = []
  const calls = { jev: 0, openai: 0 }

  for (const candidate of candidates) {
    if (!candidate.eligible) {
      decisions.push({
        caseId: candidate.caseId,
        route: 'ineligible',
        providers: [],
        effects: { link: false, notify: false },
      })
      continue
    }

    let text
    try {
      calls.jev += 1
      text = await adapters.jev.assess({ report, candidate })
    } catch (error) {
      decisions.push({
        caseId: candidate.caseId,
        route: 'staff_review',
        providers: ['jev'],
        effects: { link: false, notify: false },
        error:
          error instanceof Error ? error.message : 'Jev assessment failed.',
      })
      continue
    }

    const providers = ['jev']
    if (!['incompatible', 'possible', 'uncertain'].includes(text?.route)) {
      decisions.push({
        caseId: candidate.caseId,
        route: 'staff_review',
        providers,
        effects: { link: false, notify: false },
        error: 'Jev returned an invalid assessment.',
      })
      continue
    }
    if (text.route === 'incompatible') {
      decisions.push({
        caseId: candidate.caseId,
        route: 'stopped_incompatible',
        providers,
        text,
        effects: { link: false, notify: false },
      })
      continue
    }

    if (!report.hasPhoto || !candidate.hasPhoto) {
      decisions.push({
        caseId: candidate.caseId,
        route: 'staff_review',
        providers,
        text,
        effects: { link: false, notify: false },
      })
      continue
    }

    try {
      calls.openai += 1
      const vision = await adapters.openai.compare({ report, candidate, text })
      providers.push('openai')
      if (!['positive', 'negative'].includes(vision?.route)) {
        decisions.push({
          caseId: candidate.caseId,
          route: 'staff_review',
          providers,
          text,
          effects: { link: false, notify: false },
          error: 'OpenAI returned an invalid comparison.',
        })
        continue
      }
      decisions.push({
        caseId: candidate.caseId,
        route: vision.route === 'positive' ? 'review_recommended' : 'no_match',
        providers,
        text,
        vision,
        effects: { link: false, notify: false },
      })
    } catch (error) {
      decisions.push({
        caseId: candidate.caseId,
        route: 'staff_review',
        providers: [...providers, 'openai'],
        text,
        effects: { link: false, notify: false },
        error:
          error instanceof Error ? error.message : 'OpenAI comparison failed.',
      })
    }
  }

  const recommendation = decisions
    .filter((decision) => decision.route === 'review_recommended')
    .sort(
      (left, right) =>
        right.vision.similarity - left.vision.similarity ||
        left.caseId.localeCompare(right.caseId),
    )[0]

  return {
    decisions,
    calls,
    recommendation: recommendation
      ? {
          caseId: recommendation.caseId,
          route: 'review_recommended',
          effects: { link: false, notify: false },
        }
      : null,
  }
}
