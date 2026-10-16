# PS-430 Jev shadow-mode release checklist

Jev must remain disabled for production reports until every item in this checklist has evidence attached to the release record. The text-only adapter is intentionally present before enablement so it can be exercised only with synthetic harness data.

## Required before production data

- [ ] UK privacy review confirms the purpose, data categories, lawful basis, retention period, deletion process and data-subject request path.
- [ ] Vendor review records TypeSafe's current subprocessors, processing locations and international-transfer safeguards.
- [ ] Procurement approves the applicable data-processing terms and confirms that provider training or secondary use is disabled for this integration.
- [ ] A pinned provider model and the `found-pet-text-v1` rubric have been approved for the release.
- [ ] The Jev shadow queue is enabled separately from image scoring, so Jev failures and retries cannot alter image calls, ranking, links or notifications.
- [ ] The labelled, reviewed shadow set reports precision, recall, calibration and proposed high-recall vision-gating thresholds. No threshold enables a Jev decision without explicit approval.

## Implementation guardrails

- The provider receives only species, breed, colour/markings, redacted report text, and derived distance and elapsed-time values.
- Exact coordinates, contact details, report/case identifiers, storage paths and image bytes must never cross the provider boundary.
- Store only the rubric result, calibrated probabilities, confidence, model/rubric/policy/pipeline versions, usage, latency, cost and outcome. Do not persist the provider request body.
- A provider error must create a staff-review outcome. Rate-limit responses use the durable queue's bounded backoff rather than an in-request retry loop.
