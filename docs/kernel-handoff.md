# Kernel → RAYA app handoff

> Captures the Cognitive Kernel's current state and everything the app must align
> on after the Kernel's recent changes. Kernel repo: `github.com/angekana49-ui/Bluestift-Kernel`.

---

## 1. Status & connection

- **Live:** `https://bluestift-kernel-production.up.railway.app`
- **Health:** `GET /health` → `{ "status": "ok", "version": "1.0.0" }` (open, no auth)
- **Deep health:** `GET /ready` → `{ "read_ok", "write_ok", "status": "ok"|"degraded" }`
  returns **503** when the Kernel can't reach its DB schema (see §6). Open, no auth.

### ⚠️ Auth is now REQUIRED
The protected routes (`/analyze`, `/load_profile`, `/update_concept_state`,
`/seed_kcs`) now require a shared secret. Set the **same** value on both sides:

- App `.env.local`: `KERNEL_API_SECRET=<secret>`
- Kernel (Railway): `KERNEL_API_SECRET=<same secret>` (already set)

The Kernel accepts the secret via **any** of these headers:
```
Authorization: Bearer <secret>
X-Kernel-Secret: <secret>
X-API-Key: <secret>
```
Missing/wrong secret → **401**. `/health` and `/ready` stay open.

---

## 2. API contract

### `POST /analyze` (main route)
Request:
```json
{
  "user_id": "uuid",
  "conversation_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "subject": "MATH",
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
  "kernel_version": "1.0.0",
  "llm_used": "openai/gpt-oss-120b"
}
```

### `POST /load_profile`
`{ "user_id": "uuid" }` → per-KC `k_raw`, `k_effective`, `v_score`, `p_score`,
`status`, `last_interaction_at` + `mindset { m_score, detected_mindset }`.

### `POST /update_concept_state`
`{ user_id, concept_id, partial_credit_score, is_assisted, response_time_ms,
blocage_type }` → updates one KC on a strong signal. Preferred for graded attempts.

---

## 3. What changed since the app was built

1. **Auth** — now enforced (see §1). Was open.
2. **`alerts` in `/analyze`** — types: `passive_dependency`, `false_mastery`,
   `re_emergence_error`, `cognitive_overload`, `fixed_mindset`.
3. **`/ready`** — new deep-health probe.
4. **Input limits** — `conversation_history` ≤ 200 messages, `content` ≤ 8000 chars.
5. **Cognitive vector** — V = learning rate p(T); P = resistance to slip modulated by M.
6. **Multi-subject + cross-subject** — the graph spans subjects; send the real `subject`.
7. **Graceful degradation** — `/analyze` still returns the diagnosis if DB writes
   regress; watch `/ready` for `degraded`.

---

## 4. Reacting to `alerts`

| Alert | Meaning | Suggested RAYA response |
|---|---|---|
| `passive_dependency` | Answers too fast, no errors, no questions | Switch to goal-free / demand an attempt |
| `false_mastery` | High mastery but high slip | Retest on a harder/held-out context |
| `cognitive_overload` | Frequent errors mid-solving | Reduce task complexity; worked examples |
| `fixed_mindset` | Low M, quick give-ups | Mindset intervention (process feedback) BEFORE any retry |
| `re_emergence_error` | Simple KC ok → complex KC fails | Decompose the KC |

---

## 5. Injecting the cognitive vector into RAYA's prompt
From `/load_profile`, inject per active KC: **K**, **V**, **P**, and global **M**.
Drives the EMT entry level: low K+P → vicarious/assertion; solid K+P → pump;
low M → deflect to content before any retry.

**Implemented in `lib/kernel/signals.ts`** — the single derivation both the
prompt and the model router read. The rule that matters: the teaching target is
the **weakest active concept**, never the mean of `k_effective` across the
profile. Averaging was the original bug (fixed 2026-08-13): a learner at 0.78
average with a prerequisite at 0.20 read as "high mastery, encourage productive
struggle", which is the precise case mastery learning exists to catch. A concept
counts as done only when the Kernel's `status` says `mastered` **and**
`k_effective >= 0.8`; disagreement keeps it a target.

Concept labels are sanitised before they enter the prompt (`sanitizeConceptLabel`).
KCs are created dynamically from student conversations, so a label is untrusted
text crossing into an instruction channel.

`root_gap` / `recommended_path` come from `/analyze`, not `/load_profile`, so they
are carried across turns in `learning.kernel_profile_snapshots.latest_analysis`
and expire after 30 minutes on read.

---

## 6. Shared-DB rules (do NOT lock the Kernel out)
The exposed PostgREST schemas must be the union both sides need:
```
public, graphql_public, kernel, learning, schools, rag, content
```
Do not drop `kernel` or reset `service_role` grants on the `kernel` schema.
If `/ready` returns `degraded` (or 500 "permission denied for table kernel_*"),
re-run the Kernel's `migrations/009_shared_db_hardening.sql`.

---

## 7. Still on the app side
- Store `emt_level` on RAYA messages (light EMT classification).
- Call `/update_concept_state` directly on graded attempts.
- Add a `/ready`-based deep health check alongside the liveness probe.
- Keep the chat hot path non-blocking on the Kernel (already the case).
- **Not yet done: gate progression on mastery.** The prompt now names the weakest
  concept and asks Raya to land the session there, but nothing *enforces* it —
  she can still be talked forward onto a concept whose prerequisite is at 0.2.
  That enforcement is the second half of mastery learning and it is still absent.
