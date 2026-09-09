# The Bluestift app, explained

Reference material for Raya to draw on when someone asks how the app works,
what a button does, or where a setting lives. Two audiences, two sections:
**For everyday users** (students, teachers, school admins) comes first
because that's the common case; **For developers** is condensed on purpose —
depth lives in `README.md` and `docs/`, not repeated here.

**This is now actually wired in.** `lib/raya/app-guide-layer.ts` hand-condenses
the "For everyday users" section below into what's injected into every Raya
system prompt (solo, rooms, and Schools — see that file's own comment for why
it's a second copy rather than this file read at request time). If the app's
navigation, settings, or plans change, **update both files** — this one stays
the fuller reference; the other is what the model actually sees.

Written as of the account model current at the time this file was last
updated. If something here ever disagrees with what the product actually
does, what the product does is right — say so rather than insist on this
file.

---

## For everyday users

### One account, two products

Bluestift is **Raya** (a personal AI tutor) and **Bluestift Schools** (a
dashboard for teaching staff), sharing one account. Signing up asks "How
will you use Bluestift?" — Learn with Raya, or Teach/run a school — but
that's a starting point, not a lock: the same account can do both later
(e.g. a teacher who also has their own Raya for personal study).

### Getting started (what onboarding asks, and why)

One question per screen, in this order:

1. **Path** — learn with Raya, or teach/run a school.
2. **Year of birth** — the year only, never a full birth date. This sets
   both a safety floor (what's off-limits) and how Raya pitches
   explanations; a student can only get a *more* careful experience than
   their age implies, never less.
3. **Name** — a unique username (for sign-in and sharing) and a display
   name (what other people see).
4. *(Raya track)* **School level** — middle school, high school, university,
   or other — plus, optionally, a couple of subjects to start on and a
   one-line goal ("Understand my lessons more deeply and feel ready for
   exams" is the default).
5. *(Schools track)* **Role** — "I teach at a school" (join with the invite
   code your admin gave you) or "I run a school" (set up the school, its
   classes, and its access codes) — then a short optional note on what the
   school or the teacher's subjects are, to tailor the dashboard.
6. **Email + recovery** (optional at this point, strongly encouraged) —
   without it, progress lives only in this browser and can't be recovered if
   it's lost.

### Using Raya

The left/top navigation: **Chat**, **Rooms**, **Tools**, **Assignments**,
**My Kernel**, **Settings**.

- **Chat** — the tutor itself. Raya answers a question with a question when
  it can teach more that way, and gives a direct answer when scaffolding
  would just be friction. It remembers what a student has already shown they
  understand, so a new session doesn't restart from zero.
- **My Kernel** — "your mastery, concept by concept — not a single grade."
  Each concept shows a status (Mastered / In progress / To work on / New)
  and three bars: Knowledge, Retention, Application. This is Raya's actual
  model of the student, visible to them (never a single opaque score).
- **Rooms** — study with Raya in a small group. Creating one asks for a
  name, an optional subject, public (open to anyone) or private (invite-link
  only), an optional session timer (the room goes read-only when it elapses;
  "no timer" leaves it open until someone closes it), and optional context
  documents (up to 20 MB total) so Raya starts already knowing the material
  instead of asking the obvious questions.
- **Tools** — turn uploaded material (PDF, notes, Word, Excel, audio — audio
  gets transcribed first) into a summary, an MCQ quiz, flashcards, a mind
  map, an audio summary, or an infographic. Everything dropped in for one
  run combines into a single packet.
- **Assignments** — exams and exercises a teacher assigned to the student's
  class. Each is a single attempt; nothing shows here until a teacher sends
  one.

**Settings** (Profile row onward): **Profile** (name, photo, sign-in and
recovery), **Plan**, **My Kernel** (same page as the nav item — what Raya
has learned about you), **Shared links** (public links you've handed out,
e.g. from Tools or a shared document), **Privacy & data** (what's kept, and
how to export or delete it — see Privacy below), **Legal** (privacy, terms,
DPA, sub-processors), and — only on an account linked to a school —
**Active school** (which school you're currently acting under, if you
belong to more than one), **Billing & seats**, and **Team & classes**.

### Using Bluestift Schools

Tabs: **Overview**, **Classes**, **Classes & codes**, **Focus**, **Prepare**,
**Insights**, **Reports**, **Team**, **Billing**, **Archive**.

- **Overview** — the live snapshot: student count, how many were active in
  the last 7 days, how many are struggling, average mastery, and which
  classes need attention, each with its own alert count.
- **Classes** / **Classes & codes** — the roster and the join codes that put
  a student into a specific class (auto-approved or admin-approved,
  depending on how the school set it up).
- **Focus** — pick a class, then a student, to see their full cognitive
  detail (the same kind of concept-by-concept mastery view as My Kernel) and
  the teacher's own follow-up notes on them.
- **Prepare** — generate an exercise set or worksheet grounded in the
  class's *actual* gaps, as surfaced by the Kernel — not a generic
  worksheet.
- **Insights** — patterns across a class or subject over time.
- **Reports** — generate a shareable report (for a parent meeting, an
  administrator, etc.).
- **Team** — subjects, teachers, who's assigned to which class/subject, and
  invite-teacher links (share one; a teacher who opens it and enters the
  code joins instantly if auto-approve is on, otherwise their request
  appears here for approval).
- **Billing** — plans and billing history. Schools are billed **per enrolled
  student**, not per active user, so a quiet week doesn't change the cost.
  Self-serve online checkout is on a provider seam already built (card,
  and — where available — mobile money); until it's switched on for a given
  school, a recorded out-of-band payment (transfer, invoice) activates the
  plan instead.
- **Archive** — everything the school produced, organized by school year.

Important boundary: a teacher's dashboard shows *patterns* (mastery,
struggle, activity) — it does not expose the content of a student's actual
conversation with Raya.

### Plans, in plain terms

An individual Raya account starts **free**. A school account is billed
**per enrolled student** (the school's size, not how many people happened to
log in that week). See `/pricing` for current figures — they're read from
the plan catalogue, not hardcoded, so this file doesn't repeat numbers that
would go stale.

### Privacy, in plain terms

- No email required to start using Raya — anonymous by default.
- Only a birth **year** is ever stored, never a full date.
- Analytics is opt-in, and switched off entirely for anyone under 18.
- Whether a student's conversations can be used to improve the model is
  on by default for a solo adult (switchable off any time), off by default
  the moment the account is linked to a school, and never on for anyone
  under 18, regardless.
- A student can export everything held about them — including Raya's own
  model of what they understand — or delete the account outright, from
  Settings → Privacy & data.
- Under-13s can use Raya on their own with no email, no analytics, no
  training, and no public rooms; where a school enrols a child, the school's
  consent stands in for a parent's (the legal basis is spelled out in
  `docs/compliance.md` on a machine that still has that folder — it's
  local-only, not shipped).

---

## For developers

Condensed map — `README.md` is the fuller version of this section, and stays
the source of truth if the two ever disagree.

**Stack**: Next.js 16 (App Router) + React + TypeScript · Supabase
(Postgres, Auth, Storage, RLS) · a separate FastAPI **Kernel** service for
the cognitive model · Gemini primary / Groq fallback for the LLM, Whisper
(via Groq) for voice · PostHog (opt-in) · Stripe + CinetPay behind one
payment-provider seam · Resend for email · Vercel (app) / Railway (Kernel).

**Layout**:
```
app/          routes — pages and API handlers (api/account, api/raya,
              api/school, api/cron)
components/
  chat/       ONE chat engine — a ChatConfig adapter makes it serve both
              solo Raya and Raya-for-Schools. Fix a bug once, here.
  site/       the public marketing site + legal pages
  ui/         design tokens, shared primitives, brand marks
  raya/       the connected-app shell and settings cards
lib/
  raya/       prompt assembly (this file's neighbour), LLM routing,
              chat-context — the tutor's actual brain
  compliance/ age gate, export, erasure
  security/   the cross-site write guard
  kernel/     client + types for the FastAPI cognitive engine
  billing/    plans, seats, payments
  i18n/       en.ts is canonical; fr/es/de are partial and fall back to it
supabase/migrations/   schema history
docs/         architecture notes — kept local, not shipped (see repo's own
              .gitignore; ask the human running this codebase if you need
              one and can't find it)
test/         vitest — pure logic only, no live DB
```

**Rules that bite if you don't know them** (each one is a real incident this
codebase already had, not a hypothetical):

- A new student-facing chat surface **must** call `safetyLayer()`
  (`lib/raya/prompt.ts`) or it ships with no safeguarding.
- A new route that carries user content outward (chat, voice, uploads,
  tools, the Kernel) **must** run `ageGateResponse()`
  (`lib/compliance/api-gate.ts`) or an account with no declared birth year
  can reach it anyway.
- A new table with a `user_id` **must** be added to `lib/compliance/erasure.ts`
  *and* `lib/compliance/export.ts` — deleting the auth user does not cascade
  into the `kernel` schema, embeddings, or object storage on its own.
- Never inline a currency conversion for a payment amount — `stripeMinorUnits()`
  owns it, because XOF (the CFA franc) has no minor unit and `amount * 100`
  silently overcharges by 100x.
- `components/ui/tokens.ts` (the app) and `components/site/theme.ts` (the
  public site) are deliberately separate design systems — a token change in
  one never moves the other.
- "Bluestift" and "Raya" are proper nouns: never translated, never re-cased,
  in any locale.

**Before you ship a change**:
```bash
npm run typecheck   # tsc — clears generated types first; see README for why
npm test            # vitest, pure logic only
npm run build       # next build — the only check that sees everything
```
