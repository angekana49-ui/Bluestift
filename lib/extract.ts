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
 * Extract readable text from an uploaded file. Text as-is, audio via Whisper,
 * PDF via Gemini multimodal, .docx via mammoth, .xlsx via SheetJS. Server-only.
 */
export async function extractFileText(
  file: File,
): Promise<{ text: string; kind: ExtractKind }> {
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
