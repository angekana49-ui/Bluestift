import "server-only";
import { withTimeout } from "@/lib/net/timeout";
import type { ModelTier } from "@/lib/raya/routing";

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * The Gemini model in service today, and the floor of the ladder below.
 *
 * ONE literal, read by both rungs: the primary defaults to it, and so does the
 * fallback. That is what makes moving forward a single env change —
 * `GEMINI_MODEL=<new>` promotes a new model and leaves this one as the safety
 * net underneath it, with no deploy. Two identical strings would have made the
 * same shape by coincidence and drifted apart at the first edit.
 */
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

/**
 * Per-tier model selection (see lib/raya/routing.ts for how a tier is chosen).
 *
 * Both tiers fall back to the single configured model, so this is INERT until
 * the tier env vars are set — deploying it changes nothing, and unsetting them
 * is the rollback. Read at call time, not module load, so a drill or a test can
 * stub the env the same way the base-URL overrides already allow.
 */
function geminiModel(tier: ModelTier): string {
  const override = tier === "deep" ? process.env.GEMINI_MODEL_DEEP : process.env.GEMINI_MODEL_FAST;
  // `GEMINI_MODEL` is read HERE and not at module load, which is what the note
  // above always claimed and what the tier overrides alone actually did: a
  // module-level const is frozen at import, so an outage drill or a test could
  // not move the base model at all, and would not be told it had failed to.
  return override || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}
/** The rung under the primary — the model that keeps answering while a newly
 *  promoted one is unknown, rate-limited, or refusing for its own reasons. */
function geminiFallback(tier: ModelTier): string {
  const override =
    tier === "deep"
      ? process.env.GEMINI_MODEL_FALLBACK_DEEP
      : process.env.GEMINI_MODEL_FALLBACK_FAST;
  return override || process.env.GEMINI_MODEL_FALLBACK || DEFAULT_GEMINI_MODEL;
}
/**
 * The Gemini rungs, in order. One entry unless a distinct fallback is
 * configured — never the same model twice, which would only spend a deadline
 * to get the same refusal.
 */
function geminiLadder(tier: ModelTier): string[] {
  const primary = geminiModel(tier);
  const second = geminiFallback(tier);
  return second && second !== primary ? [primary, second] : [primary];
}
function groqModel(tier: ModelTier): string {
  const override = tier === "deep" ? process.env.GROQ_MODEL_DEEP : process.env.GROQ_MODEL_FAST;
  return override || GROQ_MODEL;
}

/*
 * WHEN THE SECOND GEMINI RUNG IS WORTH TRYING
 *
 * Only when Gemini ANSWERED and refused — an unknown model name, a quota on
 * that model, a 4xx or a 5xx. Then a second model on the same connection is
 * cheap and is the closest thing to what the primary would have said.
 *
 * NOT when Gemini did not answer at all (our deadline aborted it, DNS, a reset).
 * That is the provider being unreachable, which no other Gemini model fixes,
 * and the whole point of the first-byte deadline is that Groq gets its turn
 * FAST — spending a second 1.5s budget on the same dead host would double the
 * silence the fallback exists to prevent.
 */
type GeminiOutcome = "ok" | "refused" | "unreachable";
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3";
const TEMPERATURE = 0.4;
const MAX_TOKENS = 600;

// Base URLs are env-overridable so tests and outage drills (point Gemini at a
// blackhole IP) can exercise the fallback path without code edits. Read at
// call time, not module load, so vi.stubEnv works.
function geminiUrl(
  method: "generateContent" | "streamGenerateContent",
  key: string,
  model: string,
): string {
  const base = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
  const sse = method === "streamGenerateContent" ? "?alt=sse&key=" : "?key=";
  return `${base}/v1beta/models/${model}:${method}${sse}${key}`;
}
function groqChatUrl(): string {
  return `${process.env.GROQ_BASE_URL ?? "https://api.groq.com"}/openai/v1/chat/completions`;
}
function groqSttUrl(): string {
  return `${process.env.GROQ_BASE_URL ?? "https://api.groq.com"}/openai/v1/audio/transcriptions`;
}

// ── Deadlines ──────────────────────────────────────────────────────────────
// Every provider call is bounded so a hung provider FAILS FAST into the
// fallback instead of eating the whole latency budget. Streaming gets a tight
// first-byte deadline (Groq's TTFB is fast, so falling back early is cheap),
// then a generous per-chunk stall timeout once tokens are flowing.
const COMPLETE_TIMEOUT_MS = 10_000;
const FIRST_BYTE_MS = 1500;
const STREAM_STALL_MS = 20_000;
const PDF_TIMEOUT_MS = 45_000;
const STT_TIMEOUT_MS = 30_000;

/** fetch with a hard deadline: aborts and THROWS so `catch`-fallthroughs engage. */
async function llmFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a Raya reply. Gemini primary, a second Gemini model where one is
 * configured, then Groq. Server-only; keys never reach the client.
 */
export async function rayaComplete(
  messages: ChatMsg[],
  tier: ModelTier = "deep",
): Promise<{ text: string; model: string }> {
  // Defaults to "deep" on purpose: an un-routed caller keeps today's behaviour
  // rather than being silently downgraded to a cheaper model.
  const qModel = groqModel(tier);
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    for (const gModel of geminiLadder(tier)) {
      let outcome: GeminiOutcome = "refused";
      try {
        const res = await llmFetch(
          geminiUrl("generateContent", geminiKey, gModel),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: system ? { parts: [{ text: system }] } : undefined,
              contents,
              generationConfig: {
                temperature: TEMPERATURE,
                maxOutputTokens: MAX_TOKENS,
              },
            }),
          },
          COMPLETE_TIMEOUT_MS,
        );
        if (res.ok) {
          const data = await res.json();
          const text: string | undefined = data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("")
            .trim();
          if (text) return { text, model: `gemini:${gModel}` };
        }
      } catch {
        // No answer at all (includes our deadline abort) — see GeminiOutcome.
        outcome = "unreachable";
      }
      if (outcome === "unreachable") break;
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await llmFetch(
        groqChatUrl(),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: qModel,
            messages,
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
          }),
        },
        COMPLETE_TIMEOUT_MS,
      );
      if (res.ok) {
        const data = await res.json();
        const text: string | undefined =
          data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, model: `groq:${qModel}` };
      }
    } catch {
      // fall through to the shared error
    }
  }

  throw new Error(
    "No LLM provider available. Set GEMINI_API_KEY (or GROQ_API_KEY).",
  );
}

// ── Streaming ──────────────────────────────────────────────────────────────

type StreamStart = {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  firstChunk: Uint8Array;
};

/**
 * Start an SSE request under one deadline covering connect + headers + FIRST
 * body chunk. Returns null on any miss (timeout, HTTP error, empty body) with
 * the connection aborted — the caller then tries the next provider. The first
 * chunk is handed back so the delta generator can re-emit it without loss.
 */
async function startSse(
  url: string,
  init: RequestInit,
  firstByteMs: number,
): Promise<{ start: StreamStart | null; answered: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), firstByteMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok || !res.body) {
      controller.abort();
      // It answered — with a refusal, or with nothing to read. Either way the
      // host is up, which is what decides whether a second model is worth a
      // try (see GeminiOutcome).
      return { start: null, answered: true };
    }
    // The SAME deadline also covers the first body chunk — bounded explicitly
    // here (not just via the abort timer) so a body that never produces can't
    // hold us past it.
    const reader = res.body.getReader();
    const remaining = Math.max(1, firstByteMs - (Date.now() - startedAt));
    const first = await withTimeout(reader.read(), remaining, null);
    if (!first || first.done || !first.value) {
      controller.abort();
      // Headers arrived and then silence: the host answered, but this request
      // is dead. Treat it as unreachable — a body that never produces is the
      // shape of a provider in trouble, not of a model refusing.
      return { start: null, answered: false };
    }
    return { start: { reader, firstChunk: first.value }, answered: true };
  } catch {
    return { start: null, answered: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read an open SSE body as `data:` payloads, starting from the chunk that
 * satisfied the first-byte deadline. A mid-stream stall (> STREAM_STALL_MS
 * between chunks) ends the stream quietly — the caller keeps the partial text
 * (the chat route already persists partials).
 */
async function* sseData(start: StreamStart): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buf = "";
  let chunk: Uint8Array | undefined = start.firstChunk;
  for (;;) {
    if (chunk) {
      buf += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    const next = await withTimeout(start.reader.read(), STREAM_STALL_MS, null);
    if (!next) {
      // Stalled: release the connection, keep what we have.
      void start.reader.cancel().catch(() => {});
      break;
    }
    if (next.done) break;
    chunk = next.value;
  }
}

/**
 * What one turn cost, in tokens. `null` means the provider did not tell us —
 * never assume zero, or an unmeasured turn reads as a free one.
 *
 * Filled in AS THE STREAM DRAINS: the counts ride on the SSE payloads, so they
 * only exist once the caller has consumed the deltas. Read it after the loop.
 */
export type TokenUsage = { prompt: number | null; completion: number | null; total: number | null };

function emptyUsage(): TokenUsage {
  return { prompt: null, completion: null, total: null };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function* geminiDeltas(start: StreamStart, usage: TokenUsage): AsyncGenerator<string> {
  for await (const data of sseData(start)) {
    if (!data) continue;
    try {
      const json = JSON.parse(data);
      // Gemini repeats usageMetadata on each chunk with running totals, so the
      // last one to arrive is the authoritative one — plain assignment, never
      // accumulation, which would multiply the turn's cost by its chunk count.
      const u = json?.usageMetadata;
      if (u) {
        usage.prompt = num(u.promptTokenCount) ?? usage.prompt;
        usage.completion = num(u.candidatesTokenCount) ?? usage.completion;
        usage.total = num(u.totalTokenCount) ?? usage.total;
      }
      const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (text) yield text;
    } catch {
      // ignore keep-alive / partial lines
    }
  }
}

async function* groqDeltas(start: StreamStart, usage: TokenUsage): AsyncGenerator<string> {
  for await (const data of sseData(start)) {
    if (!data || data === "[DONE]") continue;
    try {
      const json = JSON.parse(data);
      // Groq attaches the counts to the final chunk under x_groq; a plain
      // OpenAI-compatible endpoint only sends `usage` when the request asked
      // for it. We do NOT ask: this is the FALLBACK path, and adding an option
      // an unknown base URL might reject would trade a measured turn for a
      // failed one. Unmeasured stays null, which is what it means.
      const u = json?.x_groq?.usage ?? json?.usage;
      if (u) {
        usage.prompt = num(u.prompt_tokens) ?? usage.prompt;
        usage.completion = num(u.completion_tokens) ?? usage.completion;
        usage.total = num(u.total_tokens) ?? usage.total;
      }
      const text: string = json?.choices?.[0]?.delta?.content ?? "";
      if (text) yield text;
    } catch {
      // ignore
    }
  }
}

/**
 * Streaming Raya reply for minimal perceived latency. Gemini primary; if it
 * REFUSES, the second Gemini model where one is configured; if it goes silent
 * past FIRST_BYTE_MS, straight to Groq under the same deadline. Returns the
 * chosen model + a delta stream.
 */
export async function rayaStream(
  messages: ChatMsg[],
  tier: ModelTier = "deep",
): Promise<{ model: string; stream: AsyncGenerator<string>; usage: TokenUsage }> {
  // One holder for the whole call: whichever provider ends up answering fills
  // this in, and the caller reads it once the stream is drained.
  const usage = emptyUsage();
  const qModel = groqModel(tier);
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    for (const gModel of geminiLadder(tier)) {
      const { start, answered } = await startSse(
        geminiUrl("streamGenerateContent", geminiKey, gModel),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            contents,
            generationConfig: {
              temperature: TEMPERATURE,
              maxOutputTokens: MAX_TOKENS,
            },
          }),
        },
        FIRST_BYTE_MS,
      );
      if (start) {
        return { model: `gemini:${gModel}`, stream: geminiDeltas(start, usage), usage };
      }
      // Silence, not a refusal: Gemini is unreachable and the next model is on
      // the same host. Groq's turn, now, rather than 1.5s from now.
      if (!answered) break;
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const { start } = await startSse(
      groqChatUrl(),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: qModel,
          messages,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          stream: true,
        }),
      },
      FIRST_BYTE_MS,
    );
    if (start) {
      return { model: `groq:${qModel}`, stream: groqDeltas(start, usage), usage };
    }
  }

  throw new Error(
    "No LLM provider available. Set GEMINI_API_KEY (or GROQ_API_KEY).",
  );
}

/**
 * Structured generation with JSON mode ON for both providers so the output is
 * always valid JSON (Gemini responseMimeType, Groq response_format). Returns
 * the raw JSON string. Gemini rungs first, then Groq.
 */
export async function generateJson(
  system: string,
  user: string,
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    for (const model of geminiLadder("deep")) {
      let outcome: GeminiOutcome = "refused";
      try {
        const res = await llmFetch(
          geminiUrl("generateContent", geminiKey, model),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: user }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
              },
            }),
          },
          COMPLETE_TIMEOUT_MS,
        );
        if (res.ok) {
          const data = await res.json();
          const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
            .map((p: { text?: string }) => p.text ?? "")
            .join("")
            .trim();
          if (text) return text;
        }
      } catch {
        outcome = "unreachable";
      }
      if (outcome === "unreachable") break;
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await llmFetch(
        groqChatUrl(),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.2,
            max_tokens: 2048,
            response_format: { type: "json_object" },
          }),
        },
        COMPLETE_TIMEOUT_MS,
      );
      if (res.ok) {
        const data = await res.json();
        const text: string | undefined =
          data?.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch {
      // fall through to the shared error
    }
  }

  throw new Error("No LLM provider available for JSON generation.");
}

/**
 * Extract readable text from a PDF using Gemini's multimodal input (handles
 * layout and scanned/image PDFs). Inline base64 — fine for typical uploads;
 * very large PDFs would need the Gemini File API.
 */
export async function extractPdfText(pdf: ArrayBuffer): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY is required to read PDFs.");

  const base64 = Buffer.from(pdf).toString("base64");
  // Nothing stands behind this one — Groq has no multimodal rung here — so the
  // second Gemini model is the only fallback a PDF gets. The last refusal is
  // the one that surfaces.
  let lastStatus = 0;
  for (const model of geminiLadder("deep")) {
    const res = await llmFetch(
      geminiUrl("generateContent", geminiKey, model),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: "application/pdf", data: base64 } },
                {
                  text: "Extract all readable text from this document, preserving reading order. Output ONLY the text, with no commentary.",
                },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 8192 },
        }),
      },
      PDF_TIMEOUT_MS,
    );
    if (!res.ok) {
      lastStatus = res.status;
      continue;
    }
    const data = await res.json();
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return text;
  }
  throw new Error(`PDF read failed (${lastStatus}).`);
}

/**
 * Transcribe a voice message using OpenAI Whisper served by Groq (STT).
 * `language` is an optional ISO-639-1 hint (Raya is multilingual).
 */
export async function transcribeAudio(
  audio: Blob,
  filename = "audio.webm",
  language?: string,
): Promise<{ text: string; model: string }> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY is required for transcription.");

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", GROQ_WHISPER_MODEL);
  form.append("response_format", "json");
  if (language) form.append("language", language);

  const res = await llmFetch(
    groqSttUrl(),
    {
      method: "POST",
      headers: { authorization: `Bearer ${groqKey}` },
      body: form,
    },
    STT_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new Error(`Transcription failed (${res.status}).`);
  }
  const data = await res.json();
  return { text: (data?.text ?? "").trim(), model: `groq:${GROQ_WHISPER_MODEL}` };
}
