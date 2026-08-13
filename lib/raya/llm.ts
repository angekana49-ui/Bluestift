import "server-only";
import { withTimeout } from "@/lib/net/timeout";
import type { ModelTier } from "@/lib/raya/routing";

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
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
  return override || GEMINI_MODEL;
}
function groqModel(tier: ModelTier): string {
  const override = tier === "deep" ? process.env.GROQ_MODEL_DEEP : process.env.GROQ_MODEL_FAST;
  return override || GROQ_MODEL;
}
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3";
const TEMPERATURE = 0.4;
const MAX_TOKENS = 600;

// Base URLs are env-overridable so tests and outage drills (point Gemini at a
// blackhole IP) can exercise the fallback path without code edits. Read at
// call time, not module load, so vi.stubEnv works.
function geminiUrl(
  method: "generateContent" | "streamGenerateContent",
  key: string,
  model: string = GEMINI_MODEL,
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
 * Generate a Raya reply. Gemini primary, Groq fallback.
 * Server-only; keys never reach the client.
 */
export async function rayaComplete(
  messages: ChatMsg[],
  tier: ModelTier = "deep",
): Promise<{ text: string; model: string }> {
  // Defaults to "deep" on purpose: an un-routed caller keeps today's behaviour
  // rather than being silently downgraded to a cheaper model.
  const gModel = geminiModel(tier);
  const qModel = groqModel(tier);
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
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
      // fall through to Groq (includes our deadline abort)
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
): Promise<StreamStart | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), firstByteMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok || !res.body) {
      controller.abort();
      return null;
    }
    // The SAME deadline also covers the first body chunk — bounded explicitly
    // here (not just via the abort timer) so a body that never produces can't
    // hold us past it.
    const reader = res.body.getReader();
    const remaining = Math.max(1, firstByteMs - (Date.now() - startedAt));
    const first = await withTimeout(reader.read(), remaining, null);
    if (!first || first.done || !first.value) {
      controller.abort();
      return null;
    }
    return { reader, firstChunk: first.value };
  } catch {
    return null;
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

async function* geminiDeltas(start: StreamStart): AsyncGenerator<string> {
  for await (const data of sseData(start)) {
    if (!data) continue;
    try {
      const json = JSON.parse(data);
      const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (text) yield text;
    } catch {
      // ignore keep-alive / partial lines
    }
  }
}

async function* groqDeltas(start: StreamStart): AsyncGenerator<string> {
  for await (const data of sseData(start)) {
    if (!data || data === "[DONE]") continue;
    try {
      const json = JSON.parse(data);
      const text: string = json?.choices?.[0]?.delta?.content ?? "";
      if (text) yield text;
    } catch {
      // ignore
    }
  }
}

/**
 * Streaming Raya reply for minimal perceived latency. Gemini primary; if it
 * fails to produce a first byte within FIRST_BYTE_MS, Groq fallback (same
 * deadline). Returns the chosen model + a delta stream.
 */
export async function rayaStream(
  messages: ChatMsg[],
  tier: ModelTier = "deep",
): Promise<{ model: string; stream: AsyncGenerator<string> }> {
  const gModel = geminiModel(tier);
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
    const start = await startSse(
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
      return { model: `gemini:${gModel}`, stream: geminiDeltas(start) };
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const start = await startSse(
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
      return { model: `groq:${qModel}`, stream: groqDeltas(start) };
    }
  }

  throw new Error(
    "No LLM provider available. Set GEMINI_API_KEY (or GROQ_API_KEY).",
  );
}

/**
 * Structured generation with JSON mode ON for both providers so the output is
 * always valid JSON (Gemini responseMimeType, Groq response_format). Returns
 * the raw JSON string. Gemini primary -> Groq fallback.
 */
export async function generateJson(
  system: string,
  user: string,
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const res = await llmFetch(
        geminiUrl("generateContent", geminiKey),
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
      // fall through to Groq
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
  const res = await llmFetch(
    geminiUrl("generateContent", geminiKey),
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
  if (!res.ok) throw new Error(`PDF read failed (${res.status}).`);
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  return text;
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
