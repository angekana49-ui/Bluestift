import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildDataExport } from "@/lib/compliance/export";
import { recordDataRequest } from "@/lib/compliance/erasure";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";

/**
 * "Download my data" — GDPR art. 15 (access) and art. 20 (portability) served
 * on the spot rather than through a support queue, which is the difference
 * between a right and a promise.
 *
 * GET so a browser can simply follow the link and get a file.
 */
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Assembling a bundle touches every schema, so it is worth a modest cap. Well
  // above what anyone exercising the right would ever need.
  if (!(await checkStrictUserRateLimit("data_export", user.id, 5, "1 hour"))) {
    return NextResponse.json(
      { error: "You've requested several exports recently — try again shortly." },
      { status: 429 },
    );
  }

  const bundle = await buildDataExport(user.id, user.email ?? null);
  const partial = Array.isArray(bundle._errors) && bundle._errors.length > 0;
  await recordDataRequest({
    userId: user.id,
    kind: "export",
    outcome: partial ? "partial" : "fulfilled",
    note: partial ? `incomplete sections: ${(bundle._errors as string[]).join(", ")}` : undefined,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="bluestift-data-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
