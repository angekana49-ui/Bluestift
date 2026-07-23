import "server-only";
import { NextResponse } from "next/server";

/**
 * Upload size ceilings, enforced in-route because the `user-media` bucket has no
 * `file_size_limit` and — more importantly — Supabase's limit only fires at
 * `.upload()`, AFTER `request.formData()` has already buffered the whole file
 * into the function's memory and (for docs) the extractor has parsed it. These
 * guards reject earlier, from the Content-Length header first.
 */

/** Documents fed to the extractor (pdf/docx/xlsx/text/images). */
export const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MB
/** Audio for Whisper — Groq caps the model at 25 MB anyway. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Multipart framing adds a bit over the raw file, so the Content-Length
 * pre-check allows slack — a file *at* the limit must not be wrongly rejected.
 * The authoritative check is `tooLarge` on the parsed File.
 */
const CONTENT_LENGTH_SLACK = 1024 * 1024; // 1 MB

function tooLargeResponse(maxBytes: number): NextResponse {
  return NextResponse.json(
    { error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).` },
    { status: 413 },
  );
}

/**
 * Reject an oversized upload from the Content-Length header, BEFORE
 * `request.formData()` buffers the body. Cheap first line of defense; returns a
 * 413 response when over budget, else null.
 */
export function contentLengthExceeds(
  request: Request,
  maxBytes: number,
): NextResponse | null {
  const len = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(len) && len > maxBytes + CONTENT_LENGTH_SLACK) {
    return tooLargeResponse(maxBytes);
  }
  return null;
}

/** Authoritative size check on the parsed File/Blob. Returns a 413 or null. */
export function tooLarge(file: Blob, maxBytes: number): NextResponse | null {
  return file.size > maxBytes ? tooLargeResponse(maxBytes) : null;
}
