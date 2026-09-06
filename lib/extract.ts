import "server-only";
import { transcribeAudio, extractPdfText } from "@/lib/raya/llm";

export type ExtractKind = "text" | "csv" | "audio" | "pdf" | "docx" | "xlsx" | "unsupported";

/**
 * Make a filename safe for a Supabase Storage object key. Storage rejects keys
 * with non-ASCII characters (accents, en-dashes…) — an accented name like
 * "résumé.pdf" would 500 the upload. Diacritics are folded, everything outside
 * [word/./-] becomes "_". Keep the ORIGINAL name for display; use this only for
 * the storage path.
 */
export function storageSafeName(name: string): string {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "") // drop non-ASCII (incl. combining diacritics)
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe.slice(-100) || "file";
}

export function kindOf(file: File): ExtractKind {
  const n = file.name.toLowerCase();
  if (/\.csv$/.test(n) || file.type === "text/csv") return "csv";
  if (file.type.startsWith("text/") || /\.(txt|md|markdown)$/.test(n)) return "text";
  if (file.type.startsWith("audio/") || /\.(mp3|m4a|wav|webm|ogg|flac|mpga)$/.test(n))
    return "audio";
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".xlsx")) return "xlsx";
  return "unsupported";
}

/**
 * How long any one file may occupy the extractor.
 *
 * `.docx` and `.xlsx` are ZIP containers, and neither mammoth nor SheetJS
 * exposes a bound on how far they will decompress. A 25 MB upload of
 * pathologically compressible XML — a "zip bomb" — therefore expands without a
 * ceiling, and the symptom is not an error but a function that sits there
 * eating memory until the platform kills it.
 *
 * This does not stop the expansion; nothing available here does. It stops it
 * being FREE: the request gives up after a minute and the caller is told the
 * file could not be read. A real 25 MB spreadsheet parses in seconds, so the
 * bound only ever bites the pathological case.
 *
 * The upload path is authenticated and rate-limited per user on top of this,
 * so the cost of trying is bounded twice.
 */
const EXTRACT_TIMEOUT_MS = 60_000;

/** Reject rather than hang. The work continues until the process ends; what we
 *  reclaim is the request, not the CPU. */
async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("This file took too long to read. Try a smaller one.")),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Extract readable text from an uploaded file. Text as-is, audio via Whisper,
 * PDF via Gemini multimodal, .docx via mammoth, .xlsx via SheetJS. Server-only.
 */
export async function extractFileText(
  file: File,
): Promise<{ text: string; kind: ExtractKind }> {
  return withDeadline(extractInner(file), EXTRACT_TIMEOUT_MS);
}

async function extractInner(file: File): Promise<{ text: string; kind: ExtractKind }> {
  const kind = kindOf(file);
  if (kind === "unsupported") {
    throw new Error("Unsupported file. Use text (.txt/.md/.csv), PDF, Word, Excel, or audio.");
  }

  let text = "";
  if (kind === "text" || kind === "csv") {
    text = await file.text();
  } else if (kind === "audio") {
    text = (await transcribeAudio(file, file.name)).text;
  } else if (kind === "pdf") {
    text = await extractPdfText(await file.arrayBuffer());
  } else if (kind === "docx") {
    const spec: string = "mammoth";
    const mammoth = (await import(spec)) as {
      extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    text = (
      await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })
    ).value;
  } else if (kind === "xlsx") {
    const spec: string = "xlsx";
    const XLSX = (await import(spec)) as {
      read: (
        data: Uint8Array,
        opts: { type: string },
      ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_csv: (ws: unknown) => string };
    };
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
    text = wb.SheetNames.map(
      (nm) => `# ${nm}\n${XLSX.utils.sheet_to_csv(wb.Sheets[nm])}`,
    ).join("\n\n");
  }

  return { text: text.trim(), kind };
}
