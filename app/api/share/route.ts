import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Public origin from the proxied request (so the returned link is the real host). */
function originOf(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/**
 * Create a public, read-only share of a branded document (notes, a test result,
 * a progression summary…). Stores the Markdown body under a random token; the
 * page at /s/[token] renders it. Only the content the user chose to share is
 * stored — nothing is pulled implicitly.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { title?: string; body?: string; brand?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const title = (body.title ?? "").toString().slice(0, 200);
  const content = (body.body ?? "").toString().slice(0, 100000);
  const brand = body.brand === "bluestift" ? "bluestift" : "raya";
  if (!content.trim()) return NextResponse.json({ error: "nothing to share" }, { status: 400 });

  const token = randomBytes(9).toString("base64url");
  const { error } = await supabase
    .schema("learning")
    .from("shares")
    .insert({ token, user_id: user.id, kind: "doc", title: title || null, body: content, brand });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token, url: `${originOf(request)}/s/${token}` });
}

/** Revoke a share (owner only). */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  await supabase
    .schema("learning")
    .from("shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token)
    .eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
