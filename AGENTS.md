# General guidance

Before changing frontend code in this repo, read and follow both local skills:

- `.agents/skills/design-ui-with-restraint/SKILL.md`
- `.agents/skills/write-practical-copy/SKILL.md`

## Work with starter project

Keep the supplied User Insights project intact as the starting example. Make scoped changes, use deterministic public-safe data, and verify the rendered desktop and mobile experience before claiming the work is complete.

## Local authenticated testing

For task verification that needs an authenticated owner or staff member, use the local-only auth bypass documented in the README rather than waiting for a magic link. Start the local Supabase stack and Edge Functions runtime, set the browser's `bypass` local-storage value to `<local-user-email-or-id>:<role>`, then reload the app. Use `owner` for case-management flows and `moderator` or `administrator` for staff-only flows such as `/moderation`.

Use these stable local test accounts where their existing data is useful: `owner@petseen.org:owner` for owner flows, and `moderator@petseen.org:moderator` for moderation flows. They are local development accounts only.

The bypass only works with a Vite development build connected to the local Supabase stack. Never use it against a hosted environment, and do not deploy the `dev-auth-bypass` Edge Function.

## Task tracking

Treat [`docs/PROJECT_BREAKDOWN.md`](docs/PROJECT_BREAKDOWN.md) as the source of truth for project tasks. For any task-related request, review and update its matching entry there. Before pushing a commit that completes a task, mark that task's status as `Done` in the breakdown and include the update in the same commit.
Also when I mention next task, or task ### I mean from the tasks in the docs/PROJECT_BREAKDOWN.md
