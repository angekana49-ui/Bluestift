import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { resolveRayaEntitlements, gateQuota, sinceDaysIso } from "@/lib/entitlements";
import { captureServer } from "@/lib/analytics/server";
import { siteUrl } from "@/lib/email";

export const runtime = "nodejs";

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

  // Exports are quota-metered per week (Free: 5; the grid counts TXT + shares,
  // but only the share is server-side, so this meters the shareable exports).
  // TXT/PDF happen client-side in the branded reader — gate those in the UI from
  // the same entitlements (pdfExport / exportsPerWeek) as a follow-up.
  const { ent, tier } = await resolveRayaEntitlements(user.id);
  const { count: shareUsed } = await supabase
    .schema("learning")
    .from("shares")
    .select("token", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", sinceDaysIso(7));
  const overShare = gateQuota(shareUsed ?? 0, ent.exportsPerWeek, {
    metric: "exports",
    period: "week",
    upgradeTo: "Plus",
    scope: "share",
    userId: user.id,
    tier,
  });
  if (overShare) return overShare;

  const token = randomBytes(9).toString("base64url");
  const { error } = await supabase
    .schema("learning")
    .from("shares")
    .insert({ token, user_id: user.id, kind: "doc", title: title || null, body: content, brand });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void captureServer(user.id, "doc_shared", { brand, tier });
  // Never reflect Host/X-Forwarded-Host into a link: those headers are request
  // metadata, not an authority for choosing an externally visible origin.
  return NextResponse.json({ token, url: `${siteUrl("bluestift")}/s/${token}` });
}

/**
 * The caller's live shares, newest first. Deliberately WITHOUT `body`: this is a
 * management list, not a reader, and shipping every shared document's full text
 * into a settings page is bandwidth nobody asked for. Revoked shares are omitted
 * — the question the screen answers is "what of mine is public right now".
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .schema("learning")
    .from("shares")
    .select("token, title, brand, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    shares: (data ?? []).map((s) => ({
      token: s.token,
      title: s.title,
      brand: s.brand,
      createdAt: s.created_at,
      url: `${siteUrl("bluestift")}/s/${s.token}`,
    })),
  });
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
  // Report what actually happened. The previous version answered `ok: true`
  // unconditionally, so a revocation that matched no row — wrong token, already
  // revoked, or someone else's share — looked exactly like a successful one. On
  // a "stop sharing my work" button that is the worst possible lie to tell.
  const { data: revoked, error } = await supabase
    .schema("learning")
    .from("shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("token");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Deliberately the same answer for "not yours" and "already revoked": the
  // caller must not be able to probe which tokens exist. Either way the link is
  // not live on their behalf.
  return NextResponse.json({ ok: true, revoked: (revoked?.length ?? 0) > 0 });
}
