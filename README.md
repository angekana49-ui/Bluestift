# Bluestift

**An AI tutor that refuses to do the homework, and a dashboard that tells teachers why.**

Bluestift is two products on one account:

- **Raya** — a Socratic tutor for students. It teaches by asking, escalating help
  only as far as the student actually needs, and it keeps a model of what they
  understand so the next session starts where the last one ended.
- **Bluestift Schools** — the staff side. Teachers see where a class is stuck and
  which students are drifting, without reading anyone's conversations.

The thesis: two private AIs — one the student uses alone, one the teacher uses
alone — widen the gap between them. Bluestift is the one that closes it.

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React, TypeScript |
| Data | Supabase — Postgres, Auth, Storage, row-level security |
| Cognitive engine | **Kernel**, a separate FastAPI service (see `docs/kernel-handoff.md`) |
| Models | Gemini primary, Groq fallback; Whisper (via Groq) for voice |
| Analytics | PostHog, opt-in, EU-hosted |
| Payments | Stripe (international card) and CinetPay (card + mobile money), behind one provider seam; sandbox provider for dev |
| Email | Resend |
| Hosting | Vercel |

Styling is inline-token-based rather than utility classes: `components/ui/tokens.ts`
for the connected app, `components/site/theme.ts` for the public marketing site.
They are deliberately separate systems.

---

## Getting it running

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

Minimum to get a usable local app:

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged work. **Never expose.** |
| `GEMINI_API_KEY` *or* `GROQ_API_KEY` | Raya replies at all |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sign-up is captcha-gated |

Everything else degrades gracefully when unset: no `RESEND_API_KEY` means emails
are skipped rather than failing, `BILLING_PROVIDER=sandbox` runs the full
pending → paid → activate loop with no external account, and the Kernel being
down costs personalisation, not the conversation. `.env.example` documents each
one and what happens when it's missing.

```bash
npm test          # vitest
npm run build     # next build
npm run gen:types # regenerate types/database.types.ts (needs SUPABASE_ACCESS_TOKEN)
```

---

## Layout

```
app/                    routes — pages and API handlers
  api/account/          data rights: age, export, delete, consent
  api/raya/             the tutor: chat (streamed), files, conversations
  api/school/           the staff side: classes, roster, insights, join
  api/cron/             scheduled jobs (Vercel Cron)
components/
  chat/                 one chat engine, shared by Raya and Raya-for-Schools
  site/                 the public marketing site + legal pages
  ui/                   design tokens, shared primitives, brand marks
  raya/                 the connected-app shell and settings cards
lib/
  compliance/           age assurance, export, erasure — see docs/compliance.md
  kernel/               client + types for the FastAPI cognitive engine
  raya/                 prompt, LLM routing, chat context assembly
  billing/              plans, seats, payments
  i18n/                 EN (canonical) + FR/ES/DE
supabase/migrations/    schema history
docs/                   architecture and handoff notes
test/                   vitest — pure logic only, no DB
```

### Database schemas

`public` (accounts, enrolment) · `learning` (conversations, rooms, challenges) ·
`schools` (the B2B side) · `rag` (uploads and embeddings) · `content` (public
site) · `kernel` (owned by the Kernel service — the app reads it, never writes).

Access is enforced **in Postgres**, not in the UI. Row-level security scopes every
read to its owner, and `public.users` grants `UPDATE` column by column so the
client can only write the handful of fields it's meant to.

---

## Things worth knowing before you change something

**Raya is one engine, two surfaces.** `components/chat/` is driven by a
`ChatConfig` adapter so the solo tutor and Raya-for-Schools stay identical in
behaviour. Fix a bug once.

**The prompt has a static and a dynamic layer.** `lib/raya/prompt.ts` holds
permanent teaching rules; the Kernel's read of the learner, and who the learner
is, are injected inside `<learner_state>` so the model treats them as data
rather than instructions. `FORMATTING_RULES` and `safetyLayer()` are exported
separately because the rooms and Schools routes build their own system prompts —
**a new student-facing surface must call `safetyLayer()`**, or it ships without
safeguarding.

**The age gate also teaches.** `lib/raya/audience.ts` turns the declared birth
year into a *band* (safety — always from the year) and a *stage* (pitch — the
declared school level wins). The year itself never reaches the model. An
estimated stage is a floor, never a ceiling, because the year rounds down.

**Model tier is routed, not fixed.** `lib/raya/routing.ts` sends a settled
student to the cheap tier and escalates on an active Kernel alert, low mastery,
or a fixed mindset. The bias is one-directional on purpose: spending more on a
struggling student is always safe. It is inert until `*_MODEL_FAST` / `*_MODEL_DEEP`
are set, which is also the rollback.

**Age gates everything.** Every app page checks `needsAgeGate(profile)` alongside
`account_state`. An account with no declared birth year cannot reach any surface.
See [`docs/compliance.md`](docs/compliance.md).

**Erasure is not a cascade.** Deleting the auth user misses the `kernel` schema
entirely (no foreign keys), plus embeddings and object storage. Use
`lib/compliance/erasure.ts`. **If you add a table with a `user_id`, add it there
and to `lib/compliance/export.ts`.**

**English is the source language.** `lib/i18n/en.ts` is canonical and its keys are
the type; the other locales are `Partial<Messages>`. "Bluestift" and "Raya" are
proper nouns and are never translated.

**The public site and the app do not share styling.** Editing a token in
`components/ui/tokens.ts` will not move the landing page, and vice versa.

**Payment rails sit behind one seam, and only one runs at a time.**
`lib/billing/payments.ts` exposes a `PaymentProvider` interface; `sandbox`,
`stripe`, `cinetpay` and `manual` implement it, and `BILLING_PROVIDER` picks one.
Call sites never name a provider, so adding a rail is a class, not a refactor.

Two things about this are worth knowing before you touch it:

- **Stripe and CinetPay are complementary, not alternatives.** Stripe does not
  process African mobile money — how most of our users would pay — and CinetPay
  has no international card presence worth the name. Today `BILLING_PROVIDER` is
  a single global choice, so selecting one genuinely means losing the other.
  Routing by the payer's region is a real, unbuilt change; the checkout page
  already renders only `provider.supportedChannels`, so a provider must never
  overstate them — Stripe's is `card` alone.
- **Zero-decimal currencies.** Stripe charges in the smallest currency unit, so
  $8 is `800` — but **XOF**, the CFA franc most of our schools would be invoiced
  in, has no minor unit. Multiplying it by 100 does not round oddly, it charges a
  hundred times the price. `stripeMinorUnits()` owns that rule; do not inline an
  amount conversion anywhere else.

The Stripe webhook verifies `Stripe-Signature` against the **raw** body with a
five-minute replay window, and refuses everything when `STRIPE_WEBHOOK_SECRET` is
unset. That is stricter than the CinetPay path on purpose: CinetPay's real
security boundary is a server-to-server status re-check, and Stripe has no
equivalent to fall back on, so the signature is all there is.

**The paywall is closed regardless.** All of the above is written and tested but
no customer can reach it yet — see Status.

---

## Privacy posture

Written up properly in [`docs/compliance.md`](docs/compliance.md); the short form:

- Anonymous accounts by default — no email needed to try Raya.
- We store a birth **year**, never a date of birth.
- Analytics is opt-in, and off entirely for anyone under 18.
- Under-13s can only reach Raya through a school (COPPA school-consent
  exception); we run no parental-verification mechanism of our own.
- Students can download everything held about them, including the Kernel's
  private model of their learning, and delete their account outright — from
  settings, no request form.
- Staff can export a student's education record for a parent (FERPA), but that
  record excludes the student's own conversations with Raya. A tutor you believe
  is being read is a tutor you stop asking real questions of.

Public pages: `/privacy`, `/terms`, `/dpa`, `/subprocessors`. They describe how
the code behaves, so **they change in the same commit the code does.**

---

## Status

Pre-launch. Live payments, transactional email at scale, and the recorded product
footage on the landing page are the known gaps. `docs/project-status.md` tracks
the honest version.
