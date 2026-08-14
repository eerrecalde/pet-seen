# PS-407 — hardening plan

## Completed for development and staging

- Keyboard users can skip directly to the main content. Route changes move focus to the new main region without scrolling the page.
- The existing visible focus indicator and reduced-motion support remain part of the baseline.
- Cloudflare Pages applies browser security headers from `public/_headers`: a restrictive content security policy, clickjacking protection, MIME-sniffing protection, a limited permissions policy, referrer protection and cross-origin opener isolation.
- The content security policy permits only the browser resources Pet Seen currently needs: the app itself, Supabase, MapTiler, local image data and the service-worker map worker.

## Moved to PS-412

- Connect a production error-monitoring service, with alerts for frontend exceptions, failed Edge Functions, authentication failures and abnormal request rates. Do not send exact locations, contact details, report text, photo URLs or authentication tokens to it.
- Add the production origin to Supabase Auth redirects, Edge Function CORS allow-lists, MapTiler key restrictions and any notification-provider allow-lists; remove staging-only origins where appropriate.
- Configure a production-only `Strict-Transport-Security` policy after the production hostname is final.
- Run an authenticated production smoke test and confirm alerts reach the support owner before public launch.

Production monitoring and launch-environment work is tracked separately as **PS-412**. PS-407 is complete.
