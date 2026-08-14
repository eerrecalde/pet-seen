# Staging environment

PS-305 deploys `main` to the separate Cloudflare Pages project
`petseen-staging`. Its temporary, public staging address is:

`https://petseen-staging.pages.dev`

## Hosted project identifiers

| Environment | Supabase project | Project ref |
| --- | --- | --- |
| Staging | `petseen-staging` | `anaafdoeddfpylybwlzu` |
| Production | `petseen` | `xjuvcbthkqrfdkwbxfpa` |

These identifiers are safe to commit. Database passwords, access tokens,
service-role keys, and function secrets must remain in the relevant provider's
secret store.

The GitHub Actions workflow builds the frontend with staging-only public values
and deploys `dist` directly to Cloudflare Pages. Cloudflare Pages needs no build
command because the build happens in GitHub Actions. `public/_redirects` keeps
client-side routes working when opened directly.

## One-time account setup

1. Create a separate hosted Supabase project for staging. Do not link the local
   project or a production project to this workflow.
2. Apply the tracked migrations and deploy these Edge Functions to the staging
   project: `send-sighting-owner-email`, `process-pet-photo`,
   `screen-found-pet-report`, `moderate-found-pet-report`,
   `manage-found-pet-report`, `housekeep-found-pet-reports`, and
   `case-social-card`. Configure their staging-only secrets and verified email
   sender there.
3. In Supabase Auth, set the Site URL to
   `https://petseen-staging.pages.dev` and add
   `https://petseen-staging.pages.dev/auth` to the redirect allow-list. Keep
   the production URLs out of this project.
4. Create the Cloudflare Pages project named `petseen-staging`, set `main` as
   its production branch, and use Direct Upload rather than Cloudflare's Git
   integration. The Pages hostname above becomes the temporary staging domain.
5. Create a least-privilege Cloudflare API token that can edit this Pages
   project. Add the following repository secrets, preferably scoped to the
   GitHub `staging` environment:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `STAGING_SUPABASE_URL`
   - `STAGING_SUPABASE_ANON_KEY`
   - `STAGING_SOCIAL_CARD_URL` — the staging `case-social-card` function URL
   - `STAGING_MAP_STYLE_URL` — a MapTiler style URL restricted to the staging
     Pages origin
   - `STAGING_VAPID_PUBLIC_KEY` — the browser-safe VAPID public key for
     staging push subscriptions
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY` — used only by the post-deployment
    Playwright job to create and remove its isolated test owner; never expose
    this key to the browser or frontend build

6. Run **Deploy staging** manually once, confirm the generated Pages URL, and
   exercise a magic-link sign-in and a case social-card request. After that,
   staging deploys the exact `main` commit only after **Quality checks** pass.
   A manual deployment remains available for deliberate recovery work.

The Supabase anon key is intentionally supplied only at build time. It is a
browser public key, but keeping all environment values in GitHub secrets avoids
accidentally building staging with local or production values.

## Found-pet housekeeping schedule

Schedule a daily authenticated POST to `housekeep-found-pet-reports` using the
project's service-role key (for example, through Supabase Cron or the platform
scheduler). The function expires unlinked reports after 30 days and removes
expired or resolved reports, photos and messages one year after the lifecycle
decision. It records only the report UUID, action and timing in the staff audit
trail. Staff can also run the same function from a protected maintenance job.

## Current GitHub environment contract

The GitHub `staging` environment holds these eight secrets. Their values are not
committed and must never be printed in workflow logs:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Account-scoped token with Cloudflare Pages Edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing `petseen-staging` |
| `STAGING_SUPABASE_URL` | `https://anaafdoeddfpylybwlzu.supabase.co` |
| `STAGING_SUPABASE_ANON_KEY` | Browser publishable/anon key for the staging project |
| `STAGING_SOCIAL_CARD_URL` | Staging `case-social-card` function URL |
| `STAGING_MAP_STYLE_URL` | MapTiler URL whose key is restricted to `petseen-staging.pages.dev` |
| `STAGING_VAPID_PUBLIC_KEY` | Browser-safe VAPID public key used when building staging |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Server-only key for disposable Playwright users and cleanup |

No environment protection rules are needed for staging: the workflow itself
deploys only pushes to `main` and serialized deployments through its
`staging-deploy` concurrency group.

## Routine operations

- Every push to `main` runs `.github/workflows/quality.yml`. A successful run
  triggers `.github/workflows/deploy-staging.yml`, which deploys that same
  commit to staging. Playwright is deliberately separate from deployment while
  the product is in active development: run **Staging E2E regression** from
  the Actions tab after a meaningful change or before merging a release-sized
  set of work. Choose `core` for the beta loop or `all` to include the visual
  regression suite. The workflow uses the `staging` environment and uploads
  its report, traces, screenshots, and videos on every run.
- The deployment workflow does not apply database migrations or deploy Edge
  Functions. When changes under `supabase/` need staging validation, apply them
  deliberately to the staging ref:

  ```sh
  npx supabase db push --linked
  npx supabase functions deploy <function-name> --project-ref anaafdoeddfpylybwlzu
  ```

  Confirm the repository is linked to `anaafdoeddfpylybwlzu` first with
  `npx supabase projects list`; `db push --linked` will otherwise target the
  wrong remote project.

## Manual Playwright regression

Run the complete functional and visual suite in the pinned Linux container:

```sh
docker run --rm --init --ipc=host --platform linux/amd64 \
  --env-file .env.playwright.local \
  -v "$PWD:/work" -v petseen-playwright-node-modules-v162:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc 'npm ci && npm run test:e2e:all'
```

## Playwright visual baselines

The suite keeps one desktop snapshot for each core-loop page: missing-case,
public-case, sighting and owner dashboard. Maps, generated pet images and
datetime controls are masked because their rendering or value is expected to
vary between runs; the browser clock, names and form content are fixed so the
rest of each page is compared pixel-for-pixel. Each run creates and deletes a
separate staging owner, which prevents one run's case or sighting from changing
another run's result.

After adding or intentionally changing a visual baseline, use the pinned
Playwright Linux image. This ensures the baseline has a consistent Linux
platform suffix and rendering environment:

```sh
docker run --rm --init --ipc=host --platform linux/amd64 \
  --env-file .env.playwright.local \
  -v "$PWD:/work" -v petseen-playwright-node-modules-v162:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc 'npm ci && npm run test:e2e:visual:update'
```

Review and commit the generated files under
`tests/e2e/visual-regression.spec.ts-snapshots/`. Run `npm run test:e2e:visual`
manually when you want to compare snapshots. The container creates
`*-chromium-linux.png` files; remove the macOS-only `*-chromium-darwin.png`
files once the Linux baselines are reviewed.
- `case-social-card` and `case-pet-photo` are public and must be deployed with
  `--no-verify-jwt`. `case-pet-photo` returns only a short-lived URL for a
  processed image on a published case. The photo-processing and sighting-email
  functions are invoked through the Supabase client and retain JWT verification.
- The staging `send-sighting-owner-email` function needs its own
  `RESEND_API_KEY` and `SIGHTING_EMAIL_FROM` Supabase Function secrets before
  sighting-email delivery can be tested end-to-end.
