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
