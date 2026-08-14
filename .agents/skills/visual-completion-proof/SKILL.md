---
name: visual-completion-proof
description: Verify completed tasks that produce or change a user-visible visual result, then communicate successful completion with a current screenshot. Use automatically as the final verification step after implementing or modifying websites, apps, UI, visualizations, documents, slides, images, PDFs, or other rendered visual artifacts; use when a user asks to confirm a visual task is done.
---

# Visual Completion Proof

Use this skill as the last step of a task with a visual outcome. Do not claim that visual work is complete without current visual proof.

## Verification workflow

1. Identify the finished state the user asked for and the smallest relevant rendered surface: screen, route, document page, slide, image, or PDF page.
2. Open or render the current artifact. For interactive interfaces, verify the relevant desktop view and a mobile view when responsive behavior is in scope. For static artifacts, render the relevant page or image at readable size.
3. Check that the requested visual result is present, legible, and free of obvious regressions such as clipping, overflow, missing content, broken assets, or incorrect empty/error state.
4. If the result does not look correct, continue fixing and verifying. Do not take a screenshot as proof until it does.
5. Take a current screenshot of the verified final state. Use a screenshot tool or an existing render; never reuse an outdated image or substitute a mockup.
6. In the final response, state that the visual task is complete and embed the screenshot using an absolute local path or the platform's image output mechanism. Keep any accompanying test summary concise.

## Local authenticated verification

For Pet Seen work that needs an authenticated screen, use the local-only development bypass instead of a magic link. Start the local Supabase stack and Edge Functions runtime, set `localStorage.bypass` to the appropriate test identity, then reload:

- Use `owner@petseen.org:owner` for owner case-management flows.
- Use `moderator@petseen.org:moderator` for staff-only flows, including `/moderation`.

Use this only in a Vite development build connected to local `localhost` or `127.0.0.1` Supabase. Never use it against a hosted environment and never deploy the `dev-auth-bypass` Edge Function. Clear it after testing with `localStorage.removeItem('bypass')`, then reload.

## Limits and failures

- Treat screenshots as proof of appearance, not proof of all functional, accessibility, data, or security requirements. Run relevant non-visual checks too.
- If an interface needs authenticated state, use the task's approved local test setup.
- If the artifact cannot be rendered or screenshotted, report the blocker plainly. Do not say the task is fully done.
- For a change with no visual outcome, do not force a screenshot; report the appropriate verification instead.
