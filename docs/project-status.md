# Bluestift — project status

_Last updated: 2026-07-20. Living summary of what's built, how it works, and what's next._

Bluestift is an AI tutoring platform. **RAYA** is the Socratic tutor; the
**Cognitive Kernel** (separate Python/FastAPI service) does cognitive tracing.
One shared Supabase database. This repo is the **Next.js 16 (App Router, TS)** app.

---

## 1. Architecture

```
Next.js app  ──HTTP──▶  Kernel (FastAPI, Railway)
   │  (anon key + user session, RLS)      │ (service_role, no PostgREST)
   │  service_role for trusted writes     │
   ▼                                       ▼
        Supabase Postgres (one shared DB) + Storage
```

- **Providers**: LLM = **Gemini primary → Groq fallback** (cheap models); voice
  STT = **Whisper via Groq**. PDF read = Gemini multimodal. TTS/images = deferred.
- **Coordination contract**: `user_id` everywhere == `public.users.id` ==
  `auth.users.id`; `concept_id` → `kernel.concept_nodes.id`. Kernel writes
  `kernel.*` with the service_role key; the app never writes kernel tables — it
  calls the Kernel HTTP API and reads kernel tables.
- **Convention**: `text` + `CHECK` instead of native enums (matches the deployed
  kernel). Embeddings are `vector(768)` (Gemini).
- **DB**: project `Bluestift` (`mbvovxnfdptxvnhmdxew`, us-west-2). ~74 app tables
  across `public / learning / schools / rag / content` + the live `kernel`
  schema (source of truth, untouched).

---

## 2. What's built

### Auth & onboarding
- Anonymous-first sign-in + email magic-link (PKCE) via `@supabase/ssr`.
- **Turnstile** CAPTCHA on entry points. Trigger `handle_new_user` provisions
  `public.users` (+ 16-char recovery code, default username, onboarding event).
- **Profile photos**: public `avatars` bucket, upload in the account panel,
  shown in room member bandeau.
- **Enforced parcours: sign up/login → onboarding → home (Raya *or* Schools)**,
  keyed on `users.account_state` (`onboarding_pending` → `active_unverified` →
  `active_verified`). Single source of truth = **`lib/routing.ts`**:
  `resolveHome(userId)` (has a `school_admins` membership → `/school`, else
  `/chat`) and `resolvePostAuth(supabase, userId)` (pending → `/onboarding`, else
  `resolveHome`). `/auth/callback` + `/auth/confirm` route through it (a generic
  `next` of `/` or `/account` is resolved; an explicit deep link is honoured).
  Per-page guards remain as defence in depth.
- **`/login` is the always-reachable door.** It redirects only a *finished*
  account; a `onboarding_pending` one renders the login page with an amber
  `pendingSetup` banner ("Continue setup" → `/onboarding`, or "Use a different
  method" → sign out). `LoginView.clearPendingSession()` signs a stale session out
  before any of the three flows starts, and `onboarding-form.tsx` has a
  "← Use a different sign-in method" back slot. (Before this, tapping "Start
  anonymously" minted a session that trapped the user in `/onboarding`.) Abandoned
  accounts are never deleted — still reachable by recovery key.
- **Onboarding is a full-screen, role-aware step machine** (`components/onboarding-form.tsx`),
  BlueStift-branded, **one question per screen**, goal-gradient bar seeded at 28%:
  - Two tracks picked on screen 1 — `raya` (Learn with Raya) and `schools`
    (Teach or run a school). RAYA steps `[path, name, level, subjects, goal]`;
    school steps `[path, name, srole, focus, ready]`.
  - Anonymous accounts get a **6th screen** (`EmailStep`): optional email link +
    the **recovery key** (reveal/copy, 3 stated constraints), Continue gated on an
    "I saved my key" checkbox or a linked email.
  - **Welcome screen**: flock of birds + handwritten `writeReveal` hook.
  - **The account is NOT locked to a role** — intent is a router + signal only;
    real gates (invite codes, seat limits, role checks) live per surface. Finish
    routes: student → `/chat`; teacher/school → **`/school/enter`**, a resolver
    that picks admin dashboard / teacher dashboard / `/profile?intent=create`.
  - Shared chrome `components/ui/auth-chrome.tsx` (`AuthSplit`, `Logo`, `RayaName`,
    birds) is consumed by **both** onboarding and login so they stay identical.
- **Brand**: the tutor is written **"Raya"** (not RAYA) in a bold serif via
  `<RayaName/>`; Schools matches via `<SchoolsName/>`. Applied in onboarding +
  login; **not yet swept** across the rest of the app.

### RAYA chat (solo) — `/chat`
- **Streamed** replies (Gemini SSE → Groq SSE), dual-layer prompt (Markdown rules
  + XML `<learner_state>`), **structural EMT guardrail** (PUMP→HINT→ASSERTION→
  SUMMARY), Dweck feedback, replies in the student's language.
- **Voice input** (record → Whisper → send). Manual **"Analyze"** button →
  Kernel gap detection (root_gap/summary), downloadable TXT/PDF.
- Cognitive profile pulled from the Kernel via a **non-blocking cache**; the
  chat never awaits the Kernel. Every 3rd turn fires a background `/analyze`.
  Pedagogical **alerts** from the Kernel are injected into the next prompt.
- **Conversation history**: sidebar lists all solo conversations (new / switch /
  delete); titles auto-seeded from the opening message; `updated_at` bumped each
  turn so the active thread sorts to the top. API: `app/api/raya/conversations`
  (GET messages by id, DELETE by id).
- **Document upload (solo)**: 📎 attach a doc to a conversation → extracted text
  stored on `learning.conversation_files` → injected into the prompt as context
  every turn (`buildRayaMessages(..., docs)`). A doc can open a fresh chat.
  `app/api/raya/files`, attachments listed under RLS. **Requires the SQL in
  `docs/chat-docs.md`** (creates the table + RLS); until applied, upload errors
  and the chat degrades to no doc context.

### Schools / B2B — `/school`
- **Self-serve onboarding**: any signed-in user creates a school → becomes its
  `admin_master` (role CHECK = `admin_master` | `prof`), with an active current
  `school_years` row. Create form captures name + **city** + **country** (ISO code).
- **Multi-school**: a user can belong to **several schools** at once (admin of one,
  teacher of another). The /school app always shows exactly ONE — the **active**
  school, held in a `bs_active_school` cookie (`lib/school-active.ts`). Resolution
  is central: `pickActiveAdminRow(userId)` reads all `school_admins` rows and picks
  the cookie match, else the oldest; both `getAdminSchool` and `getAdminMembership`
  route through it, so every existing caller scopes correctly with no signature
  change. **Invariant: the UI and every request are always about the active
  school**, keeping `assertAdminMaster`/`assertClassAccess` coherent. Switching =
  `setActiveSchool` server action (validates membership, sets cookie, revalidates);
  the cookie is also set on create and on join-team. `SchoolSwitcher` renders in the
  `SchoolsShell` sidebar only when the user has >1 school.
  - **Where each action lives** (deliberate): **creating** a school happens in
    **Raya** (`components/teacher-link.tsx` on `/profile`) — "that's where all the
    users are"; the `/school` NoMembership screen only offers join-by-code.
    A teacher **adding** another school does it in the prof dashboard
    (`AddSchoolByCode` → `/api/school/join-team`).
- **Teacher ↔ school linking** (two complementary flows over one
  `school_admins {user_id, school_id, role:'prof'}` row): admin generates a
  `staff_invite_codes` row (Team tab) → teacher pastes it at
  `POST /api/school/join-team` → `auto_approve` gives instant membership, else a
  pending `school_join_requests` row the admin approves via
  `POST /api/school/requests`. Both mechanics ride ONE code type + a boolean.
  Note: `school_join_requests` has a **partial** unique index (`where
  status='pending'`), so upsert/ON CONFLICT is impossible — the route does
  check-then-insert. Membership ≠ class access: a prof sees nothing until an
  `assignments` row exists.
- **School settings (admin_master)** — a **Settings** tab edits name / city /
  country / **type** (CHECK: `primary`/`secondary`/`university`/`other`) / contact
  email / phone, and **uploads a profile photo (logo)**. `PATCH /api/school/settings`
  (whitelists `school_type`); `POST /api/school/logo` stores it in the public
  `avatars` bucket (service-role write) → `schools.logo_url`. `AdminSchool` now
  carries these fields.
- **Two roles (differentiated)**: `admin_master` (director/IT — whole school:
  Overview, Classes & codes, Team, RAYA, Reports) vs `prof` (scoped to their
  `assignments` = class×subject; sees only assigned classes, read-only). All
  write/analytics routes gated to `admin_master`; roster/student gated by
  `assertClassAccess` (admin_master OR assigned prof). `/school` renders a
  different UI per role; `getProfClasses`, `getTeam`.
- **Team management (admin_master)**: add subjects, add teachers by email/username
  (they must have a Bluestift account), assign teacher→class→subject (creates a
  `prof_subject_code`). `app/api/school/{subjects,profs,assignments,team}`.
- **Insights & Simulations (admin_master)**: reads Kernel-certified `class_insights`
  per class×subject (avg mastery, trend, top gaps, root causes, recommendation —
  read-only) and runs what-if **simulations** ("+N h/week of subject X") that
  project an outcome from that baseline. A simulation can be **scoped to a class**
  (optional, in addition to subject + focus) — `buildInsightsBaseline` then narrows
  the baseline to that class and adds its roster/risk snapshot to sharpen the
  projection (`classId` validated by `assertClassAccess`; class stored in the sim
  parameters). NOTE: the Kernel has no simulation endpoint, so the projection is a
  **grounded-LLM estimate** (verified: grounds on the baseline, low confidence when
  empty, no fabrication), persisted to `schools.simulations` (status `done`).
  `app/api/school/{insights,simulations}`,
  `getClassInsights`/`getSimulations`/`buildInsightsBaseline`, `components/school-insights.tsx`.
- **LMS (admin_master)**: **Google Classroom = real OAuth** — connect
  (`/api/school/lms/google/start` → Google consent), callback stores access/refresh
  tokens in `lms_connections`, **Sync courses** (`/google/sync`) pulls
  `courses.list` into `lms_class_mappings`, then each imported course is assigned to
  an internal class (`PATCH /api/school/lms/mappings`). Token refresh handled.
  `lib/lms/google.ts`, `docs/lms-google-setup.md`; needs `GOOGLE_CLIENT_ID/SECRET`
  + a Google Cloud project (the live flow can't run without them). Other providers
  (`powerschool`/`canvas`/`minesec`) remain a **manual registry, no live sync**.
  Not done: roster import + recurring background sync.
- **Classes & access codes**: create classes (with an optional **effectif** `n` =
  `classes.expected_size`; `max_overflow` set to 5 → **hard cap `n + 5`**), edit the
  effectif later **inline** on the class card (`PATCH /api/school/classes`,
  admin_master; `null` clears the limit — cheap, non-cascading, never evicts existing
  students), generate/deactivate per-class join codes (unambiguous 6-char). The
  dashboard shows `studentCount / capacity`. The **student join enforces the cap**: a
  student new to a full class is refused (409); re-joining the same class is always
  allowed; no effectif set → no cap. Closes the loop with the student-side join.
  **Billing caveat (not yet built)**: the per-class `n+5` is a pedagogical guardrail,
  NOT a seat/revenue control — 5 extra seats × many classes would leak paid capacity.
  When billing lands, gate the **school-wide** total against the plan's seats
  (`schools.subscription_tier` / `class_enrollments`) *above* the per-class cap; that
  makes the per-class overflow harmless for revenue.
- **Overview (Établissement)**: school-wide roll-up — total students / active
  (7d) / alerts / avg mastery, plus a per-class summary (size, active, alerts,
  avg mastery) drilling into each class. `GET /api/school/overview`.
- **ClassView**: per-class roster (from `student_identities`) merged with each
  student's latest `kernel.student_risk_assessments` (status, sessions, last
  active, avg mastery, mindset). Graceful empty states.
- **StudentView**: one student's cognitive detail — KCs (`kernel
  .student_concept_state` × `concept_nodes`), mindset (`student_mindset_state`),
  latest RAYA insight (`individual_insights`), risk summary, plus a **personal
  learning graph** — an inline SVG of the student's concepts + the prerequisites
  they build on (`kernel.concept_edges`), laid out in prerequisite-depth layers,
  nodes coloured by mastery. A red *foundation* node (a prerequisite the student
  hasn't studied) surfaces the root gap holding back everything below it.
  `getStudentDetail` builds `graph {nodes, edges}` (verified against live kernel
  data: 280 prerequisite edges available); `LearningGraphView` renders it.
- **RAYA for Schools**: now the **same chat as the Raya student chat** — one shared
  core (`components/chat/*`, a `ChatConfig`-driven engine + surface) powers both, so
  they can't drift. `components/school/school-raya-chat.tsx` (`SchoolRayaChat`) fills
  the RAYA tab (contentFlush → single header) in **both** the admin and prof faces,
  with streaming replies, **voice input** (reuses `/api/raya/transcribe`), **document
  upload**, persisted **history** (in-tab popover), and a right panel = **directives**
  + a derived **notifications** feed. Grounded in `buildSchoolContext`/`buildProfContext`
  + active `school_directives` + attached docs; answers only from the snapshot.
  Backend mirrors the Raya routes: `POST /api/school/raya/chat` (streamed, persists to
  `learning.conversations` with `context_type='school_analytics'` + `school_id`),
  `GET/DELETE /api/school/raya/conversations`, `POST/DELETE /api/school/raya/files`,
  `GET /api/school/notifications`. No migration (the schema already allowed it).
  Replaced the old thin `components/school-raya.tsx` (deleted).
- **Reports**: generate a grounded Markdown performance report by **subject /
  class / school** (LLM, same grounding; verified 4-section structure, real
  figures, no hallucination), downloadable TXT/PDF, with a persisted past-reports
  list. `app/api/school/reports` (POST generate / GET list+subjects),
  `build{Class,Subject}Context`, `getSchoolSubjects`, `components/school-reports.tsx`.
  Persisted to `schools.reports` — CHECK values confirmed by probe and verified:
  `scope ∈ {school,class,subject}`, `format ∈ {pdf,md}` (we store `md`),
  `status ∈ {ready,generating,failed}` (we store `ready`). Subject reports match
  `concept_nodes.subject` to the subject's code/name.
- **Billing (admin_master)** — a **Billing** tab shows the current plan, a live
  **seat meter** (students used / contracted seats), and billing history. Six
  seeded plans in `schools.subscription_plans`, split by `price_unit`:
  **B2C flat/month** — `student_free` (0), `student_plus` (6.99), `student_max`
  (19.99); **B2B per student/month** (`price_unit='per_seat'`, price = per-seat
  rate) — `school_standard` (1.5), `school_plus` (2.3), `school_custom` (3.0).
  B2B `seat_limit` is NULL at plan level: the **contracted headcount is set per
  subscription at activation** and both caps joins (seat gate) and multiplies the
  price. Amount for the term = rate × students × months. **Billing basis = enrolled
  effectif, NOT usage** (decided): a school pays for the students it enrols, not the
  subset active that month. The contract field is **prefilled from the sum of declared
  per-class effectifs** (`declaredEffectif`) and floored at the real headcount; the
  agreement is stated explicitly in the Billing tab. (Numbers calibrated for
  the Western primary market; a region/currency PPP price-book for other markets
  is a future layer on the same shape.) Payment is **manual for now**: the
  admin activates/upgrades a plan once payment is received out-of-band (transfer /
  mobile money / invoice / card), recording method + reference + amount + term →
  writes a `schools.subscriptions` row (active) and repoints
  `schools.subscription_tier` / `subscription_expires_at`. A **Stripe-ready payment
  seam** (`lib/billing/payments.ts`, `PaymentProvider`/`getPaymentProvider`) lets a
  future Stripe provider return a Checkout redirect without touching call sites.
  The **school-wide seat gate is enforced at student join** (`resolveSeatGate`):
  total school headcount (real `student_identities` count, non-gameable) must stay
  ≤ the plan's seats, checked **above** the per-class `n+5` cap and only for a
  student new to the school. Effective seats = `subscriptions.seat_limit` (custom
  override) → `subscription_plans.seat_limit` → null. **Ungated by design** when a
  school has no seat-limited plan or is in its `pilot_until` window, so onboarding /
  free schools are never blocked; the gate bites once a paid plan is attached.
  `lib/billing.ts`, `app/api/school/billing` (GET state / POST activate),
  `app/api/billing/plans` (public catalog), `components/school-billing.tsx`. The
  student Settings **Billing card** now reflects the real seeded free plan.
  Migration: `billing_seat_limits_and_plan_seed` (adds `seat_limit` to plans +
  subscriptions, `payment_reference`/`amount` to subscriptions, seeds the 3 plans).
- **Online checkout (self-serve) — BUILT, sandbox-only.** One **single aggregator**
  bundling **card / mobile money / PayPal** as channel buttons (not 3 integrations),
  serving both B2C students and B2B schools; chosen for the francophone-Africa
  market. **No real merchant account/keys exist yet** — `sandbox` is the only
  working provider; the CinetPay path is scaffolded and untested against the live API.
  - No new subscription table: `schools.subscriptions` already has a nullable
    `user_id` beside `school_id`, so it holds both B2C and B2B. Migration
    `billing_payments_lifecycle` adds **`schools.payments`** (provider, provider_ref,
    status `pending|paid|failed|expired|cancelled`, channel, audience `b2c|b2b`,
    plan, seats, months, amount, currency, …). RLS on, **no policies** (service-role
    only — the `rls_enabled_no_policy` advisor is intentional).
  - Seam `lib/billing/payments.ts` — `PaymentProvider {createCheckout,
    parseNotification}`; `CheckoutResult` is `{mode:'redirect',url,providerRef}` or
    `{mode:'manual'}`. `getPaymentProvider()` reads `BILLING_PROVIDER` (default
    `sandbox`), using CinetPay only when its key + site id are set. The aggregator
    always **re-verifies** via `/v2/payment/check` — never trusts the webhook POST.
  - **Idempotency**: `markPaymentPaid` claims the row with a conditional UPDATE
    `where status='pending'`, so a replayed webhook returns the existing sub instead
    of activating twice; on activation-write failure it rolls status back to pending
    so a retry completes. The activation writers here are **deliberately
    self-contained** (not shared with the manual admin path in `lib/billing.ts`) —
    ~15 duplicated lines on purpose, to keep the proven money path untouched.
  - Routes: `POST /api/billing/checkout` (authed; **amount resolved server-side**
    from the plan, never from the client; B2B requires admin_master + `seats ≥` the
    current used-seat floor) and `POST /api/billing/webhook/[provider]` (public, the
    PSP is the caller). UI: `/checkout`, `/checkout/sandbox` (approve/decline),
    `/checkout/return` (reads the **real** status from the DB, so it's truthful even
    if the browser returns before the webhook).
- **Region price book (PPP) — BUILT, CFA zones only.** Model = per-student regional
  rate; bundles were dropped into Custom (team-negotiated). Migration
  `billing_region_price_book` adds `schools.plan_region_prices`, seeded with CFA
  per-student **Standard 200 / Plus 300** in both XAF (CEMAC) and XOF (UEMOA).
  An empty table falls back to the base USD price, so it's non-breaking.
  `lib/billing/regions.ts` is pure: `zoneFromCountry`, `ZONE_CURRENCY`,
  `ipCountryFromHeaders`, `formatMoney`, and **`detectZone`** — a double-layer
  honesty gate where the declared country AND the IP must *both* resolve to the same
  CFA zone to get the cheaper price (mismatch → USD; no IP signal in dev → trust
  declared). CFA is pegged to EUR (655.957) — explicit local amounts, **no live FX**.
  Checkout charges and `/checkout` displays through the same resolver.
  **Deferred on purpose**: B2C African prices (no b2c regional rows, and
  `public.users` has no country column), the manual Billing-tab path (stays USD
  reference until `subscriptions.currency` exists), and the public `/pricing` page
  (pre-auth, no declared country).
- Untyped service-role clients for the `schools` (writes) and `kernel` (reads)
  schemas; every route asserts `school_admins` membership. Minimal styling — the
  real design template is planned separately. Files: `app/school/`,
  `app/api/school/{create,classes,codes,roster,student}`, `components/school-admin.tsx`,
  `lib/school-admin.ts`.

### Learning profile — `/profile`
- Student-facing **K/V/P/M view**: per-concept mastery bars (Knowledge/Retention/
  Application) with status badges (mastered/partial/gap/new) + a Mindset (M) card,
  fed by the Kernel `/load_profile`. Client-fetched with loading/empty/error
  states (never blocks; degrades gracefully when the Kernel is down). API:
  `app/api/kernel/profile` (auth'd GET proxy, `user_id` from session).
- **Progress curve**: line chart of graded score % over time (self-tests + room
  challenges), from app-owned `challenge_attempts` (server-fetched, typed). Inline
  SVG, hover crosshair + tooltip, empty state. `components/progress-curve.tsx`.
- **What-if simulation (student)**: the learner mirror of the Schools admin
  projection — "if I put +N h/week into focus X, where could I get?". Baseline is
  the student's OWN Kernel profile (`kernel.loadProfile`); `current_mastery_pct` is
  overwritten server-side from the real profile so it can't drift. Same caveat as
  school sims: the Kernel has no simulation endpoint, so it's a **grounded-LLM
  estimate**. Kernel down → thin baseline, low confidence, never blocks. Persisted
  to `learning.student_simulations` (migration `student_simulations`, RLS
  `user_id = auth.uid()`); POST runs + saves, GET lists the last 20.
  `app/api/simulations`, `components/student-simulation.tsx` (card under
  CognitiveProfile, dismissible result + collapsible history).
- **School link**: student joins their school by **class access code** + real
  first/last name. The code (`schools.class_access_codes`) resolves the class →
  school; the real name is stored school-private in `schools.student_identities`
  (NOT on the public profile), and `users.school_id`/`school_year_id`
  (+`class_enrollment_id` when a billing row exists) are set. `POST
  /api/school/join`, `components/school-link.tsx`, `lib/school.ts`, schools-scoped
  admin client. **Requires the SQL in `docs/school-link.md`** (creates the table +
  RLS) — until applied, the card just shows the join form.

### Tools — `/tools`
- Upload → **extract text** (`lib/extract.ts`): txt/md/csv, PDF (Gemini), audio
  (Whisper), .docx (mammoth), .xlsx (SheetJS). File kept in private `user-media`.
- Generate **Quiz** (JSON mode), **Summary**, **Flashcards** (flip Q/A), and
  **Mind map** (topic → branches → points) — all LLM/JSON, downloadable TXT/PDF,
  re-openable from the library.
- **Self-tests** (solo challenges): create from topic/goal/file → take →
  server-graded score persisted → progress list.
- **Unified library**: past files (Open), generations (View), and self-tests
  (View reopens the test).
- **Dismissible results**: every generated element can be closed (✕) once read —
  Tools outputs (summary/quiz/flashcards/mind-map), the Chat Kernel-analysis panel,
  the Rooms session report, and School reports. (In-view dismiss; the persisted
  copy stays in its library/history.)

### Rooms — `/rooms`, `/rooms/[id]`
- List split "Your rooms (N)" vs "Discover"; create/join.
- **Visibility (creator-set)**: **public** (listed in Discover, anyone can join)
  vs **private** (hidden from Discover; joinable only via the **invite link** —
  the room's unguessable UUID URL). Discover queries `visibility='public'`; "Your
  rooms" still shows my private rooms. The room page falls back to a service-role
  read so invite-link holders reach the join screen even when RLS hides the room;
  `joinRoom` writes the membership with the service role so a not-yet-member can
  join a private room. Creator sees a "Copy invite link" button.
- 5 channels: **Group** (live chat via Supabase Realtime + "Ask RAYA"),
  **RAYA private** (streamed 1:1), **Challenges** (LLM MCQ, server grading,
  leaderboard), **Files** (upload + context + Open), **Report** (LLM group report,
  TXT/PDF). Member bandeau with names, online presence, avatars.
- **Session timer (optional, 10–60 min)**: the creator picks a "Session length"
  (default = No timer, opt-in). Once `timer_ends_at` passes the room goes
  **read-only** — members still read the thread and generate the session report,
  but no new messages / Raya calls / challenges / uploads. Enforced **server-side
  on every write path** via `lib/rooms.ts` (`roomExpired`, `assertRoomOpen`):
  `postRoomMessage`, `/api/rooms/raya`, `/api/raya/chat` (when `roomId`),
  `/api/rooms/files`, `/api/challenges/create`. No migration needed —
  `learning.rooms` already had `timer_status`/`timer_started_at`/`timer_ends_at`
  (added by hand to the generated types; don't regenerate). UI: live countdown
  badge (amber ≤2 min, red "Ended") + read-only banner + disabled composers.
  Known gap: challenge **submit** isn't server-guarded (UI-only).
- **Shared documents**: every member sees & opens uploaded files. A new upload is
  **livestreamed** to the Group channel as a "📄 shared a document" notice
  (a `room_messages` row flagged `has_media`, fanned out by Realtime). The
  private RAYA channel doesn't broadcast, but **RAYA draws on the room's shared
  documents** as context.

### Public site — `/`, `/research`, `/survey`, `/contact`, `/feedback`
Built from the approved mockups (`landing/research/survey-thebluestift.jsx`,
in Downloads); French copy, light theme, per-surface signature accents (teal /
academic green / amber), Inter + Georgia italic. Shared `PublicNav` /
`PublicFooter` / tokens in `components/public/`. Backed by the **`content`**
schema via `createContentAdminClient()` (untyped, like `schools`) — reads/writes
go through `lib/content.ts` + `app/api/content/*`, all public POSTs are
**Turnstile-verified server-side** (`lib/turnstile.ts`, `TURNSTILE_SECRET_KEY`;
skipped when unset in dev).
- **Landing `/`**: cloud hero, feature strip, how-it-works, differentiators,
  pricing (Élève gratuit / Classe $29 / École sur devis) — CTAs wired to
  `/login`, `/survey`, `/contact`.
- **Research `/research`**: published `research_posts` (type ∈ paper/experiment/
  article/update; first = "À la une", type filters), authors via
  `research_post_authors`→`research_authors`; detail at `/research/[slug]`
  (abstract = first paragraph, media: image/video/pdf). Newsletter tab:
  subscribe → `research_subscribers` (idempotent) + archives from
  `newsletter_issues`. Collaborations tab (static researcher list) and
  "+ Proposer" → `contributions` (status `pending`).
- **Survey `/survey`**: teacher (6 q) / student (5 q) flows from the mockup,
  one POST at the end → `survey_responses` (+`survey_answers`,
  `time_to_complete_seconds`, completed=true), done screen can attach an
  early-access email. **Expression libre** wall: `survey_posts` (student/
  teacher/anonymous) + 💛/🔥 reactions (`survey_post_reactions`,
  resonates/important; client-side dedupe). Landing stats are real DB counts.
- **Contact `/contact`** → `contact_messages` (source `form`);
  **Feedback `/feedback`** → `feedbacks` (type/rating 1–5/message,
  `user_id` attached when signed in).
- **CHECK values (probed)**: research_posts.type {paper,experiment,article,
  update}, .status {draft,published}; feedbacks.type {bug,praise,feature,
  suggestion,other}, rating 1–5; contributions.status {pending,approved,
  rejected}; contact_messages.source {form,email,whatsapp};
  survey_responses.profile {teacher,student,other}; survey_posts.profile
  {teacher,student,anonymous}; reactions {resonates,important};
  research_media.type {image,video,pdf}.
- **Contribution attachments**: the "+ Proposer" form now accepts a **document**
  (paper/dataset/slides, 15 MB max) → stored in the private **`contributions`**
  bucket (service-role upload), path kept on `contributions.storage_path`. The
  contribute route takes multipart now (`app/api/content/contribute`).
- **Footer**: the "Tarifs" link was replaced by **Écoles → `/school`**.
- Not done: admin authoring UI for posts/newsletter (insert via dashboard),
  newsletter sending, `survey_post_reactions` per-user dedupe server-side,
  signed-URL viewer for contribution attachments in an admin UI.

### Design system & app shell — **the whole signed-in app is now on it**
Built from `design_handoff_raya_schools_app/` (a prototyping-tool mockup — a *style*
spec, not a behavior spec). `components/ui/` is the single source of truth:
- `tokens.ts` — `getTheme(isDark): AppTheme` (values verbatim from the references),
  font stacks, radius, status colors. `theme.tsx` — `useDarkMode()` (localStorage,
  mount-only read to avoid hydration mismatch, cross-tab sync), `AppThemeProvider`/
  `useAppTheme`, and `useResolvedTheme` (context-or-standalone, for components used
  both inside and outside the shell — e.g. `auth-panel` on `/login`).
- `shell.tsx` — `AppShell` (fixed cloud image + haze), `Sidebar`/`NavItem`/
  `SidebarProfile`, `MainCard`, `RightPanel`, `IconButton`. `icons.tsx` (inline line
  icons), `widgets.tsx` (`KpiTile`, `MasteryGauge`, `ProgressBar`, `SegTabs`,
  `Avatar`, `Bird`), `forms.tsx` (shared themed `panelCard`/`textInput`/`ctaButton`).
- **Rule: the page owns the theme** (`useDarkMode()`) and passes it in — one dark
  mode source of truth, no duelling contexts.

Wired surfaces: `/chat`, `/tools`, `/profile` ("My Kernel"), `/rooms`, `/rooms/[id]`,
`/account` ("Settings"), `/onboarding`, `/school`, plus `/login` (standalone, no shell).
`RayaShell`/`RayaScaffold` is the student chrome; `SchoolsShell` the Schools chrome
(its sidebar nav drives in-page tab state — school-admin stays one big tab component,
not routes). **UI copy is English** across every real route (owner override of the
handoff's French); the `/preview` mockup harness stays French and dev-only.
- **Logos split**: the Schools dashboard uses the BlueStift bird
  (`/bluestift-mark.png`); the **Raya assistant panel** carries the Raya rosette
  (`/raya-mark.png`, violet in dark). Rule: dashboard = Schools mark, assistant = Raya mark.
- **Prof face**: `getProfContext(userId)` gives `{schoolName, subjects[]}`; the prof
  profile chip reads "Teacher · Math, Physics", and the Schools Raya tab is a real
  full-height chat (`fill` prop) rather than the admin's compact card.
- **UX-psychology pass** (deliberate, commented in code): goal-gradient + IKEA effect
  in onboarding; smart defaults in self-tests and room creation; **honest** loss
  aversion in the anon `auth-panel` ("your progress isn't safe yet" — true for anon
  accounts). The contrast/anchoring principle was **deliberately skipped** — faking a
  high price anchor while billing was a placebo would have been manipulative.

### Kernel integration
- `lib/kernel/client.ts` (typed, 6s timeout, sends `Authorization: Bearer
  $KERNEL_API_SECRET`), `profile-cache.ts` (non-blocking), `/api/kernel/health`
  (liveness + `/ready`), `/api/kernel/analyze` (auth'd proxy, input clamped),
  `/api/kernel/profile` (auth'd `/load_profile` proxy for the `/profile` view).
- Loop: chat (every 3rd turn) and challenge submit fire background `/analyze`.

---

## 3. Setup / config (must be done in Supabase)

Env (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `KERNEL_API_URL`, `KERNEL_API_SECRET`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (public-form captcha —
skipped when unset), `GEMINI_API_KEY`, `GROQ_API_KEY`, `GEMINI_MODEL`,
`GROQ_MODEL`, `GROQ_WHISPER_MODEL`.

Dashboard: enable Anonymous + Email providers; Turnstile secret (Attack
Protection); Resend SMTP; URL config (Site URL + redirect allowlist); expose
schemas (`public, graphql_public, kernel, learning, schools, rag, content`).

SQL applied (columns, `service_role` grants, realtime publication, `avatars`
bucket + policies, RPCs `room_roster` / `challenge_leaderboard`). Kept in
`docs/*` and this repo's history. **Note**: if you regenerate `types/
database.types.ts`, remove the `__InternalSupabase` block (it breaks writes with
the installed supabase-js).

---

## 4. Key files

| Area | Files |
|---|---|
| Supabase clients | `lib/supabase/{client,server,proxy,admin}.ts`, root `proxy.ts` |
| RAYA | `lib/raya/{prompt,llm}.ts`, `app/api/raya/{chat,transcribe}` |
| Kernel | `lib/kernel/{client,types,profile-cache}.ts`, `app/api/kernel/*` |
| Tools | `components/{tools,solo-challenge}.tsx`, `lib/extract.ts`, `app/api/tools/*` |
| Rooms | `components/{room-view,rooms-list,room-challenges,room-files}.tsx`, `app/api/rooms/*`, `app/api/challenges/*` |
| Auth | `components/{auth-panel,login-view,onboarding-form,turnstile}.tsx`, `components/ui/auth-chrome.tsx`, `lib/routing.ts`, `app/auth/*`, `app/{login,account}/` |
| Design system | `components/ui/{tokens,theme,shell,icons,widgets,forms}.tsx`, `components/raya/raya-{shell,scaffold}.tsx`, `components/school/schools-shell.tsx`, `app/globals.css` |
| Schools | `lib/{school-admin,school-active}.ts`, `app/school/{page,actions}.tsx`, `app/school/enter/`, `app/api/school/*`, `components/school-*.tsx` |
| Billing | `lib/billing.ts`, `lib/billing/{payments,payments-data,regions}.ts`, `app/api/billing/*`, `app/{checkout,pricing}/`, `components/{school-billing,checkout/*}.tsx` |
| Public site | `components/public/*`, `lib/{content,turnstile}.ts`, `app/{research,survey,contact,feedback}/`, `app/api/content/*` |
| Export | `lib/export.ts` (TXT + jsPDF) |

---

## 5. What's missing (honest gaps)

**Big pillar — Schools / B2B**
Essentially **built out**: self-serve creation, multi-school membership + switcher,
classes/codes/effectifs, two differentiated roles, team invites & join requests,
ClassView, StudentView + learning graph, class insights, simulations, Raya-for-Schools,
reports, Google Classroom OAuth + course sync, billing (plans, seat gate, manual
activation, online checkout, regional price book). What's genuinely left:
- **Real payment keys** — the checkout loop only runs against `sandbox`; CinetPay is
  scaffolded but never exercised against the live API, and no merchant account exists.
- **LMS**: roster import + recurring background sync (courses sync works; other
  providers are still a manual registry).
- **A real Kernel simulation endpoint** — both the school and student projections are
  grounded-LLM estimates today.
- RAG (`school_documents`) deferred — a broader concern than schools.
- **Student ↔ school link**: **done** (see `/profile` + the Schools loop above).

**Student-side gaps**
- **Cognitive feedback to the student**: K/V/P/M shown at `/profile` and a graded
  progress curve over time (from `challenge_attempts`). Still missing: the
  Kernel's per-concept `learning_trajectories` curve and `individual_insights`
  narrative (both live in the `kernel` schema — not in the generated types and no
  read endpoint yet, so blocked on a Kernel endpoint or exposing/ typing that
  schema).
- **Usage limits**: `daily_message_count` / `email_usage_windows` not enforced —
  no anti-spam / cost cap on RAYA. (Deferred — degraded models, no paid plans yet.)
- **Signal logging**: message tags now populated on the RAYA turn —
  `response_time_ms` (student think-time, client-measured) and a light `emt_level`
  (pump/assertion heuristic, kernel-handoff §7). Still not populated:
  `learning_events` / `student_sessions` (not in the repo schema/types), and
  `concept_id` / `partial_credit_score` on messages + direct `update_concept_state`
  (blocked — LLM-generated challenge questions carry no `concept_id`, so there's no
  KC to target; challenge performance already reaches the Kernel via `/analyze`).


**Other surfaces**
- **Public/content site**: **done** (landing, research, survey + wall, contact,
  feedback — see §2). Remaining: admin authoring UI for posts/newsletter,
  contribution file uploads, newsletter sending.
- **Social**: `friendships`, `notifications` (schema only, not started).
- **Tools**: audio_summary (TTS) and infographic (SVG) still need media infra;
  web_analysis (URL fetch) and image uploads. (flashcards + mind_map done.)

**Design / quality**
- **Design/shell (app)**: **done** — every signed-in route is on the shared design
  system (see §2). Remaining polish is optional: the Schools sidebar could show the
  mockup's search/right panel, and a few rarely-seen school views still use
  `opacity` rather than explicit tokens (legible, not pixel-perfect).
- **"Raya" wordmark sweep**: the bold-serif `<RayaName/>` is applied in onboarding +
  login only. Still to sweep: HeroSection, Navbar ("RAYA · AI tutor"), the shells,
  and remaining in-app copy.
- No tests / CI (the public content APIs were verified by a throwaway e2e
  script, not committed). No error monitoring.
- **Nothing is committed yet** — the tree is one initial commit plus ~220 staged/
  untracked files; the owner commits on their own cue.

**Reconnect / returning users**
- Signed-out screen (`components/auth-panel.tsx`) now separates: **sign in with
  email** (magic link — works for existing users), **recover with a recovery key**
  (`POST /api/auth/recover` → emails a fresh link to the account on file), and
  **start anonymously** (new users).
- **Email login now marks verification**: `/auth/callback` + `/auth/confirm` call
  `markEmailVerified` (`lib/auth.ts`, service role) → sets `email_verified_at` and
  bumps `account_state` `active_unverified → active_verified` (leaves
  `onboarding_pending` untouched so onboarding still runs).
- **Recovery keys now work for anonymous (email-less) accounts.** Supabase can't
  mint a session from a key alone, so an email-less account gets a **synthetic
  address** (`anon-<id>@anon.bluestift.local`) + a **password = its 16-char
  `recovery_code`** (`ensureRecoverable`, `lib/auth.ts`, service role).
  `/api/auth/recover` then branches by identity: a **real** linked email gets a
  magic link; a **synthetic** account is signed straight back in with the key as
  password (Supabase verifies the Turnstile token; session cookies set on the
  response). The synthetic flip sets Supabase `is_anonymous=false` but the UI still
  treats the account as anonymous until a *real* email is linked (`hasRealEmail`);
  RLS self-access verified intact after the flip.
- **Verified status = a REAL email only.** The synthetic address is Supabase-
  confirmed (needed for the password sign-in), but that must NOT read as "verified".
  So `email_confirmed_at` is ignored for status: onboarding sets `active_verified`
  only when `hasRealEmail(email) && email_confirmed_at`, else `active_unverified`;
  `markEmailVerified` is gated the same way. Net trust levels: **real email → magic
  link → `active_verified` (max security)**; **email-less → recovery key → access,
  but stays `active_unverified` (lower trust, by design)**. Linking a real email
  later upgrades to verified. (Existing mislabeled synthetic accounts backfilled to
  `active_unverified`.)
- **Anonymous sign-in is server-side** (`/api/auth/anon`) precisely because
  attaching that synthetic credential **revokes the account's live session**
  (verified). The route: `signInAnonymously` (captcha) → `ensureRecoverable`
  (attach, which revokes) → **re-mint** a fresh session via an admin magic-link +
  `verifyOtp` (no captcha), cookies written on the response. `/account` only calls
  the **session-safe** `ensureRecoveryCode` (code only, no credential change) so it
  never logs a visitor out. Doing the attach lazily on `/account` was the bug that
  broke anonymous sign-in (user bounced straight back to `/login`).

---

## 6. Recommended next steps (order)

~~Design / app shell~~ (done), ~~Schools / B2B core loop~~ (done),
~~public content site~~ (done), ~~conversation history / cognitive profile /
progress curve / signal logging~~ (done).

1. **Commit the tree.** ~220 files sit uncommitted on one initial commit — the
   single biggest risk right now.
2. **"Raya" wordmark sweep** — small, visible, closes an open brand directive.
3. **Real payments** — get a merchant account, then exercise the CinetPay path
   end-to-end (the whole loop is written and idempotent; only keys are missing).
4. **Usage limits / quotas** — `daily_message_count` / `email_usage_windows` are
   still unenforced. This *stops being deferrable* now that paid plans exist:
   there's no cost cap on Raya.
5. **Tests / CI + error monitoring** — nothing exists, and the money path
   (webhook idempotency, seat gate) is exactly the kind of code that needs it.
6. **Blocked on the Kernel** — per-concept trajectory curve, a real simulation
   endpoint, `update_concept_state` (needs `concept_id` on challenge questions).
7. **Later** — social (`friendships`/`notifications`), remaining Tools
   (TTS/infographic), public-site polish (post authoring, newsletter sending).
