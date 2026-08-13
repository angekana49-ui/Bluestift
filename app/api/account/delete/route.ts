import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eraseAccount, recordDataRequest } from "@/lib/compliance/erasure";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";

/**
 * "Delete my account" — GDPR art. 17, and the deletion right a parent or school
 * exercises on a child's behalf under COPPA.
 *
 * The confirmation phrase is not ceremony: this is irreversible and there is no
 * soft-delete behind it, so the request has to be unambiguous rather than a
 * mis-click. Identity comes from the session; the body only carries the intent.
 *
 * A school-linked student can still delete their own account. The school's own
 * records are the school's to keep — it remains the controller for them, and
 * the UI says so before the button is pressed — but the account, the tutoring
 * content and the cognitive profile belong to the student.
 */
export const maxDuration = 60;

const CONFIRM = "DELETE";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.confirm !== "string" || body.confirm.trim().toUpperCase() !== CONFIRM) {
    return NextResponse.json(
      { error: `Type ${CONFIRM} to confirm.` },
      { status: 400 },
    );
  }

  if (!(await checkStrictUserRateLimit("account_delete", user.id, 3, "1 hour"))) {
    return NextResponse.json({ error: "Too many attempts — try again shortly." }, { status: 429 });
  }

  // Read the school link BEFORE the row is gone: it belongs in the audit note,
  // and afterwards there is nothing left to read it from.
  let schoolId: string | null = null;
  try {
    const { data } = await createAdminClient()
      .from("users")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    schoolId = data?.school_id ?? null;
  } catch {
    // the note is a nicety; never block an erasure on it
  }

  const report = await eraseAccount(user.id);

  await recordDataRequest({
    userId: user.id,
    kind: "erasure",
    outcome: report.ok ? "fulfilled" : "partial",
    note: [
      schoolId ? `school:${schoolId}` : null,
      report.failed.length ? `failed: ${report.failed.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || undefined,
  });

  if (!report.ok) {
    // Some of it is already gone, so this is not a clean "nothing happened".
    // Say so plainly rather than reporting a success we didn't achieve.
    return NextResponse.json(
      {
        error:
          "We removed most of your data but part of the deletion failed. " +
          "Write to hello@thebluestift.com and we'll finish it by hand.",
        failed: report.failed,
      },
      { status: 500 },
    );
  }

  // The session's user no longer exists; clear the cookies so the browser
  // doesn't keep presenting a token for a deleted account.
  try {
    await supabase.auth.signOut();
  } catch {
    // the account is gone either way
  }

  return NextResponse.json({ ok: true, removed: report.removed });
}
