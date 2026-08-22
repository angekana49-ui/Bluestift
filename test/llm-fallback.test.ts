import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rayaStream, rayaComplete } from "@/lib/raya/llm";

/**
 * The LLM layer's degraded-network contract: a provider that hangs (at
 * connect, at headers, or before its first byte) must fail FAST into the next
 * provider, and a stream that starts must not lose or duplicate its first
 * chunk. All network is mocked; provider is identified by URL.
 */

function sseBody(events: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(enc.encode(e));
      controller.close();
    },
  });
}

function sseResponse(events: string[]): Response {
  return new Response(sseBody(events), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** A fetch that never responds; rejects with AbortError when aborted. */
function hang(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
  });
}

const geminiEvent = (text: string) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n`;
const groqEvent = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`;

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const d of stream) out += d;
  return out;
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-gemini");
  vi.stubEnv("GROQ_API_KEY", "test-groq");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rayaStream first-byte fallback", () => {
  it("streams from Gemini when it answers in time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        expect(String(url)).toContain("generativelanguage");
        return sseResponse([geminiEvent("Hello"), geminiEvent(" there")]);
      }),
    );
    const { model, stream } = await rayaStream([{ role: "user", content: "hi" }]);
    expect(model).toContain("gemini");
    expect(await collect(stream)).toBe("Hello there");
  });

  it("falls back to Groq when Gemini hangs before headers", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("generativelanguage")) return hang(url, init);
      return Promise.resolve(sseResponse([groqEvent("From Groq")]));
    });
    vi.stubGlobal("fetch", fetchMock);
    const p = rayaStream([{ role: "user", content: "hi" }]);
    await vi.advanceTimersByTimeAsync(1500); // Gemini first-byte deadline
    const { model, stream } = await p;
    expect(model).toContain("groq");
    vi.useRealTimers();
    expect(await collect(stream)).toBe("From Groq");
  });

  it("falls back when Gemini sends headers but never a first byte", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      if (String(url).includes("generativelanguage")) {
        // Headers arrive, body never produces a chunk.
        return Promise.resolve(
          new Response(new ReadableStream<Uint8Array>({ start() {} }), { status: 200 }),
        );
      }
      return Promise.resolve(sseResponse([groqEvent("Groq speaks")]));
    });
    vi.stubGlobal("fetch", fetchMock);
    const p = rayaStream([{ role: "user", content: "hi" }]);
    await vi.advanceTimersByTimeAsync(1500);
    const { model, stream } = await p;
    expect(model).toContain("groq");
    vi.useRealTimers();
    expect(await collect(stream)).toBe("Groq speaks");
  });

  it("does not lose text when Gemini's whole reply is in the first chunk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([geminiEvent("All at once")])),
    );
    const { stream } = await rayaStream([{ role: "user", content: "hi" }]);
    expect(await collect(stream)).toBe("All at once");
  });

  it("throws when both providers miss their deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(hang));
    const p = rayaStream([{ role: "user", content: "hi" }]).catch((e) => e);
    await vi.advanceTimersByTimeAsync(3000); // both first-byte deadlines
    expect(await p).toBeInstanceOf(Error);
  });

  it("falls back on a Gemini HTTP error (pre-deadline)", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("generativelanguage")) {
        return new Response("quota", { status: 429 });
      }
      return sseResponse([groqEvent("ok")]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { model } = await rayaStream([{ role: "user", content: "hi" }]);
    expect(model).toContain("groq");
  });
});

describe("rayaComplete deadline", () => {
  it("falls back to Groq when the Gemini request hangs", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes("generativelanguage")) return hang(url, init);
      return Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "Groq answer" } }] }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const p = rayaComplete([{ role: "user", content: "hi" }]);
    await vi.advanceTimersByTimeAsync(10_000); // completion deadline
    const { text, model } = await p;
    expect(text).toBe("Groq answer");
    expect(model).toContain("groq");
  });
});

/**
 * What a turn cost. The counts ride on the SSE payloads the delta parsers were
 * already throwing away, so these pin two things: that they are read at all,
 * and that "the provider said nothing" stays null rather than becoming a zero
 * that would make an unmeasured turn look free.
 */
describe("rayaStream token usage", () => {
  const geminiUsageEvent = (text: string, prompt: number, completion: number) =>
    `data: ${JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: {
        promptTokenCount: prompt,
        candidatesTokenCount: completion,
        totalTokenCount: prompt + completion,
      },
    })}\n`;

  it("reads Gemini's counts off the stream", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([geminiUsageEvent("Hi", 120, 34)])));
    const { stream, usage } = await rayaStream([{ role: "user", content: "hi" }]);
    await collect(stream);
    expect(usage).toEqual({ prompt: 120, completion: 34, total: 154 });
  });

  it("takes Gemini's running totals as totals, not as increments", async () => {
    // Gemini repeats usageMetadata on every chunk with cumulative counts.
    // Summing them would bill this turn 3× what it cost.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          geminiUsageEvent("one ", 100, 5),
          geminiUsageEvent("two ", 100, 12),
          geminiUsageEvent("three", 100, 20),
        ]),
      ),
    );
    const { stream, usage } = await rayaStream([{ role: "user", content: "hi" }]);
    await collect(stream);
    expect(usage.total).toBe(120);
  });

  it("reads Groq's counts off the final chunk", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          groqEvent("From Groq"),
          `data: ${JSON.stringify({
            choices: [{ delta: {} }],
            x_groq: { usage: { prompt_tokens: 88, completion_tokens: 9, total_tokens: 97 } },
          })}\n`,
        ]),
      ),
    );
    const { model, stream, usage } = await rayaStream([{ role: "user", content: "hi" }]);
    expect(model).toContain("groq");
    await collect(stream);
    expect(usage).toEqual({ prompt: 88, completion: 9, total: 97 });
  });

  it("leaves the counts null when the provider reports none", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([geminiEvent("no counts here")])));
    const { stream, usage } = await rayaStream([{ role: "user", content: "hi" }]);
    await collect(stream);
    // Not zero: an unmeasured turn is unknown, and summing it as free would
    // understate exactly the cost this exists to reveal.
    expect(usage).toEqual({ prompt: null, completion: null, total: null });
  });

  it("rejects a count that is not a number instead of coercing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Hi" }] } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: null, totalTokenCount: "many" },
          })}\n`,
        ]),
      ),
    );
    const { stream, usage } = await rayaStream([{ role: "user", content: "hi" }]);
    await collect(stream);
    expect(usage).toEqual({ prompt: 10, completion: null, total: null });
  });

  it("is only known once the stream has been drained", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([geminiUsageEvent("Hi", 10, 2)])));
    const { stream, usage } = await rayaStream([{ role: "user", content: "hi" }]);
    expect(usage.total).toBeNull(); // nothing consumed yet
    await collect(stream);
    expect(usage.total).toBe(12);
  });
});
