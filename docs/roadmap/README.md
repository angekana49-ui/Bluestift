# Roadmap — handoff notes

_Written 2026-10-04, for whoever picks this repo up next: a developer, or an AI
coding agent working without the context of earlier sessions._

Each file below is one piece of work. It says where the code stands today, what
to build, which files to touch and what to test. Read this page first: it lists
the rules that apply to all of them, and most of them come from bugs that
already shipped once.

| # | Work | Why it matters | Size |
|---|------|----------------|------|
| [01](01-payments-go-live.md) | Payments: from founder-activated plans to online checkout | Revenue; closes a self-activation hole first | S (hole) → L (live checkout) |
| [02](02-lms.md) | LMS integration: finish Google Classroom, then LTI 1.3 (Moodle) | Gets Raya into schools' existing tools | M → L |
| [03](03-raya-tools-next.md) | Raya's live tools: rooms, Raya for Schools, more maths | Extends what shipped on 2026-10-04 | S → M |

Where the product as a whole stands: [`docs/project-status.md`](../project-status.md)
(older, partly stale, read its "Update" section first) and [`docs/raya-status.md`](../raya-status.md).

---

## Rules that apply to every change

### Framework
- This is **Next.js 16**, not the version you know. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing routing, caching or middleware
  code (see `AGENTS.md`). The middleware is `proxy.ts`.
- The Content-Security-Policy is built per request in `proxy.ts` /
  `lib/security/csp.ts`, with a nonce and `'strict-dynamic'`. A new external script
  or `fetch` from the browser to a new origin will be blocked until it is added there.

### People: many users are minors
- Age is asked during onboarding. API routes call `ageGateResponse(user.id)`
  (`lib/compliance/api-gate.ts`), and pages redirect through `needsAgeGate`.
  A new authenticated route must do the same.
- **Analytics:** go through `captureServer` (`lib/analytics/server.ts`). It drops
  events for minors and for visitors who did not consent. Send ids and counts, never
  text, names, emails or titles. `test/analytics-events.test.ts` enforces this,
  comments included.
- **Third parties:** anything that sends user data to a new service needs a row
  on the sub-processors page (`components/site/pages/SubprocessorsView.tsx`), in the
  same change.
- **Training opt-out:** adults only; minors' data is never used for training. See
  `lib/compliance/`.
- **Only adults pay** (guardian attestation for the rest).

### Text in the interface
- Every user-visible string goes through `lib/i18n/{en,fr,es,de}.ts`:
  `useTranslate()` in components (named `tr`, because `t` is the theme), `apiT()` for
  route error messages.
- English is required; any key missing from fr/es/de falls back to English.
- **Translate the meaning, keep it short.** `test/i18n-concise-labels.test.ts`
  fails a label that is much longer than the English.
- "Bluestift" and "Raya" are proper nouns: never translated or re-cased. "Raya"
  is rendered with `RayaText`/`RayaName` (`components/ui/brand.tsx`).

### Network (users are often on slow mobile data)
- Browser requests use `netFetch` (`lib/net/client-fetch.ts`), never bare `fetch`.
  POSTs are not retried automatically.
- Every server call to another service gets a deadline. A failure degrades
  (`withTimeout`, `lib/net/timeout.ts`) instead of failing the page.
- Anything a user typed survives a failure (`lib/net/outbox.ts`). Anything kept on
  the device is wiped on sign-out in `clearLocalData()` (`lib/net/local-data.ts`),
  because school machines are shared.

### Design
- Use the theme tokens in `components/ui/tokens.ts` and the frame in
  `components/ui/shell.tsx` (`PageBody`). The layout and contrast tests fail
  hand-rolled page frames.

### Security
- A school role is not a trusted role. Where code reads with the service role
  (`createAdminClient`), the route itself is the access check: verify membership and
  role before reading.
- New tables: turn RLS on. With no policies the table is service-role only, and
  that is intentional for payments, snapshots and similar tables.

### Tests, commits, deploys
- `npm test` (vitest), `npm run typecheck`, `npm run lint`. Tests that read source
  files must normalise CRLF (`.split("\r\n").join("\n")`), or they pass on Linux
  CI and fail on Windows.
- Commit messages look like `area: what changed, as a sentence`.
- **A push to `main` deploys to production** (Vercel git integration). The
  pre-push hook (`.githooks/pre-push`; enable once with
  `git config core.hooksPath .githooks`) runs typecheck, lint and tests first, so
  run it rather than skipping it.
- Some environment variables exist only in Vercel, not in `.env.local` (for
  example `GEMINI_MODEL_FALLBACK` and the www-vs-apex `NEXT_PUBLIC_SITE_URL`). Check
  the Vercel dashboard before assuming a value. `.env.example` lists every variable
  the code reads.

### Product boundaries
- This repo is **V2** and is the only version shown or sold. The old V1 app on
  thebluestift.com is dead; never link to it or reuse anything from it.
- Raya is a Socratic tutor. A feature that hands students finished answers works
  against the product, even when it is technically correct.
