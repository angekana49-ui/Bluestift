import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUserRateLimit } from "@/lib/rate-limit";
import {
  MAX_DOC_CHARS,
  isSupportedLocale,
  translateDocument,
} from "@/lib/documents/translate";

export const runtime = "nodejs";

/**
 * Translate a generated document into one of the four shipped languages.
 *
 * Authenticated, because it spends a model call. The body comes FROM the client
 * — the document was built there, out of data the client already holds — which
 * is fine for what this does (it translates the text it is handed and hands it
 * straight back to the same caller) but is exactly why the size cap and the rate
 * limit below are not optional: without them this is an open translation
 * endpoint billed to us.
 *
 * The cache does the real work. See lib/documents/translate.ts: the key is the
 * document's content, so a class of thirty students summarising the same lesson
 * pays for one translation per language between them.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { title?: unknown; meta?: unknown; body?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const meta = typeof body.meta === "string" ? body.meta : null;
  const text = typeof body.body === "string" ? body.body : "";
  const locale = body.locale;

  if (!isSupportedLocale(locale)) {
    return NextResponse.json({ error: "unsupported language" }, { status: 400 });
  }
  if (!title.trim() || !text.trim()) {
    return NextResponse.json({ error: "nothing to translate" }, { status: 400 });
  }
  if (title.length + text.length > MAX_DOC_CHARS) {
    // A document, not a corpus. The cap is above anything this product
    // generates and well below what would make one call expensive.
    return NextResponse.json({ error: "document too long to translate" }, { status: 413 });
  }

  // Per USER, not per IP: in our markets a whole school shares one NAT, and an
  // IP bucket would let one class throttle the building.
  if (!(await checkUserRateLimit("doc_translate", user.id, 40, "60 minutes"))) {
    return NextResponse.json(
      { error: "Too many translations just now — try again shortly." },
      { status: 429 },
    );
  }

  const result = await translateDocument({ title, meta, body: text }, locale);

  // `translated: false` is a 200, deliberately. It means "here is the document
  // you asked for, in its original language" — the caller can still download it,
  // and telling them so is more useful than an error where a file was expected.
  return NextResponse.json({
    title: result.doc.title,
    meta: result.doc.meta ?? null,
    body: result.doc.body,
    translated: result.translated,
    cached: result.cached,
  });
}
