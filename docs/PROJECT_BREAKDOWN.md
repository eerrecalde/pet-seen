# Pet Seen — Delivery Breakdown

**Product:** Pet Seen  
**Domain:** `petseen.org`  
**Initial market:** United Kingdom; select a focused local launch area before beta promotion.  
**Beta species:** dogs and cats.

## Guiding release

The first controlled beta must complete one trustworthy loop:

```text
Owner creates a missing-pet case
→ shares its public page
→ neighbour submits a location-first sighting without an account
→ owner sees the report and its exact location
→ owner marks the pet reunited or closes the case
```

Public views show approximate locations. Exact sighting and last-seen locations are restricted to the case owner and authorised administrators.

## Release 0 — Foundation

| ID | Task | Status |
| --- | --- | --- |
| PS-001 | Initialise repository, README and contribution conventions | Done |
| PS-002 | Scaffold Vite, React, TypeScript, React Router and Tailwind | Done |
| PS-003 | Establish visual tokens from the approved moodboard | Done |
| PS-004 | Add Supabase local development configuration | Done |
| PS-005 | Define beta safety, privacy, retention and moderation policies | Done |
| PS-006 | Produce mobile-first designs for home, missing case, public case and sighting | Done |
| PS-007 | Add i18next translation foundation: UK English resources, typed keys, locale-aware formatting and a documented path for future locales | Done |

## Release 1 — Missing-pet case alpha

| ID | Task | Status |
| --- | --- | --- |
| PS-101 | Configure magic-link authentication and lightweight profiles, with a local-only development bypass and designated owner/staff test accounts for testing protected paths. Signed-in users land on their dashboard, with account controls in the header. | In progress |
| PS-102 | Create PostGIS schema, migrations, Storage buckets and RLS policies, including exact and public-safe location fields | Done |
| PS-103 | Build pet details and photo-upload flow for dogs and cats | Done |
| PS-104 | Process uploads automatically: validate, strip EXIF and generate display images | Done |
| PS-105 | Build missing-case creation and location-picker flow with GPS, movable-pin confirmation and manual fallback; publish automatically after an owner confirms the required last-seen location | In progress |
| PS-106 | Generate non-sequential public URLs under `petseen.org/find/:slug` | Done |
| PS-107 | Build public case page with a server-provided 100 m-wide approximate location circle; never return exact coordinates publicly | Done |
| PS-108 | Build owner dashboard: edit, close, mark reunited and remove cases, with secondary local alerts kept in a collapsed panel below case management | Done |
| PS-109 | Add basic report-content action and protected moderation view | Done |
| PS-110 | Validate MapLibre with one hosted tile and geocoding provider using representative UK locations, production terms and cost controls | Done |

## Release 2 — Controlled beta: sightings

| ID | Task | Status |
| --- | --- | --- |
| PS-201 | Build a location-first anonymous sighting flow with GPS, movable-pin confirmation, manual fallback and a default time of now | Done |
| PS-202 | Support optional case selection; do not require matching | Done |
| PS-203 | Show linked sightings with exact authorised locations in the owner timeline and case map | Done |
| PS-204 | Send owner email notifications for linked sightings | Done |
| PS-205 | Add report states: pending, confirmed and dismissed | Done |
| PS-206 | Add reunion reason and self-reported Pet Seen attribution | Done |
| PS-207 | Add rate limits, failure/retry states and offline sighting drafts | Done |
| PS-208 | Test missing → sighting → reunion with Playwright | Done |

## Release 3 — Distribution

| ID | Task | Status |
| --- | --- | --- |
| PS-301 | A4 poster generator and QR code | Done |
| PS-302 | Web Share, copied-link and WhatsApp sharing; Open Graph image and metadata generation; sharing attribution | Done |
| PS-303 | Nearby discovery with a list-first default and an optional map showing visually distinct missing-case and approximate sighting pins | Done |

Follow-up: WhatsApp currently reads the generic app description because per-case Open Graph tags are set client-side. Revisit PS-302 when server-rendered or prerendered metadata is introduced, so previews can use the individual case description.

## Release 3.5 — Delivery safeguards

Complete this release before PS-401 so the refactor is protected by a deployed regression suite.

| ID | Task | Status |
| --- | --- | --- |
| PS-304 | Add GitHub Actions quality checks for pull requests and pushes to `main`: dependency install, typecheck, lint and production build | Done |
| PS-305 | Configure a Cloudflare Pages staging deployment and temporary staging domain from `main`, using a separate hosted Supabase staging environment | Done |
| PS-306 | Build a Playwright Page Object Model regression suite against staging for the core beta loop, including PS-208: missing case → public case → sighting → owner review/reunion | Done |
| PS-307 | Run the staging Playwright suite after each `main` deployment, retain failure reports/traces/screenshots, and notify through GitHub Actions email notifications | In progress |

## Release 4 — Scale and follow-up

| ID | Task | Status |
| --- | --- | --- |
| PS-401 | Refactor the React frontend into maintainable feature modules, reusable components, hooks and shared utilities once the core beta flows are stable; start only after Release 3.5 is complete | Done |
| PS-402 | Found-pet flow and custody status | Done |
| PS-403 | Deterministic report-to-case matching: rank private found-pet reports against active cases using species, distance, recency, breed and markings; create a provisional link only for a close, unambiguous match, then let the owner confirm or decline it using the private found-pet photo where present. A decline removes the active link and suppresses repeat matching for that pair | Done |
| PS-404 | Optional reporter magic-link follow-up and private messaging | Done |
| PS-405 | Watch areas, PWA push notifications and email fallback | Done |
| PS-406 | Expiry/reopen lifecycle and staff data housekeeping: provide a protected staff queue for pending and approved found-pet reports; let staff resolve, expire or delete test, duplicate, rejected and stale reports; safely remove associated source/display files while retaining only the minimal moderation audit trail; automatically expire unlinked reports and enforce the one-year retention policy, with a deliberate reopen path where appropriate | Done |
| PS-407 | Accessibility and security hardening for development and staging: keyboard skip navigation and route focus handling, reduced-motion and visible-focus support, and Cloudflare Pages browser security headers | Done |
| PS-408 | AI-assisted candidate scoring for unlinked sightings and found-pet reports: supplement the deterministic baseline with photo and description analysis; retain the score, confidence and explanation for staff review; automatically create a provisional owner-review link for the highest combined-score candidate of a safely approved found-pet report when its deterministic and combined scores are both at least 80 and AI confidence is medium or high; and let staff decide whether to link any listed candidate and notify its owner | In progress |
| PS-409 | Add a public list of confirmed, approximate sightings alongside the missing-pet list; make the two content types clearly distinct, never expose exact locations or reporter details, and link a sighting to its case only where that is safe and useful | Not started |
| PS-410 | Optional found-pet photo: accept a photo of the found pet only, validate and remove EXIF, and generate a private display derivative; never request or expose a reporter portrait | Done |
| PS-411 | Trust and safety moderation for found-pet reports: screen submitted text and photos server-side before they are shown to an owner; quarantine unsafe, abusive, scam or irrelevant content; fail closed to staff review when checks are uncertain; expose only approved private content, rate-limit abuse, and promptly delete rejected files while retaining minimal audit data | Done |
| PS-412 | Production monitoring and launch-environment hardening: configure privacy-safe error and operational monitoring with alert routing; add the final production origin to Supabase Auth, Edge Function CORS, MapTiler and notification-provider restrictions; configure HSTS after the hostname is final; and pass an authenticated production smoke test with alert delivery confirmed | Not started |
| PS-413 | Normalize breed and colour matching for missing cases and found-pet reports: preserve entered values for display, but compare canonical lowercased punctuation- and whitespace-free values; award a reduced score only for safe, specific partial breed matches; introduce searchable controlled suggestions with unknown, mixed and other options rather than exhaustive rigid breed dropdowns | Done |
| PS-414 | Normalise UI spacing across the implemented flow: use a shared compact component scale and section scale, and give dividers consistent surrounding space rather than page-specific margins. | Done |
| PS-415 | Retire the inactive duplicate React route bundle and its legacy-only component, navigation and locale helpers after confirming no active imports remain, leaving the feature-page route tree as the sole frontend implementation. | Done |
| PS-416 | Establish TanStack Query as the frontend server-state boundary: add the root Query Client, typed query-key conventions, Supabase error normalisation, and feature-level API/query/mutation modules that keep direct Supabase calls out of page components. | Done |
| PS-417 | Migrate public read models to TanStack Query: share a public-case query between public case and poster pages, and query the nearby discovery and sighting case-picker data with public-safe response types, caching and loading/error states. | Done |
| PS-418 | Migrate owner, reporter and staff read models and actions to TanStack Query: query dashboard, watch-area, reporter follow-up, moderation queue, candidate and signed-photo data; model Supabase operations as mutations; and invalidate the smallest relevant query keys after successful actions. | In progress |
| PS-419 | Move browser-orchestrated multi-write case, found-pet and sighting workflows behind transactional RPC or Edge Function boundaries, including reliable photo processing/cleanup and server-owned notification outbox/retry handling so a browser close or partial request cannot lose work. | Done |
| PS-420 | Model the missing-case, sighting and found-pet local workflows with feature-local reducers, including explicit form-stage, offline-draft, validation and submission transitions; preserve existing accessibility and offline-sighting behaviour with focused tests. | Done |
| PS-421 | Complete React lifecycle and feature-boundary hardening: extract dashboard and moderation domain components, stabilise MapLibre input/update lifecycles, isolate QR/signed-photo/geolocation async helpers, remove page-local translation fallbacks, and confirm Zustand remains unnecessary unless a future cross-route client-only state requirement emerges. | Done |

PS-405 maintenance note (2026-08-14): push registration waits until the service
worker is active before subscribing, avoiding the intermittent browser push-service
registration failure. The watch-area form now makes clear that it uses the
current location; its name field only labels the saved location.
Authenticated owners are granted access to their watch areas and push
subscriptions; their existing row-level policies limit that access to the
owner's own records.

PS-408 maintenance note (2026-08-14): moderator-triggered AI scoring sends the
current signed-in session explicitly as a bearer token, so the Edge Function
gateway can authenticate the request before it reaches the scoring handler.
Moderators can link any candidate in the conservative staff shortlist; AI
confidence is guidance rather than a server-enforced approval threshold.
The highest combined-score candidate for any safely approved found-pet report
creates a provisional owner-review link automatically when its deterministic and
combined scores are at least 80 and its AI confidence is medium or high. The
owner can confirm or decline that link.
Found-pet scoring now provides the processed found-pet image and each available
candidate case image to the model, so the AI score can compare the animals rather
than relying on report text alone.

## Decisions already made

- A missing case requires an authenticated creator, but users do not need to create an account to submit a sighting.
- Standalone sightings and found-pet reports are allowed. A close, unambiguous deterministic found-pet match may be provisionally linked for owner review; an owner can decline it, which removes the active link and prevents repeat matching for that pair. AI-assisted scoring is retained for staff review and may create a provisional owner-review link only under PS-408's conservative deterministic, combined-score and confidence rule.
- Anonymous sightings are immutable after submission. Case owners can dismiss reports from their dashboard.
- Photos need automated EXIF removal and public display derivatives.
- Default retention is one year, subject to a data-type-specific policy before public beta.
- Poster generation is part of the initial release, after the controlled-beta loop works.
- MapLibre is the initial map renderer; hosted tiles and geocoding remain configurable, while Supabase/PostGIS owns location data and spatial queries.
- GPS-assisted reports must allow pin correction and manual location entry. A denied or unavailable location permission must not block submission.
- Exact locations are generated and protected server-side. Public clients receive only persisted public-safe locations.
- The controlled beta keeps exact sighting locations on the owner map. Approximate public sighting pins are deferred to Release 3 discovery.
- Map work is delivered through the existing `PS-*` tasks; the map strategy does not maintain a separate implementation backlog.
- Cloudflare Pages is the selected Git-connected host for the temporary staging frontend. `main` deploys to staging until a separate production environment and domain are introduced.

## UI interaction flow map

The screen-to-screen interaction tracker lives in [UI interaction flow](UI_INTERACTION_FLOW.md).

> **Reminder:** whenever a task status changes in this breakdown, update the corresponding node and any affected connections in the UI interaction flow map in the same change.
