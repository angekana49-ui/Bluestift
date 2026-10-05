# Kernel → RAYA app handoff

> Captures the Cognitive Kernel's current state and everything the app must align
> on after the Kernel's recent changes. Kernel repo: `github.com/angekana49-ui/Bluestift-Kernel`.
> Sections 1–7 are the Kernel side's handoff (latest: 2026-10-04). Section 8 is the
> app side: where each item stands in this repo.

---

## 1. Status & connection

- **Live:** `https://bluestift-kernel-production.up.railway.app`
- **Health:** `GET /health` → `{ "status": "ok", "version": "1.0.0" }` (open, no auth)
- **Deep health:** `GET /ready` → `{ "read_ok", "write_ok", "status": "ok"|"degraded" }`
  returns **503** when the Kernel can't reach its DB schema (see §6). Service secret
  required (401 without it, 403 with a student token).

### ⚠️ Auth: two tiers

The protected routes (`/analyze`, `/load_profile`, `/update_concept_state`,
`/prerequisite_gaps`, `/load_alerts`, `/resolve_alert`, `/seed_kcs`) require a
credential, and so does `/ready` (service secret only). `/health` stays open.

**Service tier — the shared secret.** Unchanged, and still what most calls use.
Set the **same** value on both sides:

- App `.env.local`: `KERNEL_API_SECRET=<secret>`
- Kernel (Railway): `KERNEL_API_SECRET=<same secret>`

Accepted via any of these headers, whichever the client already sends:
```
Authorization: Bearer <secret>
X-Kernel-Secret: <secret>
X-API-Key: <secret>
```

This secret can read and write **any** student's cognitive profile. It is the
right credential for background work — a cache refresh, a fire-and-forget
analysis after a chat turn — which has no live session to borrow from.

**User tier — the student's own Supabase token.** Send the student's
`access_token` as `Authorization: Bearer <token>` and the Kernel scopes the call
to them: it checks the token's `sub` against the `user_id` in the body and
returns **403** for anyone else's profile. `/seed_kcs`, `/resolve_alert` and the
school scope of `/load_alerts` are service-only (403).

Use it on any call that is about one student who is right there — the profile
and analyze proxies. It means a leak of the service secret is not a skeleton key
to every child's cognitive profile.

> **Deployment order matters.** The Kernel only accepts user tokens once
> `SUPABASE_JWT_SECRET` (the Supabase project's JWT secret) is set on Railway.
> The app therefore gates this behind `KERNEL_USER_SCOPED_AUTH=1`, off by
> default. Set the Kernel's variable **first**, then flip the app's — the other
> order 401s every scoped call.

Neither tier limits what the Kernel can model. Any student, any subject, any
level, KCs created on the fly. This is only about who may ask about whom.

---

## 2. API contract

### `POST /analyze` (main route)
Request:
```json
{
  "user_id": "uuid",                 // = public.users.id = auth.users.id
  "conversation_history": [          // max 200 messages
    { "role": "user", "content": "..." },       // content max 8000 chars
    { "role": "assistant", "content": "..." }
  ],
  "subject": "MATH",                 // any subject tag; extraction can override
  "level": "lycee",
  "trigger": "post_conversation"
}
```
Response (note the **new `alerts`** field):
```json
{
  "request_id": "uuid",
  "user_id": "uuid",
  "root_gap": "notion_de_variable",
  "root_concept_id": "uuid",
  "detection_path": ["derivation_fonction", "...", "notion_de_variable"],
  "mastery_map": { "derivation_fonction": { "k_raw": 0.2, "k_effective": 0.18, "status": "gap" } },
  "confidence": 0.95,
  "summary": "Tu bloques parce que ...",
  "recommended_path": ["notion_de_variable", "..."],
  "alerts": [{ "type": "cognitive_overload", "severity": "medium" }],
  "probe": {
    "label": "fonctions_affines", "concept_id": "uuid",
    "expected_gain": 0.62, "p_correct": 0.41,
    "root_if_correct": "derivation_fonction", "root_if_wrong": "fonctions_affines",
    "confirms_root": false
  },
  "curriculum": {
    "school_id": "uuid",
    "layers_applied": ["curriculum", "kc_priorities", "objectives"],
    "objectives": [
      { "concept": "derivees", "target_mastery": 0.8, "observed_mastery": 0.4,
        "due_at": "2026-12-15T00:00:00Z", "status": "at_risk" }
    ],
    "root_gap_in_program": true,
    "rules": ["Toujours partir d'un exemple concret."]
  },
  "kernel_version": "1.0.0",
  "llm_used": "openai/gpt-oss-120b"
}
```

`probe` is the **one diagnostic question** that would best settle where the gap
is, or `null` when no answer is worth the student's time. RAYA asks it on
`label`, **without help** (a hint makes the answer worthless as a test), and
sends the graded answer to `/update_concept_state` (by `concept_id`). The next
`/analyze` reads it back from the student's history.

The diagnosis plays **hot/cold**: each answer moves the Kernel's belief about
where the gap is, and the next probe goes where it is most uncertain. Expect
probes on prerequisites the conversation never mentioned, sometimes several
floors below it (fractions while the student works on functions): that is
where gaps hide. Present one as a quick check ("avant de continuer, ..."), not
a change of topic. Expect a probe even when the student got everything right
in this conversation, and a `root_gap` only once something has been failed.

**How RAYA asks matters as much as what the Kernel picks.** Synthetic
benchmark, gap up to 5 floors below, 48 concepts — share of students whose
named root is the gap or one floor from it, after 3 probes:

| One probe = | Within one floor after 3 | Exact after 3 | Exact after 5 |
|---|---|---|---|
| 1 multiple-choice-like question (25% guessable) | 55–62% | 28–33% | 42–47% |
| 1 open question (5% guessable) | 66–72% | 38–40% | 55–60% |
| **2 open questions on the same concept** | **72–81%** | **42–52%** | **66–75%** |

(Two draws of 300 simulated students; extraction assumed perfect.)

So: ask **open** questions (a value to compute, a definition to state), and
**two** of them per probe, each sent to `/update_concept_state` with
`question_format: "open"`. Telling the Kernel the format adds a little on top
(0 to +7 points on the exact gap after 5 measures); asking open is what counts.
`confirms_root: true` means the question is about the current root itself: ask
it before remediating — a wrong answer confirms the root, a right one sends the
search elsewhere. `root_if_correct` / `root_if_wrong` say where the diagnosis
would go under each answer; `expected_gain` (bits, ≤ 1) is how much the Kernel
expects to learn, `p_correct` its prediction. Never show these to the student.
To get the probe mid-conversation, call `/analyze` with `commit_state: false`.

`curriculum` is **absent (null)** unless the student belongs to a school that has
set layers — most students won't have it, so treat it as optional. When present:
`recommended_path` has already been reordered by the school's priorities;
`objectives[].status` is one of `met` / `at_risk` / `overdue` / `pending` /
`unknown` (`unknown` = no evidence on that concept yet, not a failure); and
`rules` are the school's instructions for RAYA's prompt — the same intent as the
app's existing `class_instructions` / `school_directives` nudges.

### `POST /load_profile`
`{ "user_id": "uuid" }` → cognitive profile (per-KC `k_raw`, `k_effective`,
`v_score`, `p_score`, `status`, `last_interaction_at`) + `mindset { m_score,
detected_mindset }`. Use for the dynamic prompt layer.

### `POST /update_concept_state`
`{ user_id, concept_id | concept_label, subject, level, partial_credit_score,
is_assisted, response_time_ms, blocage_type, question_format }` → updates one KC
with one graded attempt. `question_format` is optional: `"open"` when the
student produced the answer (a value, a definition), `"choice"` when they picked
among options. An open answer is read with a 5% guess rate, so a right one is
stronger evidence; absent = the KC's own rate. **Use this for every graded attempt** — it carries the real score, where
`/analyze` can only re-infer one from prose.

Identify the KC either way:
- `concept_label` — a plain concept name (`"derivation_fonction"`). The Kernel
  canonicalizes it onto an existing KC, or creates it. This is the normal path:
  grading knows the concept's name, never its UUID.
- `concept_id` — a `kernel.concept_nodes` UUID. The response returns the resolved
  `concept_id` and canonical `label`, so a caller can cache the id and skip
  resolution next time.

> **`/analyze` is rate-limited.** Two LLM calls per request, on a host billed
> by the minute, with no ceiling was a way to burn the credit balance and the
> LLM quota at once. Limits: **30 calls per student per hour**, **300 per hour
> overall** (both tunable). Over the limit → **429** with a `Retry-After`
> header. Treat it as "come back later", never as a failure to retry
> immediately — an immediate retry is what trips it. The fire-and-forget call
> sites already swallow it harmlessly.

### `POST /prerequisite_gaps` (new — GraphRAG)

*What does this student still need before they can hold this concept?*

```json
{ "user_id": "uuid",
  "concept_label": "derivation_fonction",   // or concept_id
  "max_hops": 4,                            // 1–8, default 4
  "include_resources": true }
```
```json
{
  "target": "derivation_fonction",
  "gaps": [
    { "label": "notion_de_variable", "concept_id": "uuid", "hops": 2,
      "k_effective": 0.31, "status": "gap", "resources": [] }
  ],
  "frontier": [{ "label": "notion_de_fonction", "hops": 1 }],
  "max_hops": 4, "truncated": false, "resources_available": false
}
```

`gaps` is already in **teaching order**: never a concept before what it rests
on, deepest foundation first. Render it top to bottom and you have a remediation
sequence — no re-sorting, and don't sort by `hops`, that would break it.

`frontier` is where the walk stopped because the student already holds the
concept. Worth showing: it is the evidence that a two-item list is short for a
reason rather than because the Kernel gave up.

`truncated` means the depth limit cut the list. Never render a cut list as
"nothing else is missing" — drop `max_hops` or say the list is partial.

`resources_available: false` means **the corpus is empty**, not that these
concepts are undocumented. Nothing writes `rag.rag_chunks` today. When something
does, attach the chunk's `concept_id` and material appears here automatically —
the Kernel scopes it to global material, the student's own, and their class,
never another child's or another class's.

An unknown `concept_label` is a **404**, unlike `/update_concept_state` which
creates the KC: a question must not grow the shared graph by being asked.

Use it for "explain why I'm stuck" and for a remediation plan. It is a pure read
— no LLM call, no state written — so it is cheap and safe to call on demand.

### `POST /load_alerts` (new — the school dashboard's data source)

The Kernel has been *writing* pedagogical-safety alerts all along; this is the
first way to read them back. Exactly one scope per call:

```json
{ "user_id": "uuid" }              // one student — their own token works
{ "user_ids": ["uuid", "uuid"] }   // an explicit roster — service only, max 500
{ "school_id": "uuid" }            // every student of a school — service only
```

> **You share this database, so prefer reading it directly for dashboards.**
> The RAYA app reads `kernel.kernel_monitoring` itself (`lib/kernel/risk.ts`)
> rather than calling this route on every page view. Two reasons: the Kernel
> sleeps on Railway, so each HTTP call is a billed wake-up, and a dashboard that
> depends on the Kernel being awake breaks exactly when it is not. Filter on
> `level = 'alert'` and `resolved = false` to match what this route returns.
> Use the route when you *don't* share the DB, or for a one-off check. Writes
> (`/resolve_alert`) should still go through the API.

**Use `user_ids` for the teacher dashboard**, not `school_id`. Your staff are
assigned to classes, not to establishments (`getProfClasses`), so a school-wide
call would show a teacher children they don't teach. Resolve the roster from the
teacher's classes and ask for exactly those. `school_id` is the head teacher's
view.
Optional: `include_resolved` (default false), `severity` (`low`/`medium`/`high`),
`since` (ISO timestamp), `limit` (1–500, default 100).

```json
{
  "scope": "school",
  "school_id": "uuid",
  "students_in_scope": 42,
  "alerts": [{
    "id": "uuid", "user_id": "uuid",
    "concept_id": "uuid", "concept_label": "derivation_fonction",
    "alert_type": "cognitive_overload", "alert_severity": "high",
    "alert_details": {}, "inconsistency_rate": null, "volatility_score": null,
    "interactions_count": null,
    "resolved": false, "resolved_by": null, "resolved_at": null,
    "created_at": "2026-08-14T09:12:00Z"
  }],
  "counts_by_type": { "cognitive_overload": 3 },
  "counts_by_severity": { "high": 3 },
  "truncated": false
}
```

**The school scope is service-only, and that is your job to gate.** The Kernel
cannot tell a teacher's token from a parent's or a student's — it has no staff
directory. So it refuses to decide: the app checks that the caller really teaches
at that school, then calls with the service secret. If you skip that check, one
forged session opens a whole school's alerts.

Three fields exist to keep a dashboard honest, please surface them:
`students_in_scope` (a school expecting 300 and seeing 12 has a roster problem,
not a quiet week), `truncated` (the limit cut the list — don't render it as
"everything"), and the **503**: this route deliberately fails loudly instead of
returning `[]`, because an empty list on a safety screen reads as "all clear".
Show an error state, never an empty one.

### `POST /resolve_alert`
`{ alert_id, resolved_by, resolved }` → acknowledge an alert, or reopen it with
`resolved: false`. Service-only: a student must not be able to close the alert
raised about them. `resolved_by` is free text (the Kernel has no staff
directory) — pass the teacher's id or name; you vouch for it. Unknown id → 404.

Resolved alerts leave the default `/load_alerts` view, so the dashboard shrinks
as staff work through it. A list that never shrinks is a list people stop reading.

> **Pairing it with `/analyze`:** send `commit_state: false` on the `/analyze`
> call that follows graded updates. Otherwise the Kernel re-derives the same
> attempts from the conversation and commits them *on top of* yours — the same
> evidence counted twice, inflating mastery. The diagnosis (root gap, path,
> alerts) is returned either way.

---

## 3. What changed since the app was built — align on these

1. **Auth** — now enforced (see §1). Was open.
2. **`alerts` in `/analyze`** — pedagogical-safety flags. Types:
   `passive_dependency`, `false_mastery`, `re_emergence_error`,
   `cognitive_overload`, `fixed_mindset`, `inconsistency_high`,
   `ood_distribution`. RAYA should react (see §4).
3. **`/ready`** — new deep-health probe. Point a deeper connectivity check at it
   (the current `/api/kernel/health` only tests liveness), from the server, with
   the service secret: it is service-only. Do not poll it on a schedule — any
   call wakes the container.
4. **Input limits** — `conversation_history` ≤ 200 messages, `content` ≤ 8000
   chars. Trim long histories before calling `/analyze` (send the last N turns).
5. **Cognitive vector semantics** (for the prompt injection, §5): V = learning
   rate p(T); P = resistance to slip modulated by mindset M.
6. **Multi-subject + cross-subject** — the graph spans subjects; a physics
   conversation can trace its root gap into maths. Just send the real `subject`.
7. **Graceful degradation** — if the shared DB regresses, `/analyze` still returns
   the diagnosis (state writes are best-effort). Watch `/ready` for `degraded`.

### 3b. Changes from the 2026-09-30 core audit

These change what the app sees. The contract shapes are the same, but the values
behave differently.

1. **"mastered" is stricter.** It now needs K ≥ 0.95 **and** a low personal slip
   **and** a mean credit ≥ 0.7 on the **last 3 unassisted attempts**. K ≥ 0.7
   alone used to be enough. Expect far fewer `mastered` statuses, and none until
   a student has shown the concept three times without help. Students whose
   state predates migration 011 keep the old all-time average until new attempts
   arrive.
2. **`unknown` now appears in `mastery_map`.** A concept only *mentioned* in the
   conversation, with no attempt and no history, is `unknown`, and its
   `k_raw`/`k_effective` are just the prior. It used to show as `gap` and could
   become the root gap. Render `unknown` as "not assessed yet", never as a
   failure.
3. **`root_gap` is `null` more often.** On students with no gap, the Kernel used to
   name a root gap for virtually everyone; it now does so for roughly 1 in 10
   (synthetic benchmark, see the Kernel README). The "pas encore assez de signal"
   summary is the honest answer, not an outage.
4. **Send the real `blocage_type` and `is_assisted`.**
   - On `/update_concept_state`, a failure with `blocage_type: "linguistic"` is
     logged but **not counted**: the response has `updated: false` and nothing is
     written.
   - An `ambiguous` failure counts half.
   - `is_assisted: true` is now a much weaker observation. It used to be a 0.9
     credit, nearly full weight.
5. **`commit_state: false` still uses the conversation.** The attempts the
   conversation shows inform *this* diagnosis in memory; they are just not
   written. If the same attempts already went through `/update_concept_state`,
   they weigh twice in that one diagnosis, but they are never stored twice.
6. **`recommended_path` climbs the detection path back** (root → … → the concept
   the student is stuck on) before walking further. It used to follow the
   alphabetically first dependent of the root, which could lead away from the
   problem.
7. **One label is one KC across subjects.** A PHYSICS request for `vecteurs`
   resolves to the existing MATH `vecteurs` instead of creating a duplicate.
8. **New table `kernel.learning_events`** (migration 011): one row per graded
   attempt, per student. **Add it to the GDPR erasure and export lists**
   (`lib/compliance/erasure.ts`, `lib/compliance/export.ts`, next to
   `student_concept_state` and `learning_trajectories`).
9. **Apply migrations 011 and 012 before deploying** this Kernel version.
10. **Concurrent requests for one student are safe.** They are served first come,
    first served, and each state write is compare-and-set on a version (a chain),
    so a graded attempt landing while a conversation is analysed no longer erases
    either one. Nothing to do app-side; retries are safe.
11. **`/load_profile` concept states carry three new fields:**
    - `tau` (0.5 neutral) is the KC's rigour: how exact it must be to count as
      known. Use it for the EMT entry point: at the same K, a rigorous KC warrants
      an earlier worked example.
    - `review_count` and `lapse_count` count successful and failed retrievals
      after a gap. Forgetting slows with each review.
12. **M means something different.** It still starts from the conversation
    reading, but "abandon after an error" is now measured (was a failure retried?),
    and it blends in the student's measured learning dynamics. It never uses
    their level. A struggling student who keeps trying is **not** "fixed".

### 3c. Active probing and the student's history (2026-10-01)

13. **New `probe` field in `/analyze`** (see §2). Updated 2026-10-04: probes
    now go below the conversation (hot/cold) and come even when nothing
    failed; ask them open, two questions per probe (table in §2). Optional to use, but it is the
    largest measured gain: in the synthetic benchmark, recall of the planted gap
    rises from 46–53% to 56–64% (calibrated) when the tutor asks the probe, on
    fewer extra questions than a random-question control. Type it in
    `lib/kernel/types.ts` as optional.
14. **The diagnosis now remembers earlier conversations.** A prerequisite failed
    or mastered last week counts in today's root-gap search even if today's
    conversation never mentions it. `mastery_map` still lists only today's
    concepts. Expect more `root_gap`s that are not in `mastery_map`: they come
    from history. Fetch their state with `/load_profile` if you need it.
15. **A failed prerequisite mid-chain can now be the root.** It used to lose to
    the surface concept whenever the chain continued into unverified concepts
    below it, so `root_gap` was too often just what the student was stuck on.
16. **`kernel_outputs.output` now carries a `mindset_trace`** (the M reading of
    that analysis and its parts), for `scripts/validate_mindset.py`. It is
    **not** in the `/analyze` response. `kernel_outputs` is already in the GDPR
    erasure and export lists, so nothing changes app-side.
17. **`concept_nodes.display_names`** (migration 013): the readable name of a
    concept per locale, `{"en", "fr", "es", "de"}`. The `label` stays the
    identity, French snake_case, and is no longer meant to be shown. New
    concepts are named at creation; `scripts/backfill_display_names.py` names
    the existing ones. The app reads the column itself
    (`lib/kernel/concept-names-server.ts`) and falls back to the label made
    readable. Without the migration, concepts are still created, just unnamed.
18. **The graph now deepens where the diagnosis bottoms out** (migration 014,
    `services/deepen.py`). When the root gap is itself a failing concept,
    `/analyze` (after responding) asks once for that concept's finer
    prerequisites. The app sees nothing new in the response; the next analysis
    can return a finer `root_gap` and a closer `probe`. Without migration 014
    the Kernel does not deepen at all.

---

## 4. Reacting to `alerts` (pedagogical safety)

| Alert | Meaning | Suggested RAYA response |
|---|---|---|
| `passive_dependency` | Answers too fast, no errors, no questions | Switch to goal-free / demand an attempt |
| `false_mastery` | High mastery but high slip | Retest on a harder/held-out context |
| `cognitive_overload` | Frequent errors mid-solving | Reduce task complexity; worked examples |
| `fixed_mindset` | Low M, quick give-ups | Mindset intervention (process feedback) BEFORE any retry |
| `re_emergence_error` | Simple KC ok → complex KC fails | Decompose the KC |
| `inconsistency_high` | Mastery estimate oscillates instead of settling | Treat the KC's K as unreliable: re-establish with a clean, unassisted check before sequencing on it |
| `ood_distribution` | The student doesn't match the population the parameters were calibrated on | Don't harden decisions on K here; `direction: below_population` in the details is the silent-failure case and warrants a human look |

The last two read beyond a single conversation (trajectory history, population
baselines), so they surface on students with some history rather than on turn one.

Alerts arrive live in the `/analyze` response *and* are persisted. Read the
history back with `/load_alerts` — that's what the school dashboard is built on —
and close them with `/resolve_alert`.

---

## 5. Injecting the cognitive vector into RAYA's prompt

From `/load_profile`, inject per active KC: **K** (mastery), **V** (learning
rate), **P** (persistence), and the global **M** (mindset). Drives the EMT entry
level: low K+P → vicarious/assertion; solid K+P → pump; low M → deflect to content
before any retry.

---

## 6. Shared-DB rules (IMPORTANT — don't lock the Kernel out)

The Kernel and the app share one Supabase project. The app's setup MUST NOT:
- drop `kernel` from the PostgREST **exposed schemas**, or
- reset the `service_role` grants on the `kernel` schema.

The exposed schemas must be the **union** both sides need:
```
public, graphql_public, kernel, learning, schools, rag, content
```
If the Kernel ever returns `degraded` on `/ready` (or 500s with "permission
denied for table kernel_*"), re-run the Kernel's `migrations/009_shared_db_hardening.sql`
(re-asserts the union + grants + reloads PostgREST).

The Kernel also **reads** two app-owned tables in the `schools` schema:
`student_identities` (to map a student to their school) and
`school_curriculum_layers` (the layers themselves, extended by the Kernel's
migration 010). It never writes to them. If the app changes their shape, the
Kernel degrades to "no school context" rather than failing — but the school
channel goes quiet, so tell the Kernel side.

---

## 7. Still on the app side (from your raya-status)

- Store `emt_level` on RAYA messages (light EMT classification).
- Call `/update_concept_state` directly with real `partial_credit_score` /
  `concept_id` on graded attempts (not only the `/analyze`-derived updates).
- Add a `/ready`-based deep health check alongside the liveness probe.
- Keep the chat hot path non-blocking on the Kernel (already the case).

---

## 8. Where the app stands (2026-10-05)

### Done
- **Auth, both tiers.** Service secret everywhere; user-scoped calls behind
  `KERNEL_USER_SCOPED_AUTH` (`lib/kernel/client.ts`).
- **`emt_level`** is stored on every Raya reply (`classifyEmt` in
  `app/api/raya/chat/route.ts`).
- **Graded attempts go to `/update_concept_state` directly**, per KC, with
  `commit_state: false` on the diagnosis that follows (`lib/kernel/graded.ts`).
  The callers are challenges, teacher assignments, and (since 2026-10-04) quizzes
  generated in Tools (`/api/tools/quiz-result`, graded on the server from the
  stored quiz).
- **`question_format`** is sent on those updates: `"open"` for written answers,
  `"choice"` for multiple choice. It is left out when one KC was answered both ways.
- **`/ready`** backs the daily Kernel health cron (`app/api/cron/kernel-health`),
  with the service secret. Nothing polls it more often.
- **Input limits.** `clampHistory` trims what `/analyze` receives.
- **Alerts** reach Raya's prompt and the school dashboard. The dashboard reads
  `kernel.kernel_monitoring` directly (`lib/kernel/risk.ts`).
- **`probe`** is typed and reaches the prompt as `<diagnostic_question>`. Since
  2026-10-05 Raya asks it as **two open questions** on the concept, one at a
  time, with no options and no hint, framed as a quick check
  (`lib/raya/prompt.ts`).
- **`unknown`** is shown as "not assessed yet", in grey, never as a failure
  (`components/cognitive-profile.tsx`, `kernel.status.unknown`).
- **`learning_events`** is in the erasure and export lists (`lib/compliance/`).
- **`display_names`** are read by `lib/kernel/concept-names-server.ts`.

### Not done, on purpose or not yet
- **Probe answers are not sent to `/update_concept_state` directly.** The next
  ambient `/analyze`, which runs every third student turn, reads them from the
  conversation and commits them.
  - Sending them directly as well would mean the ambient call commits them a
    second time (it runs with `commit_state` on, so that the rest of the chat's
    evidence is stored).
  - Doing it right needs: grading the probe answer (an LLM call), sending it with
    `question_format: "open"`, and then excluding that turn from the next ambient
    commit.
  - Asking open is most of the measured gain (§2 table); the explicit format adds
    0 to +7 points.
- **`/prerequisite_gaps`** is not used yet. A natural first use is an "explain why
  I'm stuck" view on the learner's Kernel page, rendered top to bottom as a
  remediation sequence, with `frontier` and `truncated` shown honestly.
- **`tau`, `review_count`, `lapse_count`** are typed but not used in the prompt
  yet. A natural first use is `tau`: offer a worked example earlier on a rigorous
  KC at the same K.
- **`blocage_type`** is typed but never sent: graded attempts don't know why a
  student failed.
- **`curriculum.rules`** are typed. Check that they reach the prompt the same way
  `school_directives` do before relying on them.

### App-side decisions to keep
- **The cognitive vector** is derived once in `lib/kernel/signals.ts`, which both
  the prompt and the model router read.
  - The teaching target is the **weakest active concept**, never the mean of
    `k_effective`. Averaging was the original bug (fixed 2026-08-13).
  - A concept counts as done only when the Kernel says `mastered` **and**
    `k_effective >= 0.8`.
- **Concept labels are sanitised** before entering the prompt
  (`sanitizeConceptLabel`). Students' conversations create them, so they are
  untrusted text.
- **`root_gap` / `recommended_path`** are carried across turns in
  `learning.kernel_profile_snapshots.latest_analysis` and expire after 30 minutes.
- **Progression is NOT gated on mastery** (decided 2026-08-13). The prompt names
  the weakest concept and steers the session there; a student who wants to go
  elsewhere goes elsewhere.
  - Bluestift is not an LMS and does not own the timetable. A tutor that refuses
    to answer until a prerequisite is repaired is a tutor that gets closed.
  - Do not "fix" this by adding a refusal.
