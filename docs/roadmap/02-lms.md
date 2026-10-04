# 02 — LMS integration: finish Google Classroom, then LTI 1.3 (Moodle)

_Status 2026-10-04. Goal: a school that already lives in an LMS can reach Raya
from it, and its classes can be imported instead of retyped._

**Order of work:**
1. Finish Google Classroom, since half of it exists.
2. Then do LTI 1.3, which covers Moodle, Canvas, Blackboard and Brightspace with
   one integration.

Neither is worth building before **a school asks for it and can test it with
you**: an LMS integration tested without a real tenant is tested against guesses.

## Where it stands

**Google Classroom** (`docs/lms-google-setup.md` has the setup steps). What is built:
- Admin-only OAuth: `GET /api/school/lms/google/start` → `/callback`. Tokens go in
  `schools.lms_connections`.
- `POST /api/school/lms/google/sync` imports the **course list** into
  `schools.lms_class_mappings`.
- `PATCH /api/school/lms/mappings` links a Google course to a Bluestift class.
- Helpers are in `lib/lms/google.ts`.

**The LMS tab is hidden.** `"lms"` is not in `DASH_TABS` (`components/school-admin.tsx`).
The code paths exist, but schools cannot see them.

What is missing:
- Roster import.
- Background sync.
- Token encryption.
- Any way to launch Raya from inside the LMS.

## Part A — finish Google Classroom (M)

1. **Encrypt the tokens.**
   - Today `lms_connections.access_token` and `refresh_token` are stored as plain text.
   - A refresh token reads a school's rosters, so it must not be readable by anyone
     with database access. Use Supabase Vault (`vault.create_secret`) or pgsodium,
     and keep only a secret id in the row.
   - Read the secret only in server routes, through the service-role client.
2. **Roster import.** Call `courses.students.list` and `courses.teachers.list` (the
   scopes are already requested). Match people to Bluestift accounts by email
   **within the school only**. Then:
   - **Matched accounts:** add the class membership the same way the class-code join
     does (`app/api/school/join/route.ts`). Respect the seat gate (`resolveSeatGate`).
     A full school must refuse, not overfill.
   - **Unmatched accounts:** **do not create accounts silently.** Many of these
     students are minors and account creation goes through the age step. Show the
     admin a list with the class join code to hand out instead.
   - **Data:** names and emails from Google are personal data of minors. Store only
     what the membership needs, and never send them to analytics.
3. **Background sync.**
   - Add a cron route like the existing ones: check `CRON_SECRET` with
     `lib/cron-auth.ts`, and schedule it in `vercel.json`.
   - The route re-syncs each connection's courses and rosters once a day.
   - Bound each run, record `last_synced_at`, and keep going after a failure (one
     school's revoked token must not stop the others).
4. **Show the tab.** Add `"lms"` back to `DASH_TABS`, with all strings in the four
   `lib/i18n` files. Show "Connect Google Classroom" only when `googleConfigured()`.
5. **Operator setup (no code).**
   - Google Cloud OAuth client with the redirect URI on the **Schools** domain, and
     `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in Vercel.
   - The consent screen must pass Google's verification before schools outside your
     test-user list can use it. The Classroom scopes are "sensitive", so plan weeks
     for this, not days.

## Part B — LTI 1.3 (L)

**What it gives a school:** a teacher adds "Raya" as an activity in a Moodle course.
Students click it and land in Raya, already signed in, with the class known.

1. **Library.** Use a maintained LTI 1.3 implementation and do not hand-roll it.
   The protocol is OIDC third-party login, signed JWTs and JWKS key rotation.
   Check that the library runs on Next 16 route handlers (Node runtime), not only
   Express.
2. **Routes** (all under `app/api/lti/`):
   - `login`: the OIDC login initiation. Store `state` and `nonce` in a short-lived
     cookie.
   - `launch`: verify the id_token against the platform's JWKS, plus `nonce`, `aud`,
     `iss` and `deployment_id`.
   - `jwks`: our public keys. The private key lives in an env var or Vault, never in
     the repo.
3. **Data model.** Add a `schools.lti_platforms` table:
   - columns `issuer`, `client_id`, `deployment_ids`, `auth_login_url`,
     `auth_token_url`, `keyset_url` and `school_id`;
   - RLS on with no policies, so it is service-role only;
   - one row per school's Moodle, registered by the founder from an `/ops` page.
4. **Accounts on launch.**
   - Map `(issuer, sub)` to a Bluestift user through a link table.
   - **First launch:** create the account inside the school (B2B2C), then run the
     normal onboarding, **including the age step**, before Raya opens.
   - Never trust an LMS role claim for anything beyond "student or teacher in this
     course". A school role is not a trusted role (see the security notes in
     `docs/roadmap/README.md`).
5. **Sessions inside an iframe.** Moodle often opens tools in an iframe.
   - Supabase auth cookies need `SameSite=None; Secure` there, which conflicts with
     the current cookie setup (`lib/supabase/cookie-domain.ts`) and with the CSP
     `frame-ancestors`.
   - **Simplest safe start: launch in a new window** (LTI `target_link_uri` +
     "open in new window" in the Moodle tool config). Only support iframes later,
     deliberately.
6. **Scope for version 1:**
   - Do: launch, account linking, class mapping.
   - Leave out: grade passback (AGS) and roster sync (NRPS). Grade passback means
     deciding what a "grade" is for a Socratic session, which is a product question
     before it is a technical one.
7. **Compliance.**
   - Each school connecting an LMS signs the DPA (`/dpa`).
   - The LMS is the school's own system, so no new sub-processor is needed unless
     we call a third-party service.
8. **Testing.** Use a local Moodle (Docker image `bitnami/moodle` or the official
   moodle-docker) registered as an LTI 1.3 platform, and add a vitest suite that
   checks the launch with a forged token: wrong `aud`, a replayed `nonce`, an
   expired token.

## Tests to keep green
`test/school-raya-scope.test.ts`, `test/school-student-record-scope.test.ts`,
`test/room-minor-visibility.test.ts`, `test/supabase-cookie-domain.test.ts`,
`test/csp-nonce.test.ts`.
