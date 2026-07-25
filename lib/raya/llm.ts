import "server-only";

export type ChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const GROQ_WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const TEMPERATURE = 0.4;
const MAX_TOKENS = 600;

/**
 * Generate a Raya reply. Gemini primary, Groq fallback.
 * Server-only; keys never reach the client.
 */
export async function rayaComplete(
  messages: ChatMsg[],
): Promise<{ text: string; model: string }> {
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
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
      });
      if (res.ok) {
        const data = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        if (text) return { text, model: `gemini:${GEMINI_MODEL}` };
      }
    } catch {
      // fall through to Groq
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text: string | undefined =
        data?.choices?.[0]?.message?.content?.trim();
      if (text) return { text, model: `groq:${GROQ_MODEL}` };
    }
  }

  throw new Error(
    "No LLM provider available. Set GEMINI_API_KEY (or GROQ_API_KEY).",
  );
}

/** Read a fetch body as SSE `data:` payloads. */
async function* sseData(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

async function* geminiDeltas(res: Response): AsyncGenerator<string> {
  for await (const data of sseData(res)) {
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

async function* groqDeltas(res: Response): AsyncGenerator<string> {
  for await (const data of sseData(res)) {
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
 * fails to start, Groq fallback. Returns the chosen model + a delta stream.
 */
export async function rayaStream(
  messages: ChatMsg[],
): Promise<{ model: string; stream: AsyncGenerator<string> }> {
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${geminiKey}`;
      const res = await fetch(url, {
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
      });
      if (res.ok && res.body) {
        return { model: `gemini:${GEMINI_MODEL}`, stream: geminiDeltas(res) };
      }
    } catch {
      // fall through to Groq
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        stream: true,
      }),
    });
    if (res.ok && res.body) {
      return { model: `groq:${GROQ_MODEL}`, stream: groqDeltas(res) };
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
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
      });
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
    const res = await fetch(GROQ_CHAT_URL, {
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
    });
    if (res.ok) {
      const data = await res.json();
      const text: string | undefined =
        data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;
  const res = await fetch(url, {
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
  });
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

  const res = await fetch(GROQ_STT_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcription failed (${res.status}).`);
  }
  const data = await res.json();
  return { text: (data?.text ?? "").trim(), model: `groq:${GROQ_WHISPER_MODEL}` };
}
