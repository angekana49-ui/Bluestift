# RAYA — current state

RAYA is the conversational **Socratic tutor** in the Next.js app. It is separate
from the Cognitive **Kernel** (which does cognitive tracing/analysis). RAYA talks
to the student; the Kernel analyzes and stores cognitive state. They share one
Supabase DB and the contract `user_id = public.users.id = auth.users.id`.

## What works today (app side, no Kernel required)
- **Text chat** at `/chat` with **streaming** replies (tokens appear live).
- **Voice input**: mic button → records → `/api/raya/transcribe` (Whisper via
  Groq) → transcribed text is sent as a normal turn.
- **Structural guardrail**: RAYA never gives the answer; follows EMT
  (PUMP → HINT → ASSERTION → SUMMARY), requires an attempt before hints, uses
  Dweck-style process feedback, replies in the student's language.
- Every turn is stored in `learning.conversations` / `learning.messages`
  (student = role `user`, RAYA = role `assistant`, with `model_used`).
- Works even when the Kernel is offline (degrades to non-personalized tutoring).

## LLM providers
- **Gemini primary → Groq fallback** (cheap models). Streaming via Gemini SSE
  (`streamGenerateContent?alt=sse`) then Groq (`stream:true`).
- **Voice/STT**: OpenAI **Whisper served by Groq** (`whisper-large-v3`).
- Env (`.env.local`, reuse the Kernel keys):
  `GEMINI_API_KEY`, `GROQ_API_KEY`, `GEMINI_MODEL`, `GROQ_MODEL`, `GROQ_WHISPER_MODEL`.

## Files
| File | Role |
|---|---|
| `lib/raya/prompt.ts` | Dual-layer prompt: Markdown static rules + XML `<learner_state>` for injected Kernel data |
| `lib/raya/llm.ts` | `rayaStream` (streaming), `rayaComplete` (non-stream), `transcribeAudio` (Whisper) |
| `app/api/raya/chat/route.ts` | One streamed turn; stores messages; triggers the Kernel loop |
| `app/api/raya/transcribe/route.ts` | Voice → text |
| `components/chat.tsx` | Chat UI: streaming, mic, "Analyze" button |
| `lib/kernel/client.ts` | Typed Kernel HTTP client (6s timeout) |
| `lib/kernel/profile-cache.ts` | Non-blocking learner-profile cache (TTL 60s) |
| `app/api/kernel/analyze/route.ts` | Manual gap detection (auth'd proxy to Kernel) |
| `app/api/kernel/health/route.ts` | Connectivity probe |

## How RAYA uses the Kernel (latency-safe)
- **Reads** the cognitive profile via `getCachedProfile()` — returns instantly
  from cache and refreshes in the background. The chat hot path NEVER awaits the
  Kernel.
- **Writes/updates**: after every **3rd student turn**, the chat route fires a
  background `kernel.analyze(...)` (fire-and-forget) so the Kernel processes the
  exchange and updates state per its own strong-signal rules, then invalidates
  the profile cache so the next reply reflects it.
- Manual **"Analyze"** button calls `/api/kernel/analyze` for on-demand gap
  detection (root_gap / summary / mastery_map).

## What needs the Kernel running
- Personalized EMT entry level (uses avg mastery + mindset from `/load_profile`).
- Real gap detection from "Analyze" and the background loop.
- Set `KERNEL_API_URL` in `.env.local`; verify with `/api/kernel/health`
  (`{ ok: true }`). See `docs/kernel-connection.md`.

## Aligned with the Kernel handoff (2026-07-02)
- **Auth**: the client sends `Authorization: Bearer $KERNEL_API_SECRET` (set it in
  `.env.local`, same value as Railway).
- **`alerts`**: captured from the background `/analyze` and injected into RAYA's
  prompt (`<alerts>` + per-type response rules in the static layer).
- **`/ready`**: `/api/kernel/health` now probes liveness + deep readiness and
  flags `degraded`.
- **Input limits**: `clampHistory()` trims to ≤200 msgs / ≤8000 chars before
  every `/analyze`.

## Not done yet (next candidates)
- Store `emt_level` on RAYA messages (needs a light EMT classification/tag).
- Direct `update_concept_state` calls with real `partial_credit_score` /
  `concept_id` (currently the Kernel derives updates from `/analyze`).
- Guided-exercise UX with option buttons (see `raya-thebluestift.jsx` mockup).
- Rooms (group chat + private RAYA channel), Tools screen.
- Design pass — the UI is functional/plain on purpose.

## Known constraints
- Kernel API currently has **no auth** — add a shared secret
  (`KERNEL_API_SECRET`) before production; the client already sends it if set.
- Profile cache is in-memory/per-instance — fine for dev/single instance; back
  it with a KV/DB snapshot for multi-instance serverless.
