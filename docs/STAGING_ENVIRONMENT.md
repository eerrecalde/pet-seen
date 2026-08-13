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
   project: `send-sighting-owner-email`, `process-pet-photo`, and
   `case-social-card`. Configure their staging-only secrets and verified email
   sender there.
3. In Supabase Auth, set the Site URL to
   `https://petseen-staging.pages.dev` and add
   `https://petseen-staging.pages.dev/auth` to the redirect allow-list. Keep
   the production URLs out of this project.
4. Create the Cloudflare Pages project named `pet-seen-staging`, set `main` as
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

6. Run **Deploy staging** manually once, confirm the generated Pages URL, and
   exercise a magic-link sign-in and a case social-card request. The workflow
   then deploys every subsequent push to `main`.

The Supabase anon key is intentionally supplied only at build time. It is a
browser public key, but keeping all environment values in GitHub secrets avoids
accidentally building staging with local or production values.
