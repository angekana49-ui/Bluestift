# Security

A record of the security audit of 6 September 2026 — six passes, the first
five within that one day: what they changed, and what they deliberately left alone. It is
written for the next person to touch these files, including a stranger, since
this code is open. Nothing here is a secret: an attacker who reads it learns
which doors are locked, not which are open.

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

**`@xmldom/xmldom` — patched, and the earlier entry here was wrong.** This
document previously recorded it as accepted because "no upstream fix exists to
take". That was a false inference from a true premise: mammoth does pin
`^0.8.6`, but 0.8.15 patches the flaw INSIDE that range and had been published
for over a fortnight when the claim was written. Nothing but the lockfile held
0.8.13. Taken with `npm audit fix` — no `overrides`, no `--force`, no semver
major, package.json untouched.

The unreachability analysis that made it low-priority still holds and is worth
keeping: the flaw is XML *fragment injection* during `requireWellFormed`
serialization; mammoth only parses, and the vulnerable branch needs an
`EntityReference` node that nothing in the library ever constructs. But "we
cannot fix it" and "it cannot hurt us" are different claims, and only the second
one was true.

The same run cleared a **high** advisory in `browserslist`, also in range. What
remains is the vitest chain (one critical, one high, three moderate), fixable
only by a semver-major upgrade of the test runner. Those are dev dependencies —
nothing there ships to a user — and a major bump of the runner beneath 750 tests
is not a thing to do blind at the end of a session. Production dependencies now
report zero vulnerabilities.

**Class codes stay six characters.** A guessed one enrols the guesser in a
class and grants no read of anyone else's data; redemption is rate-limited.

**Wall reactions still have no per-visitor dedupe.** Fixing it properly needs a
uniqueness constraint, and this audit does not write migrations. It is counter
integrity on a public marketing page, not a security boundary.

## Fifth pass: the last two, and one closed by the owner

### 16. Joining a school takes two people now — fixed

`POST /api/school/profs` wrote a `school_admins` row outright, so a school admin
could attach any account to their school without asking. Anyone can create a
school in one signup, so this was not a privilege held by a small set of people:
a stranger could make you staff somewhere you had never heard of, and list your
name and address to themselves in the process.

It now invites. A code is minted for that one invitation, emailed to that one
address, and the membership is created only when the invited person redeems it
at `/api/school/join-team` — the path that already exists and already requires
them to act. The code comes back to the admin too, with a flag saying whether
the email actually went, because `RESEND_API_KEY` is optional here and an
invitation nobody can deliver has to be one the admin can read out instead. It
is listed like any other code, so it can be copied or withdrawn.

Leaving stayed a direct action. Consent is needed to join an organisation, not
to be removed from one.

Two properties of that design, checked rather than assumed. The route can only
mail an address that already has a Bluestift account — it answers 404 otherwise
— and it is capped at forty an hour per admin, so it is a poor instrument for
sending mail to strangers. And the codes it mints do accumulate: nothing marks
one as used, because no column distinguishes a one-person invitation from the
school's shared code. They are bounded rather than unbounded — every active code
is deactivated at the year rollover (`rotateStaffCodeForYear`), each one is
listed in the team view and can be withdrawn there, and each is eight
characters from an unambiguous alphabet, so the exposure is a leak rather than a
guess. A `single_use` column would close it properly, and that is a migration,
which this audit does not write.

### RLS: confirmed by the owner, not by this audit

The earlier passes listed the policies created directly against the Supabase
project as unverifiable from source, because they are not in
`supabase/migrations/`. The owner has confirmed the configuration in Supabase is
correct. That is the authority here — this audit reads the repository, and the
repository does not contain them.

The point still worth keeping is where it matters: `/api/files/signed-url`
performs no ownership check of its own on the two id paths. It asks for a row
and signs a URL if one comes back, on the reasoning that RLS would not have
returned the row otherwise. Everything else in this codebase checks in the route
because the service role bypasses RLS; that route is the one place the database
is the whole boundary. Putting those policies in a migration would make it
reviewable by anyone reading the code, which is a different thing from being
correct — it already is.

### Types: needs a credential this audit does not hold

`types/database.types.ts` is behind the migrations, and `npm run gen:types` was
run: it failed because the Supabase CLI has no access token here, and the script
correctly refused to overwrite the file rather than replacing it with an error.
So one table, `learning.kernel_profile_snapshots`, is still reached through a
cast confined to a single call site in `lib/compliance/export.ts`.

Running `npm run gen:types` with `SUPABASE_ACCESS_TOKEN` set will regenerate the
file, at which point the typed client accepts the table and that cast stops
compiling — deliberately, so the workaround cannot outlive its reason.

## Sixth pass: the last of it

A final sweep, part of it run as a fan-out of independent auditors. It was cut
short by an account spend limit — six fresh-eyes lenses never ran, so this pass
is NOT a clean bill of health for the ground they were meant to cover
(dependency failure modes, the unexamined modules, correctness bugs, and an
adversarial read of the code written that day). What did complete is below.

### 17. The signed-URL route states its own predicate — fixed

It was the only route authorising an id-based read purely by "RLS returned a
row", three lines above a service-role signature no policy can refuse. The row
is still read through the RLS-scoped client — two nets, not a replacement — and
the route now also checks: `room_members` for the caller on the file's room, and
`conversations.user_id` for the caller on the file's parent.

Both predicates are easy to get wrong in the same direction. `uploader_id` looks
right and is wrong twice: on a room file it would break the sharing the feature
exists for (a room document belongs to the room, and every member may open it),
and on a conversation file it is a proxy for ownership that would refuse a
legitimate open on any row where the two diverge. `assertRoomOpen` is also
absent on purpose — a timed room that has ended is read-only, not unreadable.

### 18. Acknowledging alerts stopped being an N+1 — fixed

`POST /api/school/alerts/resolve` accepts up to fifty alert ids and asked two
questions about each one, in sequence, each costing its own round trips — up to
about 350 before anything was written, on a button teachers press daily. Both
questions are now asked once for the whole set (`getAlertOwners`,
`reachableStudents`), and the per-id refusals keep their exact precedence: an
unknown id still 404s before a foreign student 403s. The per-id helpers were
deleted so nothing can quietly regress to the old shape.

### 19. Joining a class is limited per account, not per address — fixed

`POST /api/school/join` was capped at thirty attempts per ten minutes per IP,
failing closed. That is the one endpoint where thirty children join at once from
one school's gateway, so the ceiling refused the flow the route exists to serve —
while barely inconveniencing an attacker, since a session is free and an IP
bucket is escaped with a proxy. It is now eight per ten minutes per ACCOUNT, so
guessing costs a fresh signup against the anonymous-signup cap, and a classroom
is never the thing being limited.

### 20. The last lint warning is gone — fixed

`components/site/KernelDiagrams.tsx` had a `useMemo` missing `conceptLabel`. Not
a bug: the function closed over exactly `tr`, which was already in the deps. But
the invariant was held by a comment the rule could not read, so `conceptLabel`
is now a `useCallback` on `tr` — machine-checked, same recompute cadence.

### Examined and deliberately left

**Wall-reaction dedupe is not worth the fix that was proposed.** A per-post
limiter bucket would block a NATted classroom on exactly the traffic this wall
is for — many people, one gateway, the same top post — and, because it replaces
one global bucket with one per post, it would RAISE what a single address can
insert per hour from a fixed 120 to three times the number of posts. The
fail-open global limiter is the better of the two.

**Six-character class codes stay.** The attack is untargeted — you cannot aim at
a named school without tens of millions of guesses — and a hit enrols the
guesser and exposes no other child's data.

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
the reason each one survived — no read of anyone else's data at stake
(six-character class codes), and no security boundary involved (wall-reaction
dedupe).

**Styles still allow `'unsafe-inline'`.** A nonce covers `<style>` elements and
does nothing for `style="…"` attributes, which this design system uses on
roughly a hundred components. Removing it would tighten nothing the script rules
do not already cover, and would blank the interface. The remaining exposure is
CSS injection, which needs the same HTML-injection foothold the script rules now
deny and buys far less when it lands.

