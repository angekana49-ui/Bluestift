import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient, adminRpc } from "@/lib/supabase/admin";
import { eraseAccount } from "@/lib/compliance/erasure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily anon-account lifecycle (triggered by Vercel Cron — see vercel.json).
 * Reaps abandoned anonymous accounts so lost/unrecovered ones don't pile up:
 *   - inactive > DEACTIVATE_DAYS  → account_state='dormant' + Supabase ban
 *     (a returning user is un-banned + reactivated in /api/auth/recover).
 *   - inactive > DELETE_DAYS      → fully erased.
 * Scope is enforced in SQL: only accounts with NO real email AND not tied to a
 * school (no school_id / enrollment / student_identity / school_admins).
 * Inactivity = coalesce(auth.users.last_sign_in_at, created_at).
 *
 * Erasure runs through lib/compliance/erasure.ts — the same routine as the
 * user's own delete button — rather than a bare SQL delete. A cascade from
 * auth.users misses the kernel schema, the embeddings and object storage, and
 * maintaining that list of exceptions in two places is how one of them ends up
 * wrong. The cost is one API call per account instead of one per batch, hence
 * the much smaller batch: this runs daily and has no deadline.
 *
 * Protected by CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * on scheduled invocations when that env var is set.
 */
const DEACTIVATE_DAYS = Number(process.env.ANON_DEACTIVATE_DAYS ?? "60");
const DELETE_DAYS = Number(process.env.ANON_DELETE_DAYS ?? "180");
const DEACTIVATE_BATCH = 500;
const DELETE_BATCH = 50;

/**
 * Constant-time bearer check. `!==` on a secret leaks its prefix through timing;
 * the window is narrow over HTTP, but this endpoint erases accounts, so it is not
 * the place to rely on the attack being inconvenient. Compares digests-of-equal-
 * length so a length mismatch doesn't throw and doesn't leak the length either.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // unset = closed, never open
  const presented = request.headers.get("authorization") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Delete first so we never bother banning an account we're about to remove.
  const { data: expired, error: listErr } = await adminRpc<{ list_expired_anons: string }[] | string[]>(
    admin,
    "list_expired_anons",
    { p_days: DELETE_DAYS, p_limit: DELETE_BATCH },
  );
  if (listErr) {
    return NextResponse.json({ error: "list_failed", detail: listErr.message }, { status: 500 });
  }

  // A set-returning function comes back either as bare uuids or as one-key rows
  // depending on the client version; accept both rather than depend on it.
  const ids = (expired ?? []).map((row) =>
    typeof row === "string" ? row : row.list_expired_anons,
  );

  let deleted = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const report = await eraseAccount(id);
    if (report.ok) deleted += 1;
    // A partial erasure is worth surfacing: it means data survived a deletion
    // we consider done, which is exactly the failure nobody notices.
    else failures.push(`${id}:${report.failed.join(",")}`);
  }

  const { data: deactivated, error: deactErr } = await adminRpc<number>(admin, "deactivate_dormant_anons", {
    p_days: DEACTIVATE_DAYS,
    p_limit: DEACTIVATE_BATCH,
  });
  if (deactErr) {
    return NextResponse.json({ error: "deactivate_failed", detail: deactErr.message }, { status: 500 });
  }

  const { data: pruned } = await adminRpc<number>(admin, "prune_signup_ip_events", { p_days: 2 });

  return NextResponse.json({
    ok: failures.length === 0,
    deleted,
    deleteFailures: failures,
    deactivated: deactivated ?? 0,
    prunedSignupEvents: pruned ?? 0,
  });
}
