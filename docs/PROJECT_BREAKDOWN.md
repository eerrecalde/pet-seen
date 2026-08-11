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
→ neighbour submits a sighting without an account
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
| PS-006 | Produce mobile-first designs for home, missing case, public case and sighting | Not started |

## Release 1 — Missing-pet case alpha

| ID | Task | Status |
| --- | --- | --- |
| PS-101 | Configure magic-link authentication and lightweight profiles | Not started |
| PS-102 | Create PostGIS schema, migrations, Storage buckets and RLS policies | Not started |
| PS-103 | Build pet details and photo-upload flow for dogs and cats | Not started |
| PS-104 | Process uploads automatically: validate, strip EXIF and generate display images | Not started |
| PS-105 | Build missing-case draft, location and publication flow | Not started |
| PS-106 | Generate non-sequential public URLs under `petseen.org/find/:slug` | Not started |
| PS-107 | Build public case page with approximate location | Not started |
| PS-108 | Build owner dashboard: edit, close and mark reunited | Not started |
| PS-109 | Add basic report-content action and protected moderation view | Not started |

## Release 2 — Controlled beta: sightings

| ID | Task | Status |
| --- | --- | --- |
| PS-201 | Build anonymous, standalone sighting flow | Not started |
| PS-202 | Support optional case selection; do not require matching | Not started |
| PS-203 | Show linked sightings in owner timeline and map | Not started |
| PS-204 | Send owner email notifications for linked sightings | Not started |
| PS-205 | Add report states: pending, confirmed and dismissed | Not started |
| PS-206 | Add reunion reason and self-reported Pet Seen attribution | Not started |
| PS-207 | Add rate limits, failure/retry states and offline sighting drafts | Not started |
| PS-208 | Test missing → sighting → reunion with Playwright | Not started |

## Release 3 — Distribution

- A4 poster generator and QR code
- Web Share, copied-link and WhatsApp sharing
- Open Graph image and metadata generation
- Sharing attribution
- Nearby cases and sightings discovery

## Later releases

- Found-pet flow and custody status
- Deterministic report-to-case matching
- Optional reporter magic-link follow-up and private messaging
- Watch areas, PWA push notifications and email fallback
- Expiry/reopen lifecycle
- Production monitoring, accessibility and security hardening

## Decisions already made

- A missing case requires an authenticated creator, but users do not need to create an account to submit a sighting.
- Standalone sightings are allowed; automatic candidate matching is deferred.
- Anonymous sightings are immutable after submission. Case owners can dismiss reports from their dashboard.
- Photos need automated EXIF removal and public display derivatives.
- Default retention is one year, subject to a data-type-specific policy before public beta.
- Poster generation is part of the initial release, after the controlled-beta loop works.
