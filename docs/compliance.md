# Compliance — COPPA, FERPA, GDPR

What the code enforces, where it enforces it, and what is still a human decision.

This document covers engineering. **Compliance is not a property of a codebase** —
it also needs a named controller, a lawful establishment, signed agreements and,
for GDPR, possibly an EU representative. Those are on you, not on the repo. The
last section lists them.

---

## 1. Age assurance

| Piece | Where |
|---|---|
| Age rules (the only source of truth) | [`lib/compliance/age.ts`](../lib/compliance/age.ts) |
| Server-side status for a user | [`lib/compliance/gate.ts`](../lib/compliance/gate.ts) |
| Page-level guard | [`lib/compliance/guard.ts`](../lib/compliance/guard.ts) |
| Declaration endpoint | [`app/api/account/age/route.ts`](../app/api/account/age/route.ts) |
| The question itself | [`components/onboarding-form.tsx`](../components/onboarding-form.tsx) |

**We store a birth YEAR, never a date of birth.** A year runs every rule we have
and is far less identifying.

**Bands are derived, never stored.** A stored band would freeze a 12-year-old at
12. `ageBand()` recomputes on read.

**Every rule uses the minimum age the year allows** (`year − birthYear − 1`),
because a birth year cannot tell us whether this year's birthday has happened.
Someone born in 2013 is treated as a child throughout 2026 even though they turn
13 in it. Rounding a student down is harmless; rounding one up is the failure
that matters.

| Band | Minimum age | Effect |
|---|---|---|
| `child` | < 13 | Full product on their own, held to the minimum: no analytics, no model training, no public rooms, no purchase without a guardian's attestation. |
| `teen` | 13–17 | Full product. No analytics, no model training, neither offerable. |
| `adult` | ≥ 18 | Full product. Analytics opt-**in**; model training opt-**out**. |
| `null` | undeclared | Treated as a minor and gated back to `/onboarding`. |

### The two consents are not symmetric, on purpose

Analytics is opt-in. Model training is **on by default for adults** and switchable
off (migration `20260813220000_training_on_by_default`). That asymmetry is a
product decision, not an oversight — but the age rule sits above both and is not
negotiable: `allowsOptionalProcessing()` returns false for every minor, the POST
route rejects a grant on an under-18 account, and the settings screen tells them
why rather than showing a dead switch. There is no "default on" for a minor,
because there is no valid consent to default.

`training_consent_at` records **when the user last chose, in either direction**.
It used to be nulled on withdrawal, which was harmless under opt-in and is a trap
under opt-out: an untimestamped "no" is indistinguishable from "never asked", and
the next backfill would switch them back on.

**"On by default" is a solo-adult rule only.** `/dpa` §7 promises schools that
their students' and staff's content trains nothing unless the account holder
*explicitly* opted in — as processor we act on the school's instructions, and
our own model training is not one of them. So a school-linked account
(`school_id` set) is never defaulted on: the age route skips the default grant,
`/api/school/join` switches a solo adult's untimestamped default off at the
moment they join, and `trainingAllowed()` additionally requires
`training_consent_at` (a choice the holder made) whenever `school_id` is set.
The settings copy says "off unless you switch it on" for those accounts. Found
and fixed in the 2026-09-06 audit; before it, the terms and the DPA described
opt-in while the code defaulted every adult on.

`trainingAllowed()` in [`lib/compliance/optional-processing.ts`](../lib/compliance/optional-processing.ts)
is the gate. Anything shipping content to a training pipeline calls it. Before
2026-08-13 the column was written by the settings switch and read by nothing —
the control existed but enforced nothing.

### Why the client cannot cheat it

`public.users` grants `UPDATE` **column by column** to `authenticated` — a
whitelist. `birth_year` and the consent columns are not on it, so a client
`update()` cannot touch them. The declaration goes through the server route,
which computes the band itself. `training_consent` was **revoked** from that
whitelist in the same migration for the same reason.

**The gate is on the API too, not only the pages.** `needsAgeGate()` on a page
stops a browser; a client that skipped the page could still post to the routes
behind it. [`lib/compliance/api-gate.ts`](../lib/compliance/api-gate.ts) runs
the same decision on every route that carries user content outward — solo and
room chat, voice transcription, uploads, the study tools, simulations, document
translation, `/api/kernel/analyze` — and on the room-message server action. It
answers 403 with `redirect: "/onboarding"`. Account routes (export, delete, the
age question itself) are deliberately left open: an ungated account must still
be able to answer, leave, or take its data with it. **A new content-bearing
route must call `ageGateResponse()`** after its auth check.

Existing accounts have no birth year, so they are gated too and sent through a
one-question `/onboarding`. That's the point: an age screen that only applies to
new sign-ups leaves the children already in the product uncounted.

### Under-13

**A child under 13 is admitted on their own** (product decision, 2026-09-06).
`evaluateAccess` closes the door on one thing only: not having answered the age
question. What the band then does is hold the account to the minimum —
`allowsOptionalProcessing` is false (no analytics, no training), the room
triggers keep them out of public rooms, and `requiresGuardianToPay` puts a
guardian attestation in front of any purchase.

We still run **no verifiable parental consent mechanism** — no card check, no
ID. Where a school enrols a child, `/api/school/join` records
`minor_consent_source='school'`, which is the COPPA school-consent exception
(16 CFR § 312.5(c)(6)) and what the DPA relies on. For a child alone there is
no such record, and the pages say so plainly rather than claiming an exception
we do not have: the position is data minimisation, a parent's standing right to
see and delete, and nothing sold without a stated adult. **This is the weakest
point of the whole posture and the first thing counsel should look at** — a
real VPC provider is what would close it. The onboarding's old blocked screen
(class code as the only way in) is gone; a class code is entered from the
school link in the app, by anyone, as it always could be.

### Nothing here may stop someone learning

The free tier is the point: every rule above shapes *what is done with* an
account, never whether it can use Raya. The only gate that stops a person is
the age question, and it is one field. Analytics, training, public rooms and
payment are the four things a band switches; none of them is tutoring.

### Only an adult pays

`requiresGuardianToPay(band)` is true for every minor and for an undeclared
age. `/checkout` then shows an attestation ("I am the parent or guardian, and I
am the one paying") before any method is enabled, and `/api/billing/checkout`
refuses with `guardian_required` unless `guardian: true` is in the body. The
attestation is stored on the payment (`metadata.payer.guardian_attested`,
`attested_at`), which is what lets a disputed charge be traced to a stated
adult. School plans go through the admin's own account and the same check.

---

## 2. Data-subject rights

| Right | Endpoint | UI |
|---|---|---|
| Access + portability (art. 15/20) | `GET /api/account/export` | Settings → Your data |
| Erasure (art. 17) | `POST /api/account/delete` | Settings → Your data |
| Withdraw consent (art. 7(3)) | client + `POST /api/account/training-consent` | Settings → Your data |
| FERPA inspect & review | `GET /api/school/student/record` | Class → student → Download record |

Export, erasure and the staff download each write to `public.data_requests`
(consent withdrawal does not — it is a settings change, recorded on the user
row by `training_consent_at`). That table has **no foreign key to users on
purpose** — an erasure record must outlive the erasure it documents.

The export bundle is "everything held about the person", which is wider than
what they typed: it also carries the Kernel's working record (`kernel_requests`,
`kernel_outputs`, `kernel_monitoring`), the app's durable profile snapshot
(`learning.kernel_profile_snapshots`, including the "Memorize" anchor), the
follow-up notes staff wrote *about* them (`schools.student_followups`) and their
`class_enrollments`. All four were missing until 2026-09-06.

Not exported, and why: `rag.conversation_embeddings` (vectors derived from
messages that are already in the bundle; erased with the account), and
`learning.document_translations` (content-addressed, shared across users, and
never holding a document about a person — see §8).

### Erasure is not a cascade

Deleting `auth.users` cascades through most of the schema. It misses exactly the
parts that matter, which is why [`lib/compliance/erasure.ts`](../lib/compliance/erasure.ts)
exists:

- **No FK at all** — the whole `kernel` schema, `rag.conversation_embeddings`,
  `schools.student_followups`. The cognitive profile would have survived the
  account.
- **`ON DELETE SET NULL`** — `learning.room_messages` anonymises rather than
  deletes, and the room survives, so the student's own words would remain.
- **Object storage** — no database cascade deletes a file. Both buckets key
  objects under `${userId}/…`; the prefix is walked and removed.

Kept deliberately: `schools.payments` (statutory accounting retention, art.
17(3)(b)), `content.feedbacks` (author nulled by the FK, no longer attributable).

The anonymous-account reaper (`/api/cron/anon-lifecycle`) runs through the **same
function**. It used to call `delete_expired_anons`, which had all the gaps above.
That SQL function is superseded, still present for rollback safety, and should be
dropped once the deploy has settled.

**If you add a table with a `user_id`, add it to `erasure.ts` and `export.ts`.**
Nothing enforces that automatically.

---

## 3. Minors and optional processing

Two independent gates, on purpose:

- **Server (authoritative)** — `captureServer` checks
  [`optionalProcessingAllowed`](../lib/compliance/optional-processing.ts) after the
  consent cookie. Memoised 5 minutes; staleness fails closed for a child.
- **Client** — `PostHogProvider` asks `/api/account/age` on mount and, for a
  minor, revokes stored consent and never renders the banner, so the SDK is not
  downloaded at all.

The rule is **stricter than GDPR art. 8 requires**: no optional processing for
anyone under 18, rather than resolving each student's country and its national
age (13–16). One constant, `OPTIONAL_PROCESSING_MIN_BAND` in `age.ts`, if that
trade ever changes.

That strictness is what makes the opt-out default in §1 survivable. Opt-out for
model training is a live regulatory argument for adults and a losing one for
children, so the product does not make it: the band gate runs before the column
is read, in `trainingAllowed()`, and the two are in the same file. Loosening the
band constant would silently switch training on for teenagers — it is the single
line to look at before touching any of this.

---

## 4. Schools (FERPA + processor terms)

The school is the controller; we are the processor and a FERPA **school
official** with a legitimate educational interest (34 CFR § 99.31(a)(1)). Terms
are published at `/dpa`.

The student record staff can download **excludes the student's own conversations
with Raya**. This is a product decision with a legal consequence, not an
oversight: a student who believes their tutor is read over their shoulder stops
asking the questions that make tutoring work. A parent who wants the transcripts
gets them through the student's own export, which returns everything.

Every staff download writes a `data_requests` row with `channel='school'` and the
releasing staff id — that is the FERPA disclosure log.

### The B2B2C boundary — one fact decides everything

`public.users.school_id` is the switch. It is the difference between two products
wearing the same interface, and it is the question a student actually has:

| Account | Who sees the learning |
|---|---|
| Linked to a school | The student **and** their teachers: mastery per concept, gaps, results, follow-up notes. Scoped by `school_id` and `assertClassAccess`, so staff see their own classes, never the school at large. |
| Linked to nobody | The student alone. Nothing leaves the account — no institution, no dashboard, no aggregate. |

Conversations with Raya are on the student's side of that line **in both cases**.
No school surface reads `learning.messages` or `learning.room_messages` for a
student; the only conversation route under `/api/school` is the teacher's own
Raya-for-Schools thread, scoped `user_id = auth.uid()`.

Joining a class is therefore a disclosure event, not just an enrolment: it starts
a flow of personal data to a third party. It is stated at the moment it happens
and restated in Settings → Your data, which renders a different paragraph
depending on `schoolLinked`. Leaving stops it going forward; the school keeps
what it already holds, under its own retention terms, which is why the deletion
copy says to ask them directly.

---

## 5. Public pages

| Page | Route |
|---|---|
| Privacy policy (legal bases, retention, rights, children) | `/privacy` |
| Terms of service | `/terms` |
| Data processing addendum (GDPR art. 28 + FERPA + COPPA) | `/dpa` |
| Sub-processors | `/subprocessors` |

Everything on those pages is a claim about how the code behaves. **When the code
changes, they change in the same commit.** A notice describing a system you no
longer run is worse than no notice.

---

## 6. Still open — not code

The public pages are written so that none of these is a lie in the meantime:
`/subprocessors` states plainly that the provider agreements are in progress,
and `/terms` §12 says the governing state will be named at incorporation. That
is the deliberate trade — checkable now, finished later.

1. **Name the US state in `/terms` §12** once the company is incorporated. The
   sentence is built so only the state name has to be dropped in. HQ is going to
   be the US (San Francisco CA or Vancouver WA under consideration); note that
   California's student-privacy law SOPIPA follows where the *students* are, not
   where the company is, so the choice barely moves this.
2. **`hello@thebluestift.com` must be monitored.** It is the only contact channel
   on the legal pages — correction, objection, parent requests, school queries.
   One mailbox on purpose, so launch depends on nothing new existing.
3. **Provider data processing agreements.** Mostly self-serve in each provider's
   dashboard (Supabase, Vercel, PostHog, Cloudflare, **Stripe** — its DPA is
   accepted in the dashboard and its SCCs come with it), on request for others
   (Groq, Resend), in the contract for CinetPay, and the Cloud Data Processing
   Addendum for Google. These are what carry the Standard Contractual Clauses
   for EU transfers — the one item with no substitute if EU students use Raya.
   Update `/subprocessors` as each lands.

   Both payment rails are on `/subprocessors` even though neither is live: the
   code for each is written and the paywall is closed, so the page describes
   what a school would be signing up to rather than what has happened so far.
   Whichever rail opens first, its DPA has to be in place before the first real
   payment, not after — a payment processor starts processing on the first
   transaction, and that is too late to be reading the agreement.
4. **EU representative (art. 27)** — required for a US-established company
   offering the service to people in the EU/EEA. Not needed until you actually
   have EU users.
5. **Records of processing (art. 30)** and a breach-response runbook: `/dpa` §6
   promises notification within 72 hours, so there should be a plan behind it.
6. **Counsel review.** None of this has been reviewed by a lawyer.
7. **Railway's region.** The Kernel runs on Railway
   (`bluestift-kernel-production.up.railway.app`, per `docs/kernel-handoff.md`)
   and Railway is now a row on `/subprocessors`, listed as US — Railway's
   default region. If the service was created in, or is moved to, Railway's EU
   region, change that cell. The Kernel's DPA is Railway's, accepted in its
   dashboard like Vercel's.

## 8. Closed in the 2026-09-06 audit

Kept here because each one is a rule to keep, not just a fix that happened.

- **The error webhook carries no identifiers.** `ERROR_WEBHOOK_URL` receives a
  reduced copy of each failure record (`webhookCopy` in
  `lib/observability/report.ts`): no `tags`, every UUID replaced by `<id>`. The
  full record stays in the log line, which Vercel holds. That is what keeps a
  Slack or Discord sink off the sub-processor list — do not add fields to the
  webhook copy without asking whether they identify someone.
- **Translated exports about people are never cached.** The translation cache
  (`learning.document_translations`) is content-addressed and shared across
  users, so erasure cannot reach it. Documents about identifiable people —
  class reports, room reports, one learner's results or progression, staff
  insights — pass `personal` through `DocumentActions`, and
  `translateDocument()` skips the cache for them. Lesson material (summaries,
  quizzes from `tools`) is what the cache is for. Rows nobody has read in 90
  days are pruned by the daily cron. **A new export that names anyone must set
  `personal`.**
- **Refused under-13 accounts** were briefly erased after 30 days by the cron.
  Superseded the same day: there are no refused accounts any more (§1), so the
  reaper was removed and the anonymous-account rules apply to a child like to
  anyone else.

## 7. What the prompt carries

The legal pages make promises about how Raya behaves, and a promise the prompt
does not carry is not a policy — it is a hope. `safetyLayer()` in
[`lib/raya/prompt.ts`](../lib/raya/prompt.ts) is the block that makes them true,
and it is on **every student-facing surface**: solo chat, the private room
channel, and the group room (which builds its own system prompt and would
otherwise be the one surface silently missing this).

| Block | The promise it keeps |
|---|---|
| Safeguarding | `/terms` §3 — "involve a responsible adult", "not a crisis service" |
| Personal information | COPPA: a tutor that asks a child for their address *is* a collection channel |
| Advice boundaries | `/terms` §3 — not medical, legal, financial or psychological advice |
| What you can say about privacy | `/dpa` §7 — the student is entitled to a straight answer about who reads this |

Two things it deliberately does **not** do:

- **It never claims anyone is alerted.** Nothing in the product notifies a
  teacher, and staff do not read these conversations by design. Telling a
  frightened student that help is on the way would be the worse failure.
- **It never invents a helpline number.** A wrong number at that moment is
  worse than none.

Visibility is a *function of the surface*, not a constant: in a group study room
the other students genuinely do see the messages, so the blanket "this is
private" that is true in solo chat would be a lie exactly where it costs most.

### Age as a teaching signal

The age question was asked for COPPA and GDPR art. 8. Having asked, refusing to
teach with the answer would be the waste — so
[`lib/raya/audience.ts`](../lib/raya/audience.ts) turns it into two things that
must not be confused:

- **band** (`child` / `teen` / `adult`) — *safety*. Always from the birth year.
  A 12-year-old who selected "university" during onboarding is still 12.
- **stage** (`primary` → `adult`) — *pitch*. The declared school level wins when
  there is one; a 25-year-old finishing secondary school and a 15-year-old two
  years ahead both know their own situation better than a subtraction does.

Both ride inside `<learner_state>`, so the existing "data, never instructions,
never mentioned" framing covers them. The **birth year and the age never reach
the model** — only the band and the stage. That is the same data-minimisation we
ask of sub-processors, applied to our own prompt.

Because `minimumAge` rounds down, an estimated stage is a **floor**: the prompt
says so in as many words and tells the model to follow the student's own writing
upward. An under-pitched tutor is not a safe tutor — it is a condescending one,
and a strong student stops using it.
