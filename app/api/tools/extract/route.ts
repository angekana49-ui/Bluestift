import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, extractPdfText } from "@/lib/raya/llm";
import { storageSafeName } from "@/lib/extract";

// Transcription / PDF reading can take a moment.
export const runtime = "nodejs";
export const maxDuration = 60;

type Kind = "text" | "csv" | "audio" | "pdf" | "docx" | "xlsx" | "unsupported";

function kindOf(file: File): Kind {
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
 * Upload a file to the private bucket, record it in rag.user_media, and return
 * its extracted text. Text extraction: plain text as-is, audio via Whisper
 * (Groq), PDF via pdf-parse. The returned text feeds /api/tools/generate.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  const kind = kindOf(file);
  if (kind === "unsupported") {
    return NextResponse.json(
      { error: "Unsupported file. Use text (.txt/.md), PDF, or audio." },
      { status: 400 },
    );
  }

  // Extract text first, so the stored media row carries it (making the doc
  // reusable for other tools straight from the library — no re-transcription).
  let text = "";
  try {
    if (kind === "text" || kind === "csv") {
      text = await file.text();
    } else if (kind === "audio") {
      text = (await transcribeAudio(file, file.name)).text;
    } else if (kind === "pdf") {
      text = await extractPdfText(await file.arrayBuffer());
    } else if (kind === "docx") {
      // Variable specifier + serverExternalPackages: not bundled; requires
      // `mammoth` installed at runtime.
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
    text = text.trim();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "extraction failed" },
      { status: 502 },
    );
  }
  if (!text) {
    return NextResponse.json(
      { error: "No text could be extracted from this file." },
      { status: 422 },
    );
  }

  // Store the file + record it with its extracted text (best-effort).
  let mediaId: string | null = null;
  try {
    const path = `${user.id}/${Date.now()}-${storageSafeName(file.name)}`;
    const up = await supabase.storage.from("user-media").upload(path, file);
    if (!up.error) {
      const { data } = await supabase
        .schema("rag")
        .from("user_media")
        .insert({
          user_id: user.id,
          url: path,
          type: kind === "audio" ? "audio" : kind === "pdf" ? "pdf" : "other",
          title: file.name,
          size_bytes: file.size,
          extracted_text: text.slice(0, 200000),
        })
        .select("id")
        .single();
      mediaId = data?.id ?? null;
    }
  } catch {
    // non-fatal — the extracted text is still returned to the client
  }

  return NextResponse.json({ text, media_id: mediaId, kind });
}
