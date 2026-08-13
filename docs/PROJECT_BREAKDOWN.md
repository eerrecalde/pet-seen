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
| PS-101 | Configure magic-link authentication and lightweight profiles | In progress |
| PS-102 | Create PostGIS schema, migrations, Storage buckets and RLS policies, including exact and public-safe location fields | Done |
| PS-103 | Build pet details and photo-upload flow for dogs and cats | Done |
| PS-104 | Process uploads automatically: validate, strip EXIF and generate display images | Done |
| PS-105 | Build missing-case draft, publication and location-picker flow with GPS, movable-pin confirmation and manual fallback | In progress |
| PS-106 | Generate non-sequential public URLs under `petseen.org/find/:slug` | Done |
| PS-107 | Build public case page with a server-provided approximate location map; never return exact coordinates publicly | Done |
| PS-108 | Build owner dashboard: edit, close and mark reunited | Done |
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
| PS-208 | Test missing → sighting → reunion with Playwright | Not started |

## Release 3 — Distribution

| ID | Task | Status |
| --- | --- | --- |
| PS-301 | A4 poster generator and QR code | Done |
| PS-302 | Web Share, copied-link and WhatsApp sharing; Open Graph image and metadata generation; sharing attribution | Done |
| PS-303 | Nearby discovery with a list-first default and an optional map showing visually distinct missing-case and approximate sighting pins | Done |

## Release 3.5 — Delivery safeguards

Complete this release before PS-401 so the refactor is protected by a deployed regression suite.

| ID | Task | Status |
| --- | --- | --- |
| PS-304 | Add GitHub Actions quality checks for pull requests and pushes to `main`: dependency install, typecheck, lint and production build | Done |
| PS-305 | Configure a Cloudflare Pages staging deployment and temporary staging domain from `main`, using a separate hosted Supabase staging environment | Done |
| PS-306 | Build a Playwright Page Object Model regression suite against staging for the core beta loop, including PS-208: missing case → public case → sighting → owner review/reunion | Not started |
| PS-307 | Run the staging Playwright suite after each `main` deployment, retain failure reports/traces/screenshots, and notify through GitHub Actions email notifications | Not started |

## Release 4 — Scale and follow-up

| ID | Task | Status |
| --- | --- | --- |
| PS-401 | Refactor the React frontend into maintainable feature modules, reusable components, hooks and shared utilities once the core beta flows are stable; start only after Release 3.5 is complete | Not started |
| PS-402 | Found-pet flow and custody status | Not started |
| PS-403 | Deterministic report-to-case matching | Not started |
| PS-404 | Optional reporter magic-link follow-up and private messaging | Not started |
| PS-405 | Watch areas, PWA push notifications and email fallback | Not started |
| PS-406 | Expiry/reopen lifecycle | Not started |
| PS-407 | Production monitoring, accessibility and security hardening | Not started |

## Decisions already made

- A missing case requires an authenticated creator, but users do not need to create an account to submit a sighting.
- Standalone sightings are allowed; automatic candidate matching is deferred.
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
