# PS-110 — map-provider validation

**Decision:** use **MapTiler Cloud** as the initial hosted provider for both
base-map tiles and forward/reverse geocoding. MapLibre GL JS remains the map
renderer. Supabase/PostGIS remains the source of truth for all coordinates.

## Why this provider

MapTiler supplies a MapLibre-compatible hosted style URL and documented forward
and reverse-geocoding endpoints, allowing the beta to use one operational
provider without tying the application to a proprietary map renderer. Its
usage dashboard groups map and search activity into sessions when its SDK is
used; this application uses MapLibre directly, so the launch budget must be
based on the provider's displayed request and session limits rather than an
assumption about a free allowance.

The provider must be reviewed again before public beta: plan limits and prices
can change. The MapTiler free plan is not licensed for commercial production,
so production requires an appropriate paid plan.

## Representative UK validation results

The following checks ran on 12 August 2026 with a restricted MapTiler API key.
The recorded labels and coordinates are public test locations, not user data.

| Scenario | Forward lookup                                                                | Reverse lookup                                                    | Outcome                                                                                                                                |
| -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Postcode | `E9 5EG` → `E9 5EG, United Kingdom` (200)                                     | `12 Cadogan Terrace, Greater London E9 5EG, United Kingdom` (200) | Pass — postcode and neighbourhood context are correct.                                                                                 |
| Street   | `Milsom Street, Bath` → Bath BA1 1DN (200)                                    | `6 Quiet Street, Bath ... BA1 1DN, United Kingdom` (200)          | Pass — street and local authority context are useful.                                                                                  |
| Park     | `Victoria Park, Hackney` → `Victoria Park Industrial Centre ... E9 5HD` (200) | Same nearby industrial-centre label (200)                         | Accept with caveat — place search is nearby but not the park itself; the existing movable pin/manual-coordinate flow remains required. |
| Town     | `Keswick, Cumbria` → `Keswick, Cumberland, United Kingdom` (200)              | `18 Market Square, Keswick ... CA12 5JH, United Kingdom` (200)    | Pass — the returned modern authority name is still intelligible.                                                                       |
| Rural    | `SY10 0NB` → `SY10 0NB, United Kingdom` (200)                                 | `Llanwddyn13, United Kingdom` (200)                               | Pass — reverse label is sparse but usable; saving coordinates must remain valid without it.                                            |

The configured Streets v2 style returned HTTP 200 with the style name `Streets`.
The running application was also checked at desktop width and a 390 px mobile
viewport with no horizontal overflow. Map interactions and the draggable marker
remain the responsibility of PS-105 and PS-201; this task validates the hosted
provider and its configuration, not a new location-entry UI.

Do not store API keys, real-report locations, or real-report screenshots in the
repository.

## Production configuration and controls

- Set `VITE_MAP_STYLE_URL` to the MapTiler Streets v2 style URL shown in
  `.env.example`. It is a public browser key, so use a dedicated key restricted
  to `petseen.org` and its approved subdomains; use a separate restricted key
  for local development.
- Keep MapLibre attribution enabled. Do not obscure provider or source
  attribution supplied by the style.
- Call geocoding only after a deliberate search or on confirmation, not on each
  keystroke. A failed or empty geocoding result must never prevent manual
  coordinate entry or pin correction.
- Set a paid-plan spend limit/alert in the provider dashboard before beta;
  review usage weekly during the launch period and rotate a key immediately if
  misuse is detected.
- Browser map tiles must request MapTiler directly. Do not proxy or server-cache
  provider map content. Persist only the product's own coordinates and
  user-supplied place label in Supabase.
- Keep `VITE_MAP_STYLE_URL` as the sole client configuration point so a future
  provider can be evaluated without changing location data or access controls.

## Evidence reviewed — 12 August 2026

- MapTiler documents the MapLibre GL JS style URL format and its Geocoding API.
- MapTiler requires a protected production browser key with allowed HTTP origins;
  its default testing key must not be used publicly.
- MapTiler Cloud terms permit displaying map content to end users, require
  attribution, prohibit server-side caching/proxying without agreement, and
  make the customer responsible for usage monitoring. The free plan is limited
  to non-commercial use and commercial R&D.

Primary references: [MapLibre integration](https://docs.maptiler.com/maplibre/),
[API key protection](https://docs.maptiler.com/cloud/api/authentication-key/),
[Cloud pricing](https://www.maptiler.com/cloud/pricing/), and
[Cloud terms](https://www.maptiler.com/terms/cloud/).

## MapLibre/Vite integration

The initial blank-map check exposed a MapLibre v6 worker integration issue in
Vite: the dependency optimiser tried to load a non-existent
`maplibre-gl-worker.mjs` file. MapLibre therefore loaded the style and marker,
but could not parse vector tiles.

`src/lib/maplibre.ts` now loads the worker with Vite's documented
`?worker&url` query and configures MapLibre with `setWorkerUrl()`. The picker
was visually rechecked after a forced Vite dependency re-optimisation: MapTiler
Streets tiles, labels, attribution and the draggable marker all rendered.

## Completion

PS-110 is complete. Re-check provider terms, plan limits and current pricing
at the start of public beta, and rotate the restricted browser key if misuse is
suspected.

Re-check provider terms, plan limits and current pricing at the start of public
beta, and rotate the restricted browser key if misuse is suspected.
