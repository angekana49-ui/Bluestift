import { NextResponse } from "next/server";
import { createContentAdminClient, createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const MAX_FILE = 15 * 1024 * 1024; // 15 MB, matches the bucket limit

/**
 * Public research contribution proposal -> content.contributions (status: pending).
 * Accepts multipart form data so a proposer can attach a document (paper, dataset,
 * slides…). The file is stored in the private `contributions` bucket and its path
 * kept on `storage_path`; the research team reads it later via a signed URL.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const title = str("title").trim().slice(0, 200);
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!(await verifyTurnstile(str("token")))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  // Optional attachment.
  let storagePath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    const admin = createAdminClient();
    const up = await admin.storage
      .from("contributions")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (up.error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    storagePath = path;
  }

  const admin = createContentAdminClient();
  const { error } = await admin.from("contributions").insert({
    title,
    contributor_name: str("name").trim().slice(0, 120) || null,
    email: str("email").trim().toLowerCase().slice(0, 254) || null,
    category: (str("category") || "other").trim().slice(0, 40),
    description: str("description").trim().slice(0, 4000) || null,
    storage_path: storagePath,
  });
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
