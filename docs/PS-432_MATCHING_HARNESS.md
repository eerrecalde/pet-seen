# PS-432 matching decision harness

`npm run test:matching-harness` is the required offline gate. It replays the versioned synthetic scenarios in `scripts/matching-harness-scenarios.v1.json`, uses only fixture adapters, prints a redacted results table, and writes `tmp/matching-harness-results.json`.

Pass `-- --scenario=<id>` to run one named scenario. Live diagnostic runs also accept `--max-runs=<n>` (default: 10), which caps planned provider calls before execution.

The scenarios contain no precise locations, contact details, storage paths, user data, or provider credentials. A decision is only a recommendation: this harness asserts that every result has no link or notification side effect.

The runner rejects fixtures containing exact-location, address, contact, or storage-path fields before an adapter can receive them.

## Adding or refreshing a scenario

Add a public-safe scenario to the versioned JSON file. Give each candidate a stable synthetic `caseId`, its eligibility result, photo availability, fixture Jev result, optional fixture vision result, and expected route/call counts. Run the offline command and commit the scenario only after its expected result has been reviewed.

Malformed and failed fixture responses must always route to `staff_review`; they must never create a link or notification.

When multiple comparisons are positive, assert the one deterministic review recommendation as `recommendedCaseId`. This is still decision support only: the harness must continue to report no automatic link or notification.

## Live evaluation

The separately named `test:matching-harness:jev`, `test:matching-harness:openai`, and `test:matching-harness:live` commands are intentionally paid-run opt-ins. The adapter implementation is deferred until PS-430 supplies the pinned Jev client and PS-431 supplies the pinned OpenAI vision client. Until then they stop before any provider call and say so plainly; they must not be considered a provider evaluation. They retain the explicit `MATCHING_PAID_RUN=1` guard so CI cannot accidentally incur provider usage.

When those adapters land, the commands must require a pinned model/rubric, accept scenario and provider filters, print preflight call/image counts, enforce a maximum-run cap, and report ranges for live probabilities and scores. They must never run in CI.
