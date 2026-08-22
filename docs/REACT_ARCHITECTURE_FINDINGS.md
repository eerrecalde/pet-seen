# React architecture findings

**Scope:** planning review of the active frontend as of 2026-08-20. This is a
recommendation document only; it makes no product or application-code changes.

## Executive summary

The application has made a useful first move towards feature pages: `App.tsx`
routes to individually named page modules and the photo selection and public
case lookup have already been extracted into hooks. The next improvement should
be to make **TanStack Query the owner of server state** and to keep components
focused on rendering and ephemeral interaction state.

There is not currently a sound need for Zustand. Almost all non-form state is
either server state, which belongs in TanStack Query, or state used by one page
or one component. The existing auth context is an appropriate, small global
boundary. Adding a global store now would duplicate cached data and make data
ownership less clear.

The highest-value work is:

1. Delete the unused legacy route bundle and its legacy-only dependencies.
2. Introduce feature APIs, typed query keys, queries and mutations around the
   Supabase client.
3. Move multi-step form transitions into reducers, while putting network state
   in mutation state.
4. Move multi-write, security-sensitive workflows from browser orchestration
   to an RPC or Edge Function with server-side transaction/outbox semantics.

## Findings, in priority order

### P0 — remove the inactive duplicate implementation

`src/pages/routes.tsx` is a 473-line legacy bundle that is not imported by the
application. It duplicates active pages, queries, components and types:
`HomePage`, `MissingCasePage`, `PublicCasePage`, `PosterPage`, dashboard,
moderation, sighting and auth are all represented there and in the active
feature pages.

The legacy bundle also appears to be the only consumer of `src/components/ui.tsx`,
`src/components/layout.tsx`, `src/components/index.ts`, `src/shared/navigation.tsx`,
`src/shared/paths.ts` and `src/shared/LocaleLayout.tsx`. The active app instead
uses `SiteChrome`, `Icon`, `lib/routing` and `app/LocaleLayout`.

**Recommendation:** remove this inactive branch after one import/reference
check, then remove the modules that become unused. Do this before refactoring
data access so future work has one source of truth. Keep `src/pages/routes.tsx`
only if it is deliberately retained as an independently tested migration
reference; it should not remain silently compilable production code.

### P0 — browser components orchestrate important multi-write workflows

Several pages own business transactions that span database rows, Storage and
Edge Functions. React should initiate a business action, not implement its
rollback protocol:

| Active location                          | Current browser-owned workflow                                                                                                                      | Recommended boundary                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/missing-case/MissingCasePage.tsx` | Create pet, optionally upload photo, create photo row, process photo, create case; then manually delete rows/files on failures or page exit.        | A `create_missing_case` RPC/Edge Function that validates ownership, creates the database records atomically and returns upload work/URLs. Put storage cleanup and processing retries on the server. |
| `pages/dashboard/OwnerDashboardPage.tsx` | Update pet, then update case as two independent writes. A second failure leaves a partial save.                                                     | One transactional RPC such as `update_owner_case`.                                                                                                                                                  |
| `pages/found/FoundPetPage.tsx`           | Submit report, upload and attach/process photo, screen report, then send a magic link. Each later failure produces a partially completed flow.      | One server workflow plus resumable photo processing/screening jobs. Return a stable report status to the UI.                                                                                        |
| `pages/sighting/SightingPage.tsx`        | Submit sighting, then fire-and-forget owner-email and watch-notification calls. Closing the tab or a function error can lose notification delivery. | Submit server-side and write notification work to an outbox; a worker/function sends and retries independently.                                                                                     |

TanStack Query mutations should call these coarse-grained operations. They are
not a substitute for server-side atomicity: `onError` rollback from the browser
cannot reliably recover a tab close, network loss or a partially completed
request.

### P1 — server state is hand-managed in components

The active code contains direct Supabase reads in pages and a custom fetch hook.
Each owns arrays, `loading`/`ready`/`error` strings, cancellation flags and
manual reloading. This prevents shared caching, creates stale copies, and makes
invalidation after mutations a page-by-page concern.

| Area                         | Current location                                                 | Query recommendation                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public case                  | `hooks/usePublicCase.ts`; consumed by the public page and poster | `usePublicCaseQuery(slug)` with `['publicCase', slug]`; share its cache between routes and remove the bespoke state machine.                                                     |
| Nearby home content          | `pages/home/HomePage.tsx`                                        | `useNearbyDiscoveryQuery()` with a single public-safe response shape and a short `staleTime`.                                                                                    |
| Sighting case picker         | `pages/sighting/SightingPage.tsx`                                | `usePublicCaseOptionsQuery()`; enable only when the picker opens if the initial load is not otherwise useful.                                                                    |
| Owner dashboard              | `pages/dashboard/OwnerDashboardPage.tsx`                         | Split the data loader into `useOwnerDashboardQuery(userId)` or composable case/sighting/match queries. Invalidate its keys after case, sighting, match and watch-area mutations. |
| Watch areas                  | `OwnerDashboardPage.tsx` (`WatchAreas`)                          | `useWatchAreasQuery(userId)` plus create/delete/push-subscription mutations.                                                                                                     |
| Reporter follow-up           | `pages/found/FoundPetFollowUpPage.tsx`                           | A reporter-access mutation followed by `useReporterFollowUpQuery(userId)`. Return reports and confirmed-message threads in one purpose-built server response if practical.       |
| Moderation access and queues | `pages/moderation/ModerationPage.tsx`                            | `useStaffAccessQuery(userId)` and query keys per queue. Candidate lookup should be a cached, parameterised query keyed by report/sighting ID.                                    |
| Private signed images        | dashboard and moderation effects                                 | `useSignedStorageUrlQuery(bucket, path, ttl)` with a cache lifetime shorter than the signed URL lifetime.                                                                        |

Use query functions in feature-level API modules rather than placing Supabase
calls inside JSX pages. For example:

```text
src/features/public-cases/
  api.ts       # Supabase selects/RPCs and response normalisation
  queries.ts   # queryOptions and use…Query hooks
  mutations.ts # use…Mutation hooks
  types.ts
```

The query cache must contain only server data. Do not copy query results into
`useState` unless a component is intentionally editing a separate draft.

### P1 — mutations repeatedly use manual reload and ad-hoc pending state

The dashboard, follow-up page and moderation page set IDs such as `savingId`,
`sendingId`, `loadingId`, `linkingId`, `analysingId` and `reviewingId`, then call
page-local `load` functions to synchronise. This pattern appears in:

- owner case edits/status/removal, sighting review and found-match review;
- watch-area create/remove and push registration;
- reporter messages;
- content-report status, housekeeping, candidate lookup/linking/AI scoring and
  lifecycle moderation.

**Recommendation:** define a mutation per business operation. Let mutation
variables identify the affected entity for disabled buttons; use `isPending` or
`useMutationState` where an individual row needs a pending indicator. On
success, invalidate the smallest relevant query keys rather than calling a
component-owned `load()` function. Surface mutation errors locally next to the
action, with a shared error normaliser for Supabase failures.

This removes duplicated request-state code without turning transient dialog or
form state into global state.

### P1 — multi-step local workflows need reducers

Use a reducer when several fields and modes must always change together. It
makes impossible states harder to represent and moves transition rules out of
event handlers. Do **not** put the server data from these flows into a reducer;
TanStack Query mutations own the request lifecycle.

| Flow                  | Current dependent local state                                                                                   | Reducer shape                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing-case creation | `stage`, `species`, `draft`, location fields, error and the `discardOnExit` ref.                                | `details → location → submitting → published/failed`; actions such as `PET_SAVED`, `LOCATION_CHANGED`, `PUBLISH_SUCCEEDED`, `DISCARD_FAILED`. The draft ID is one workflow object.                |
| Sighting submission   | selected case, picker visibility, location, offline/online, restored draft, submission token, status and error. | A `SightingFormState` plus explicit `DRAFT_RESTORED`, `CASE_SELECTED`, `CONNECTION_CHANGED`, `SUBMISSION_FAILED` and `SUBMITTED` actions. Keep persistence in a small `useSightingDraft` adapter. |
| Found-pet submission  | species, custody, conditional custody information, follow-up email, location, photo and submission status.      | A `FoundPetFormState` with `CUSTODY_CHANGED` clearing/retaining conditional fields deliberately, and `SUBMIT_*` actions.                                                                          |
| Per-case dashboard UI | edit, remove and reunion panels plus reunion reason/attribution.                                                | A small `OwnerCaseCard` reducer or a discriminated `openPanel` state so a card cannot have contradictory modal states.                                                                            |

The dashboard's `ConfirmedConversations` currently stores one `body` value for
all confirmed matches. Every textarea therefore shares the same draft. Store
the draft by report ID, or make each conversation its own component/reducer.

### P1 — raw data shapes and response normalisation are scattered

Page components define Supabase response types and repeatedly repair relation
shapes with `Array.isArray(...)` plus casts such as `as unknown as`. This occurs
in the dashboard, follow-up and moderation loaders. The data contract is then
coupled to the rendering code and is easy to break when a select changes.

**Recommendation:** place select strings, database-facing types and relation
normalisers in feature `api.ts`/`types.ts`. Expose a view model that has already
normalised one-to-one relations. Prefer generated Supabase database types when
available; otherwise add small runtime-safe normalisers at this boundary. Do
not spread `as unknown as` through components.

### P2 — a few effects are doing the right work but should be isolated or made stable

Not every `useEffect` is a data-fetching smell. MapLibre setup, metadata,
auth-session subscription and route focus management are imperative browser
integrations and should remain effects. Their component ownership can still be
clearer:

- `NearbyDiscoveryMap` and `OwnerSightingMap` receive freshly created arrays on
  every parent render. Their effects depend on those arrays, so a parent render
  can tear down and rebuild a map. Stabilise map point inputs with `useMemo`, or
  better initialise the map once and update its sources/markers in a separate
  effect.
- `PublicLocationMap` recreates the map when coordinates change. This is rarely
  harmful for a case page, but a reusable `useMapLibreMap` lifecycle hook plus
  an update effect would be the durable pattern for all three map components.
- `PosterPage` owns QR generation and its asynchronous result. A small
  `useQrCodeDataUrl` hook should handle errors and ignore a late result after
  unmount; this remains local derived asset state, not query data.
- `FoundMatchReview` and moderation sign photo URLs in effects. They should use
  the signed-URL query described above, avoiding repeated calls and making URL
  expiry explicit.
- `usePetPhotoSelection` is appropriately local, but asynchronous image
  preparation can race if a user selects files quickly. Add an operation ID or
  cancellation guard in the future implementation.
- Functions named `useCurrentLocation` in three pages do not call hooks. Rename
  them to `requestCurrentLocation`, or extract one `useGeolocationRequest`
  hook that owns permission/pending/error behaviour consistently.

`App` focus management, `AuthProvider`'s Supabase subscription and
`CaseMetadata`'s document-head updates are appropriate root/feature effects.
They should not be moved into Zustand or TanStack Query.

### P2 — page modules still mix orchestration, UI and feature components

`OwnerDashboardPage.tsx` combines the dashboard query, mutations, translation
fallbacks, watch areas, conversations, match review and case-card UI. Likewise
`ModerationPage.tsx` owns all queue data as well as candidate and lifecycle
components. These should be split within their existing feature folders:

```text
features/owner-dashboard/
  api.ts  queries.ts  mutations.ts  types.ts
  OwnerDashboardPage.tsx
  OwnerCaseCard.tsx  FoundMatchReview.tsx  WatchAreas.tsx  Conversations.tsx

features/moderation/
  api.ts  queries.ts  mutations.ts  types.ts
  ModerationPage.tsx
  ContentReportsQueue.tsx  FoundPetQueue.tsx  UnlinkedSightingsQueue.tsx
```

This is a maintainability boundary, not a request to create generic components
for unrelated product concepts. Keep genuinely reusable UI in `components/`;
keep domain components beside their feature.

### P2 — hard-coded UI copy and translation fallbacks belong in the i18n layer

`OwnerDashboardPage.tsx` includes a local `dashboardAdditions` translation map,
and several page/component paths include English operational text directly.
This makes feature code a second translation source and leads to inconsistent
localisation coverage. Move these keys into `i18n/resources.ts` and call `t`
normally. This is orthogonal to state management but should be included when
the feature modules are decomposed.

## State ownership decision

| State category                                                          | Owner/pattern                                                       | Zustand decision                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Supabase reads, RPC results, signed URLs and queue data                 | TanStack Query cache                                                | Never mirror in Zustand.                             |
| Auth session and sign-in acknowledgement                                | Existing `AuthProvider` context                                     | Keep context; it is a single cross-app subscription. |
| Form fields, open panels, selected case, map interaction and per-row UI | Component `useState` or a feature-local reducer                     | Keep local.                                          |
| Persisted offline sighting draft                                        | A small local-storage adapter/hook; reducer state hydrated on mount | Keep feature-local and versioned.                    |
| MapLibre instances, markers and DOM refs                                | `useRef` inside map components/hooks                                | Keep local imperative state.                         |

Introduce Zustand only if a future requirement creates **client-only state that
must be read and updated across distant routes at the same time**—for example a
cross-route, resumable missing-case wizard, a global notification centre, or a
single client-side preference system with several independent consumers. If
that happens, create small domain stores (not one app store), expose selectors,
and never store server-query results, sessions, form input that only one page
uses, or non-serialisable map/file objects in them.

## Suggested implementation order

1. Add `@tanstack/react-query`, create one `QueryClient` at `main.tsx`, and add
   the provider. Establish query-key conventions and Supabase error handling.
2. Delete the unused legacy route tree and stale legacy-only modules. Verify the
   active route imports before deleting.
3. Migrate read-only public data first: public case, poster reuse, home nearby
   discovery and sighting case options. This proves caching and public-safe
   response boundaries with low risk.
4. Migrate owner dashboard, reporter follow-up, watch areas and moderation
   queues. Replace manual loaders/reloads with query invalidation and break the
   large page files into feature components.
5. Add reducers for the sighting, missing-case and found-pet flows. Preserve
   existing offline draft semantics with focused reducer tests.
6. Move the P0 multi-write workflows to RPC/Edge Functions and change their UI
   callers to mutations. Add failure/retry/outbox coverage before removing the
   old client orchestration.
7. Stabilise map lifecycles, photo/QR async helpers and localisation cleanup.

## Acceptance criteria for the refactor

- No active page directly calls `supabase.from`, `supabase.rpc`,
  `supabase.functions.invoke` or `supabase.storage` for ordinary server state;
  calls live in feature API/query/mutation modules.
- A single route's public-case query is shared by the poster and public-case
  page through the same query key.
- Successful mutations invalidate or update only relevant cached data; no
  component-owned catch-all `load()` function remains.
- Each multi-step form has explicit, tested transition actions and no impossible
  stage/request combinations.
- Client-side workflows cannot be the sole mechanism for a security-sensitive
  or multi-write business transaction, notification delivery or cleanup.
- No Zustand store mirrors Query, auth context or a page-local form.
- The existing typecheck, lint, unit tests and core/visual Playwright suites
  pass, including authenticated owner and moderator flows described in the
  repository instructions.

## Out of scope for this planning pass

This document does not propose a router migration, SSR migration, a visual
redesign, replacing Supabase, or an immediate Zustand adoption. It also does
not prescribe optimistic updates for every mutation: use them only where the
server operation is idempotent and the recovery story is clear (for example,
some status changes), and favour invalidation/refetch for moderation and
multi-step safety workflows.
