# Security

A record of the security audit of 6 September 2026 — four passes, all on that
one day: what they changed, and what they deliberately left alone. It is written for the next person to touch these
files — including a stranger, since this code is open. Nothing here is a secret:
an attacker who reads it learns which doors are locked, not which are open.

## The threat this product actually has

Most of what Bluestift holds belongs to children: what they got wrong, what a
teacher wrote about them, what a model inferred about how they think. Almost
none of it is money, and none of it is interesting to a broad automated attack.
The realistic adversary is **someone with an ordinary account** — a classmate, a
sibling, a stranger who signed up — reaching for data that belongs to someone
else. So the questions this audit kept asking were not "can the perimeter be
breached" but "what can one signed-in account see that is not theirs", and
"what leaves this system that did not have to".

Two structural facts make that the right focus:

- **Schools are self-serve.** Anyone with a verified email can create a school,
  a class, and staff membership in about a minute. "A teacher" is therefore not
  a trusted role — it is a role any attacker can hold. Every staff-side check
  has to assume that.
- **Most privileged reads bypass RLS.** The `schools`, `kernel` and `content`
  schemas are read with the service role because they cross schema boundaries.
  Where that is true, the route file *is* the security boundary. There is no
  database policy underneath to catch a missing check.

## What was wrong, and what was done

### 1. Any staff account could read any user's cognitive profile — fixed

`GET /api/school/student/record` checked that the caller could open the class in
the URL. It never checked that the *student* in the URL was in that class. Every
read behind it is keyed on the student id alone — the account row, the staff
follow-up notes, the assessment history, the whole Kernel profile (concept
state, mindset, risk assessments, trajectories). So one class you legitimately
hold, plus any user id, returned that person's file. It also wrote the access to
the FERPA disclosure log as though it had been legitimate.

Now: `assertStudentInClass` runs beside `assertClassAccess` in the route, and
`buildStudentRecord` refuses independently and returns `null` — the two checks
are separate on purpose, so the next caller of the builder inherits the
guarantee rather than having to remember it. Staff follow-ups are also scoped to
the class, where before one school could read the private notes another school's
staff had written about the same student. Held by `test/school-student-record-scope.test.ts`.

### 2. Share tokens and private-room links were being sent to the analytics processor — fixed

`$current_url` carried the raw path and full query string on every event. Two of
those paths are not locations but **credentials**: `/s/<token>` is the bearer
capability for a shared document, and `/rooms/<uuid>` is how a private room is
joined — holding the id *is* the invitation. Anyone with access to the analytics
project, now or in a future export of it, could open a child's shared work and
walk into their private room.

Now: `lib/analytics/scrub-url.ts` reduces a path to its shape (`/rooms/[id]`,
`/s/[token]`) and drops every query key but a short list that describes a page
or a campaign. It is applied through PostHog's `sanitize_properties`, so it
covers **every** event's location properties rather than only our own
`$pageview` call.

### 3. Autocapture was recording what children clicked on — fixed

`autocapture: true` sends the text of the clicked element. On a marketing page
that is a button label. Inside Raya it is a message to a tutor, a document
title, a classmate's name on a roster. No consent banner makes that
proportionate. It is now `false`; every funnel here already runs on named
events, so nothing measurable was lost.

### 4. A school admin could turn any username into an email address — fixed

`POST /api/school/profs` looked an account up by email *or username*, and adding
someone puts them on the team list, which shows their address. Type a handle,
add, read the email, remove. Since anyone can be an admin, that was a directory.
The lookup is now email-only — the caller must already hold the one fact it
could have revealed — and rate-limited per admin.

### 5. Cross-site writes now fail closed as well as by default — fixed

The session cookie is `SameSite=Lax`, which is what stops another site from
POSTing with a signed-in child's cookies. That is still the primary defence.
`lib/security/same-origin.ts` adds a second, in the proxy, because Lax has two
edges: it is same-*site* rather than same-origin (so the day
`NEXT_PUBLIC_COOKIE_DOMAIN` is set for the domain split, one stray subdomain
becomes an attack surface), and it is a browser default rather than a rule this
repo would notice losing.

The check is narrow so it cannot cause an outage: safe methods pass, a **missing**
`Origin` passes (the payment webhook and the crons never send one, and
authenticate with their own secrets), and a present `Origin` is compared against
the request's own Host — so previews, localhost and custom domains need no
configuration.

### 6. The Kernel's error bodies stopped being forwarded to callers — fixed

`/api/kernel/analyze` and `/api/kernel/profile` returned the upstream failure as
`detail`. That service runs on another host, so its errors describe our
infrastructure to whoever prodded the endpoint. The detail now goes to
`reportError` and the caller gets the status alone.

## Second pass

Run again from scratch on different axes — races, mass assignment, redirects,
enumeration, and an adversarial reading of the first pass's own patches. Four
more things, one of them mine.

### 7. `next` could send a signed-in user to another site — fixed

Both auth callbacks built their redirect as `origin + next`, and `next` is a
query parameter. String concatenation is what makes that unsafe: a value that
does not begin with `/` stops being a path. `next=@evil.com` resolves to
`https://ours@evil.com` — everything before the `@` is userinfo, and the
browser goes to evil.com. `next=.evil.com` does it by extending the hostname.

Only reachable by someone who already holds a valid sign-in token, which is why
it sat low rather than critical — but an open redirect on the domain people type
their credentials into is a phishing amplifier, and it is a landmine for any
future feature that builds a link with `next`. `safeNext` now requires one
leading slash and no second one. Held by `test/auth-redirect-safety.test.ts`,
which checks what `new URL` actually resolves rather than trusting a regex.

### 8. `ilike` was treating typed input as a pattern — fixed

Two endpoints look an account up by a typed email and used `ilike` to forgive
capitals. `%` and `_` are wildcards to it, so `%@%` stops meaning "this address"
and starts meaning "the first account there is". On the operator's activation
route that grants a stranger a paid plan; on the school route it puts a stranger
on a team list that displays their address — the same harvest fix 4 closed,
through the back door. Both now refuse those two characters, which belong in no
unquoted address, rather than escaping them into a filter grammar.

### 9. My own fix had a foot-gun in it — fixed

`assertClassAccess(userId, classId)` takes the CALLER first.
`assertStudentInClass(studentUserId, classId)`, which I added beside it, took
the SUBJECT first. Two adjacent guards, two different people in the same
position, both typed `string` — a swap compiles, passes every test, and quietly
restores the hole. It now takes a named object, so the mistake cannot be
written.

### 10. Lowercasing could have lost an account — fixed

Fix 4 lowercased the address before an exact match. Supabase Auth stores it that
way, but the operator route's own comment says the mirrored column is not
guaranteed to, so an admin might have failed to find a real colleague. The
lookup now tries the exact match first and falls back to a case-insensitive one,
with the wildcards refused above it.

### Confirmed rather than changed

**The teacher path is code-then-approval, and the approval is optional.** A
teacher must enter a staff code the school issued; the code is eight characters
from an unambiguous alphabet, resolved with the service role because teachers
cannot read the code table. What happens next depends on a checkbox the admin
ticked when minting it: without `auto_approve` the teacher lands in a pending
queue and an admin validates them; with it, the code alone is the membership.
The UI defaults the checkbox to off, which is the right default. Worth knowing
that an auto-approve code, once it leaks into a staffroom group chat, is staff
access until someone deactivates it — which the year rollover does on its own.

Also re-verified clean this pass: no client body is ever spread into a database
write (no mass assignment anywhere), every school route carries a membership
check, `tools/generate` scopes the media it reads to the caller, assignment
resources are scoped to the school, and the survey contact endpoint cannot
overwrite an address already set.

## Third pass: the CSP

The first two passes left `'unsafe-inline'` in `script-src` as an accepted risk.
It is gone.

### 11. Scripts are trusted by nonce, not by origin — fixed

A policy written in `next.config.ts` is evaluated once, at build time, so it can
only hold constants — which is exactly why it had to allow inline scripts. The
policy now lives in `proxy.ts`, built per request around a fresh 16-byte nonce
(`lib/security/csp.ts`), and `script-src` reads:

```
script-src 'self' 'nonce-<per-request>' 'strict-dynamic' <turnstile> <posthog>
```

`'strict-dynamic'` is the part that matters. Without it a browser trusts any
script served from an allowed ORIGIN — an old file on a CDN, a JSONP endpoint,
anything. With it the origin list is ignored and exactly two things are
trusted: a script carrying this request's nonce, and a script loaded by one that
did. The question stops being "where did this come from" and becomes "did our
own code ask for it". Turnstile keeps working for that reason: its script is
injected by `components/turnstile.tsx`, so it inherits trust rather than needing
a nonce we cannot hand it.

**What it cost, measured rather than assumed.** Nonces require every page to be
server-rendered, because a prerendered page has no request to take a nonce from
and would arrive with its own scripts refused. A build before the change showed
113 of 116 entries already rendered on demand; the exceptions were the default
404, the sandbox checkout stand-in, and a JSON manifest that has no scripts. So
the real cost here was two pages. `app/layout.tsx` now declares
`force-dynamic`, which makes the requirement a rule rather than a coincidence —
the next page someone adds cannot quietly become the exception that breaks.

**Verified against a running production build**, because a green build proves
nothing about a header. Every script tag on `/`, `/login`, `/legal`, `/pricing`
and a 404 carries the nonce, none is without one, the nonce in the HTML matches
the one in the header, and two requests to the same URL get different nonces.
The same run confirmed a cross-site POST is refused with an empty body while a
same-origin POST and a webhook with no `Origin` both reach their route.

Styles still carry `'unsafe-inline'`, and that is a decision rather than a
leftover: a nonce applies to `<style>` elements and does nothing for `style="…"`
attributes, which this design system uses on roughly a hundred components.
Removing it would tighten nothing a nonce covers and would blank the interface.

### 12. The typecheck had been lying — fixed

Chasing the build for the change above turned up something worse than the CSP.
`npx tsc --noEmit` was reporting clean while `next build` failed: a stale
generated file from an old dev session, `.next/dev/types/routes.d.ts`, is pulled
in by `tsconfig.json` and contained an unterminated template literal. TypeScript
gave up part-way and reported nothing.

It was hiding a real error — `lib/compliance/export.ts` reading
`learning.kernel_profile_snapshots`, a table that exists (migration
20260728004630) but is absent from `types/database.types.ts`, which has not been
regenerated since. The data export would have failed at runtime for that
section. Fixed with a cast confined to the one call site, documented to be
deleted when `gen:types` is next run.

The lesson is worth more than the bug: **a green typecheck here was not
evidence, because the tool was silently degraded.** Run `next build` before
believing one, and delete `.next/dev/types` if the two ever disagree.

## Fourth pass: closing what had been deferred

The first three passes each left something on the "accepted" list because it was
low-value or awkward. Asked to finish, three of those turned out to be neither.

### 13. A failed save was showing users our database errors — fixed

Around ninety routes answered a 5xx with the raw failure — `error.message`
straight off a Postgres or provider error. The schema disclosure was the
original reason to care and the weaker one: the migrations are public.

The real problem was found by reading the callers. Every client here renders
that field directly (`setError(data?.error ?? "Upload failed.")`), so a child
whose upload failed was being shown `duplicate key value violates unique
constraint "…"`. Each of those call sites already carried a sensible fallback
sentence; the server just never let it be used.

`lib/observability/client-error.ts` now stands between the two: production gets
the wording the route intended, development still gets the real message, and the
log keeps everything. Genuine 4xx messages were left alone — the duplicate-class
409, the seat-limit refusal, the guardian requirement — because those are
answers, not failures. `test/client-error.test.ts` holds the sweep swept.

### 14. A zip bomb could sit in the extractor until the platform killed it — bounded

`.docx` and `.xlsx` are ZIP containers and neither mammoth nor SheetJS exposes a
decompression bound, so a 25 MB upload of pathologically compressible XML
expands without a ceiling. Nothing available here stops the expansion. What was
missing was a limit on what it costs: extraction now gives up after a minute and
answers "this file took too long to read". A real 25 MB spreadsheet parses in
seconds, so the bound only bites the pathological case, on a path that is already
authenticated and rate-limited per user.

### 15. The typecheck can no longer report a success it did not earn — fixed

`npm run typecheck` now deletes `.next/dev/types` before running, and fails
loudly if errors surface in generated files anyway. This is the process fix for
finding 12: a checker that reports clean when it stopped early is worse than no
checker, because the entire reason to run one is to be allowed to stop worrying.
Verified by planting a broken generated file and confirming the run refuses.

### Still accepted, now for better reasons

**`@xmldom/xmldom`** (moderate, transitive via mammoth) has no fix to take:
mammoth's latest release still pins `^0.8.6`, and the flaw is in XML
serialization, which mammoth does not do — it only parses.

**Class codes stay six characters.** A guessed one enrols the guesser in a
class and grants no read of anyone else's data; redemption is rate-limited.

**Wall reactions still have no per-visitor dedupe.** Fixing it properly needs a
uniqueness constraint, and this audit does not write migrations. It is counter
integrity on a public marketing page, not a security boundary.

**`types/database.types.ts` is behind the migrations.** Regenerating needs
credentials this audit does not hold. One table is reached through a documented
cast that will stop compiling — deliberately — the next time `gen:types` runs.

## What was checked and found sound

Worth writing down, so the next audit does not re-derive it:

- **No SQL or PostgREST injection.** Every filter is a parameterised builder
  call. The single interpolated filter (`school/instructions`) interpolates a
  UUID the server read from the database, never client input.
- **No XSS sink.** No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`
  anywhere. The Markdown parser is hand-written specifically to refuse HTML
  passthrough, and link hrefs are allowlisted to `http(s):`/`mailto:`.
- **No SSRF.** Every server-side `fetch` target is a literal or an environment
  variable. No user-supplied URL is ever fetched.
- **No secret in the repo or its history.** `.env*` has never been committed
  (`.env.example` was, with placeholders only, and is now ignored too). No key
  material appears in any tracked file.
- **Recovery keys** are never stored — SHA-256 of an 80-bit uniformly random
  key — and generating a new one is gated on a memory word (scrypt, per-row
  salt, unreadable by the account's own client) with a fail-closed guess limit.
- **Storage paths** reject traversal explicitly rather than normalising, and
  every object key is prefixed with the owner's id under an RLS policy that
  checks it.
- **The service worker** caches no `/api/*` response and no HTML document, which
  is what keeps a shared school machine from serving one student's page to the
  next.
- **The Kernel's skeleton key** is only used for background work; calls about one
  student travel on that student's own token once `KERNEL_USER_SCOPED_AUTH` is on.
- **Prompt injection** is addressed in the system prompt: uploaded documents and
  teacher guidance are fenced and declared to be content, not instructions.
- **Cron endpoints** compare their bearer in constant time and refuse when the
  secret is unset — closed, never open, on a misconfiguration.

## Accepted risks, and why

These are decisions, not oversights. Revisit them when the reason changes. The
list is short now: everything else that was on it after the first three passes
was closed in the fourth, and the items that survived are recorded there with
the reason each one survived — no upstream fix to take (`@xmldom/xmldom`), no
read of anyone else's data at stake (six-character class codes), no security
boundary involved (wall-reaction dedupe), no credentials to hand
(`types/database.types.ts`).

**Styles still allow `'unsafe-inline'`.** A nonce covers `<style>` elements and
does nothing for `style="…"` attributes, which this design system uses on
roughly a hundred components. Removing it would tighten nothing the script rules
do not already cover, and would blank the interface. The remaining exposure is
CSS injection, which needs the same HTML-injection foothold the script rules now
deny and buys far less when it lands.

## Open, and needing a decision rather than code

**Adding a teacher is unilateral.** A school admin can attach any account to
their school as staff without that person accepting. After fix 4 the attacker
gains nothing they did not already have (they must know the email, and the
victim's data is not exposed by the membership), but the victim can be enrolled
in a stranger's school without being asked. There is already an invite-code
flow that does ask. Making direct-add an invitation is a product change, so it
is the owner's call.

**RLS policies are not all in `supabase/migrations/`.** Several were created
directly against the project, so the repo cannot be read as the whole story and
this audit could not verify them from source. Dumping the live policies into a
migration would make the database's own boundaries reviewable.

To be clear about which boundaries those are, because it is easy to conflate
them with the school flows: the staff code and the admin approval are checks
written in route files, and this audit read them. The unverifiable part is
elsewhere — the policies on `learning.conversation_files`, `learning.room_files`
and `storage.objects` that `/api/files/signed-url` leans on instead of doing its
own check. That route returns a signed URL when a row comes back, on the
reasoning that RLS would not have returned the row otherwise. It is the one
place where a policy this repo cannot show is the only thing between one
student's uploads and another's.
