import { NextResponse } from "next/server";
import { createAdminClient, adminRpc } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily anon-account lifecycle (triggered by Vercel Cron — see vercel.json).
 * Reaps abandoned anonymous accounts so lost/unrecovered ones don't pile up:
 *   - inactive > DEACTIVATE_DAYS  → account_state='dormant' + Supabase ban
 *     (a returning user is un-banned + reactivated in /api/auth/recover).
 *   - inactive > DELETE_DAYS      → hard-deleted (cascades to all their data).
 * Scope is enforced in SQL: only accounts with NO real email AND not tied to a
 * school (no school_id / enrollment / student_identity / school_admins).
 * Inactivity = coalesce(auth.users.last_sign_in_at, created_at).
 *
 * Protected by CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * on scheduled invocations when that env var is set.
 */
const DEACTIVATE_DAYS = Number(process.env.ANON_DEACTIVATE_DAYS ?? "60");
const DELETE_DAYS = Number(process.env.ANON_DELETE_DAYS ?? "180");
const BATCH = 500;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Delete first so we never bother banning an account we're about to remove.
  const { data: deleted, error: delErr } = await adminRpc<number>(admin, "delete_expired_anons", {
    p_days: DELETE_DAYS,
    p_limit: BATCH,
  });
  if (delErr) {
    return NextResponse.json({ error: "delete_failed", detail: delErr.message }, { status: 500 });
  }

  const { data: deactivated, error: deactErr } = await adminRpc<number>(admin, "deactivate_dormant_anons", {
    p_days: DEACTIVATE_DAYS,
    p_limit: BATCH,
  });
  if (deactErr) {
    return NextResponse.json({ error: "deactivate_failed", detail: deactErr.message }, { status: 500 });
  }

  const { data: pruned } = await adminRpc<number>(admin, "prune_signup_ip_events", { p_days: 2 });

  return NextResponse.json({
    ok: true,
    deleted: deleted ?? 0,
    deactivated: deactivated ?? 0,
    prunedSignupEvents: pruned ?? 0,
  });
}
