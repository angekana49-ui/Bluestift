import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createContentAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/ops";
import { QUARANTINE_BUCKET } from "@/lib/research/publish";

export const runtime = "nodejs";

/** Owner-only reject: drop the quarantined file and close the proposal. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const reason = (typeof body.reason === "string" ? body.reason : "").trim().slice(0, 500) || null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const content = createContentAdminClient();
  const { data: row } = await content
    .from("contributions")
    .select("id, storage_path, status")
    .eq("id", id)
    .maybeSingle();
  const contribution = row as { id: string; storage_path: string | null; status: string } | null;
  if (!contribution) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contribution.status !== "pending") {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  if (contribution.storage_path) {
    try {
      await createAdminClient().storage.from(QUARANTINE_BUCKET).remove([contribution.storage_path]);
    } catch {
      /* the row still closes below; storage is cleaned manually */
    }
  }

  const { error } = await content
    .from("contributions")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "reject_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
