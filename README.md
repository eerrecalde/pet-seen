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

Magic links return to `/auth`; the local email inbox is available at `http://127.0.0.1:54324`.

Photo processing runs in the `process-pet-photo` Edge Function. Start it alongside the local stack when testing an authenticated upload:

```sh
npx supabase functions serve --no-verify-jwt
```

For a hosted project, deploy it with `npx supabase functions deploy process-pet-photo` after linking the intended project. The function uses Supabase’s built-in service-role environment variables; do not add them to browser environment files.

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
