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
| `child` | < 13 | No self-serve account. School authorisation only. |
| `teen` | 13–17 | Full product. No analytics, no model-training opt-in. |
| `adult` | ≥ 18 | Full product, both opt-ins available. |
| `null` | undeclared | Treated as a minor and gated back to `/onboarding`. |

### Why the client cannot cheat it

`public.users` grants `UPDATE` **column by column** to `authenticated` — a
whitelist. `birth_year` and the consent columns are not on it, so a client
`update()` cannot touch them. The declaration goes through the server route,
which computes the band itself. `training_consent` was **revoked** from that
whitelist in the same migration for the same reason.

Existing accounts have no birth year, so they are gated too and sent through a
one-question `/onboarding`. That's the point: an age screen that only applies to
new sign-ups leaves the children already in the product uncounted.

### Under-13

We run **no verifiable parental consent mechanism** — no card check, no ID. The
only route in is the COPPA school-consent exception (16 CFR § 312.5(c)(6)): the
blocked screen takes a class code, and `/api/school/join` records
`minor_consent_source='school'` at the moment the school vouches.

If you ever want under-13 self-signup, that needs a real VPC provider. Do not
loosen `evaluateAccess` instead.

---

## 2. Data-subject rights

| Right | Endpoint | UI |
|---|---|---|
| Access + portability (art. 15/20) | `GET /api/account/export` | Settings → Your data |
| Erasure (art. 17) | `POST /api/account/delete` | Settings → Your data |
| Withdraw consent (art. 7(3)) | client + `POST /api/account/training-consent` | Settings → Your data |
| FERPA inspect & review | `GET /api/school/student/record` | Class → student → Download record |

Every one writes to `public.data_requests`. That table has **no foreign key to
users on purpose** — an erasure record must outlive the erasure it documents.

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
   dashboard (Supabase, Vercel, PostHog, Cloudflare), on request for others
   (Groq, Resend), in the contract for CinetPay, and the Cloud Data Processing
   Addendum for Google. These are what carry the Standard Contractual Clauses
   for EU transfers — the one item with no substitute if EU students use Raya.
   Update `/subprocessors` as each lands.
4. **EU representative (art. 27)** — required for a US-established company
   offering the service to people in the EU/EEA. Not needed until you actually
   have EU users.
5. **Records of processing (art. 30)** and a breach-response runbook: `/dpa` §6
   promises notification within 72 hours, so there should be a plan behind it.
6. **Counsel review.** None of this has been reviewed by a lawyer.

## 7. Known gap in Raya's prompt

`lib/raya/prompt.ts` does not yet carry the rules the legal pages assume:

- **No safeguarding rule.** `/terms` §3 says "involve a responsible adult" and
  "not a crisis service"; the prompt says nothing, so a student signalling
  distress currently meets a Socratic question. This is the one that isn't a
  legal problem — it's a human one.
- **No data-minimisation rule.** Nothing stops Raya asking a child for their
  full name, address or school. A tutor that asks is a collection channel.
- **No professional-advice boundary**, though `/terms` §3 excludes medical,
  legal, financial and psychological advice.
- **Raya can't answer "does my teacher see this?"** truthfully, although `/dpa`
  §7 now commits to an answer (no — staff see results and inferences, not
  transcripts).

Deliberately not fixed in the compliance work: the prompt is authored separately
and merging changes into it unasked is how prompt engineering gets lost.
