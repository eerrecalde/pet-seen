# How to use Pet Seen

## Prerequisites

- Node.js and npm
- A Docker-compatible runtime for the local Supabase stack
- Supabase CLI, run through `npx supabase`

## Start the application

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run supabase:status
npm run dev
```

Add the local Supabase anon key printed by `npm run supabase:status` to `.env.local`. The local API is available at `http://127.0.0.1:54321`, Studio at `http://127.0.0.1:54323`, and local authentication emails at `http://127.0.0.1:54324`.

## Test authenticated flows locally

The repository includes a development-only auth bypass for the local Vite application. In browser local storage, set `bypass` to an email or user ID followed by a supported role, then reload:

```js
localStorage.setItem('bypass', 'owner@petseen.org:owner')
```

Use `owner@petseen.org:owner` for owner case flows and `moderator@petseen.org:moderator` for moderation. These are local test identities only. Remove the bypass after testing:

```js
localStorage.removeItem('bypass')
```

The bypass works only against local Supabase and must never be deployed.

### Recovering the local auth setup

An authenticated check is still required when the first attempt fails. Use this recovery sequence rather than falling back to an unauthenticated screen:

1. Run `npm run supabase:status`. If it cannot connect to Docker, start Docker Desktop, wait for it to finish starting, then run the status command again.
2. If the status output does not include `FUNCTIONS_URL`, or the bypass endpoint returns `503`, start the local Edge Functions runtime:

   ```bash
   npx supabase functions serve --no-verify-jwt
   ```

   This version of the Supabase CLI serves all functions with this command. Do not append `dev-auth-bypass` as a positional argument.
3. Start Vite with `npm run dev`, verify `http://127.0.0.1:5173` loads, set the local-storage bypass value, and reload the protected route. For example, use `moderator@petseen.org:moderator` for `/moderation`.

Never use this bypass with a hosted URL. Remove `bypass` from local storage after the check.

## Serve local Edge Functions

When testing uploads, automated processing, or social cards, run the required functions alongside the local stack:

```bash
npx supabase functions serve --no-verify-jwt
```

## Verification

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Visual regression tests are separate:

```bash
npm run test:e2e:visual
```

## Reset or stop local services

```bash
npm run supabase:db:reset
npm run supabase:stop
```

`supabase:db:reset` rebuilds the local database from the committed migrations and seed data. Do not add `--linked` unless you intentionally mean to operate on a hosted project.

## Hosted configuration notes

Production uses server-owned secrets for content safety, AI scoring, email and push delivery, and geocoding. Keep these out of `VITE_` variables. Detailed staging and scheduled-operation guidance lives in [docs/STAGING_ENVIRONMENT.md](./docs/STAGING_ENVIRONMENT.md).
