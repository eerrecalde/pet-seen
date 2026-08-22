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

For a hosted project, deploy `process-pet-photo`, `screen-found-pet-report`, `moderate-found-pet-report`, `score-found-pet-candidates`, `score-unlinked-sighting-candidates`, `case-pet-photo` and `case-social-card` after linking the intended project. Do not deploy `dev-auth-bypass`. Set `CONTENT_SAFETY_PROVIDER=openai` and `OPENAI_API_KEY` as Edge Function secrets to automatically screen found-pet text and photos and to enable staff-only AI candidate scoring; missing or failed checks remain in the private staff queue. AI scores are retained for review. A safely approved found-pet report automatically creates a provisional owner-review link only when one candidate has a deterministic score of at least 80, a combined score of at least 80, and medium or high AI confidence; staff can otherwise link any listed candidate. `case-pet-photo` and `case-social-card` are public and must be deployed with `--no-verify-jwt`; they use Supabase’s built-in service-role environment variables to return only processed display images for published cases. Set `VITE_SOCIAL_CARD_URL` to the latter’s public URL at build time.

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
