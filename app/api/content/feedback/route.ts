import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

const TYPES = new Set(["bug", "praise", "feature", "suggestion", "other"]);

/** Public feedback form -> content.feedbacks (user_id attached when signed in). */
export async function POST(req: Request) {
  let body: {
    type?: string;
    rating?: number;
    message?: string;
    name?: string;
    email?: string;
    page_url?: string;
    token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const message = (body.message ?? "").trim().slice(0, 4000);
  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null;
  if (!message && !rating) {
    return NextResponse.json({ error: "empty_feedback" }, { status: 400 });
  }
  if (!(await verifyTurnstile(body.token))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createContentAdminClient();
  const { error } = await admin.from("feedbacks").insert({
    user_id: user?.id ?? null,
    type: TYPES.has(body.type ?? "") ? body.type : "other",
    rating,
    message: message || null,
    name: (body.name ?? "").trim().slice(0, 120) || null,
    email: (body.email ?? "").trim().toLowerCase().slice(0, 254) || null,
    page_url: (body.page_url ?? "").trim().slice(0, 500) || null,
  });
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
