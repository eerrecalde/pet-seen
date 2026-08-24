# Pet Seen

Pet Seen helps people report missing dogs and cats, share sightings quickly, and bring pets home.

The initial beta serves the United Kingdom and will concentrate promotion in one local area to build a useful network of owners and helpers.

## Status

Release 1 is in progress. The initial application shell, visual foundation, authentication, and protected spatial data model are now in place.

See [the delivery breakdown](docs/PROJECT_BREAKDOWN.md) for the roadmap and [the map strategy](docs/MAP_STRATEGY.md) for location and mapping decisions.

The controlled-beta operating rules are documented in the [safety, privacy, retention and moderation policy](docs/BETA_SAFETY_PRIVACY_POLICY.md).

## Development

```sh
npm install
npm run dev
```

### Local Supabase stack

The repository includes a versioned local Supabase configuration for database, Auth, Storage and Studio. Install a Docker-compatible runtime (for example Docker Desktop, OrbStack, Colima or Podman) before starting it.

```sh
npm run supabase:start
npm run supabase:status
```

The local API is available at `http://127.0.0.1:54321`, Studio at `http://127.0.0.1:54323`, and intercepted authentication emails at `http://127.0.0.1:54324`. The CLI prints the local anon key after the stack starts. Copy `.env.example` to `.env.local`, then add that anon key so the web app can use local Auth:

```sh
cp .env.example .env.local
npm run supabase:status
```

Magic links return to `/auth`. Local Auth sends every email to Mailpit rather than a real inbox; open `http://127.0.0.1:54324`, select the newest message, and use its magic link. This makes it safe to sign in with any made-up email address during local testing.

For the two repeatable local identities, use `owner@petseen.org` for owner flows and `moderator@petseen.org` for moderation flows. They are local-only test accounts, not real email addresses, and their magic links are retrieved from Mailpit in the same way.

#### Local development auth bypass

To sign in without opening a magic link, add a `bypass` entry to the browser's local storage, then refresh. Its value is `<local-user-email-or-id>:<role>`, where the role is `owner`, `moderator` or `administrator`:

```js
localStorage.setItem('bypass', 'dev-owner@example.test:owner')
```

For an existing local user, its UUID from Authentication → Users works too:

```js
localStorage.setItem('bypass', '00000000-0000-4000-8000-000000000000:moderator')
```

The app provisions that user in the local Supabase stack and signs in with the selected role. It works only in a Vite development build connected to `localhost` or `127.0.0.1` Supabase; it cannot run against a hosted environment. Remove it with `localStorage.removeItem('bypass')` and refresh.

Use this bypass when verifying authenticated work locally: choose `owner` for owner case flows, and `moderator` or `administrator` for staff-only pages such as `/moderation`.

For repeatable bypass testing, use `owner@petseen.org:owner` for owner flows and `moderator@petseen.org:moderator` for moderation flows. These accounts exist only in the local Supabase stack.

Photo processing and social cards run in Edge Functions. Start them alongside the local stack when testing an authenticated upload or Open Graph image:

```sh
npx supabase functions serve --no-verify-jwt
```

For a hosted project, deploy `process-pet-photo`, `screen-found-pet-report`, `moderate-found-pet-report`, `score-found-pet-candidates`, `process-found-pet-ai-scoring-queue`, `score-unlinked-sighting-candidates`, `deliver-workflow-outbox`, `send-sighting-owner-email`, `send-found-pet-match-owner-email`, `send-watch-notifications`, `geocode-location`, `case-pet-photo` and `case-social-card` after linking the intended project. Do not deploy `dev-auth-bypass`. Set `CONTENT_SAFETY_PROVIDER=openai` and `OPENAI_API_KEY` as Edge Function secrets to automatically screen found-pet text and photos and to enable staff-only AI candidate scoring; missing or failed checks remain in the private staff queue. AI scores are retained for review. A safely approved found-pet report creates one provisional owner-review link only when the highest combined-score candidate has a deterministic score of at least 80, a combined score of at least 80, and medium or high AI confidence. That owner receives a privacy-safe email asking them to review the possible match; staff can otherwise link any listed candidate. `case-pet-photo` and `case-social-card` are public and must be deployed with `--no-verify-jwt`; they use Supabase’s built-in service-role environment variables to return only processed derivatives for published cases. Public photo URLs are versioned and cacheable for five minutes (with one minute stale-while-revalidate), then re-check publication before returning bytes. The original source and Storage paths remain private; the Edge Function downloads the selected display or card derivative rather than redirecting to a signed URL. Set `VITE_SOCIAL_CARD_URL` to the latter’s public URL at build time.

### Public photo delivery

TanStack Query caches public-case metadata in the current browser session for five minutes and nearby results for two minutes; owner case changes invalidate that cache family. It does not cache image bytes between visitors. The browser and CDN cache the versioned `case-pet-photo` URL for five minutes, while the function streams a private processed derivative only after confirming the case is still published and the requested version is current. This keeps repeat requests off the Edge Function and Storage during normal cache hits, yet bounds stale access after a case closes or a photo changes to six minutes at most. The processing worker writes a 480 px card JPEG alongside the 1600 px display JPEG, both EXIF-stripped and private.

### AI scoring limits

Run `process-found-pet-ai-scoring-queue` on a protected schedule every minute, with a service-role JWT. Approval and staff requests only create an idempotent queue entry; the worker is the sole caller of the provider. The database defaults are a $10/day and $200/month provider budget, 10 runs/hour, three shortlist candidates and three candidate images, with a 1.5 MB and 1600 px maximum per image. Operations may change the single `ai_provider_budget_guardrails` row after approving a cost change. Alert the on-call team when a queue item is skipped or fails, or when daily spend exceeds 80% of the configured limit. Budget, rate, stale-version and shortlist skips remain visible to staff for manual review; the run audit stores only aggregate token counts, latency, outcome and estimated cost—never prompts or images.

### Watch-alert delivery limits

Each owner may save up to 10 watch areas and register up to 3 browser push subscriptions. A sighting reaches at most 100 distinct recipients; overlapping areas are coalesced to one alert per recipient. Push is attempted first, and email is only a fallback. Recipients have a 30-minute quiet period after any alert, while email fallback is additionally limited to one per hour. Provider failures are retried through the durable outbox at most six times with backoff; quiet-period deferrals do not consume that retry budget. Run `deliver-workflow-outbox` on a schedule so deferred and failed work is reclaimed.

### Geocoding controls

Place search uses `geocode-location`, an Edge Function that holds the dedicated `MAPTILER_GEOCODING_API_KEY`; never add that key to a `VITE_` variable. Keep the browser map-style key origin-restricted to the production hostname and approved subdomains, and configure the provider key with the narrowest available server-side/IP restriction. The function normalises queries, caches public provider results for 24 hours, and limits uncached provider calls to 20 per client and 300 globally per five minutes. Search runs only when a visitor selects Search or presses Enter, and a rate-limit or provider failure must leave manual pin placement available.

Before beta, configure a paid MapTiler plan, a monthly quota/spend alert at 80%, and alert routing to the on-call channel. Review provider usage weekly and immediately rotate either key after suspected misuse. MapTiler is the primary service; during a sustained outage or quota exhaustion, keep manual-pin reporting enabled, disable search by removing the geocoding secret, and only switch to a separately reviewed provider/key after confirming its privacy terms, quotas, origin restrictions and adapter mapping. Do not proxy or cache map tiles.

Stop the stack with `npm run supabase:stop`. To rebuild it from the tracked migrations and seed data, run `npm run supabase:db:reset`. Do not use `--linked` for local commands unless you intentionally mean to operate on a remote project.

Useful checks:

```sh
npm run typecheck
npm run lint
npm run build
```

## Product principles

- A missing-pet case needs a signed-in creator.
- A sighting must be possible without an account.
- Public pages never show precise sensitive locations.
- The beta supports dogs and cats only.
- The product must remain fast, calm, accessible, and mobile-first.
