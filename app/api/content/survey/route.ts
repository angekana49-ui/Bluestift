import { NextResponse } from "next/server";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { apiT } from "@/lib/i18n/server";

const PROFILES = new Set(["teacher", "student", "other"]);

/**
 * Public survey submission: one POST at the end of the flow writes
 * content.survey_responses + content.survey_answers. Returns the response id
 * so the done screen can attach an optional contact email afterwards.
 */
export async function POST(req: Request) {
  let body: {
    profile?: string;
    language?: string;
    answers?: Array<{ question_id?: string; answer_text?: string; answer_choice?: string }>;
    time_to_complete_seconds?: number;
    token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const profile = PROFILES.has(body.profile ?? "") ? body.profile! : "other";
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 20) : [];
  if (answers.length === 0) {
    return NextResponse.json({ error: "no_answers" }, { status: 400 });
  }
  // Captcha farms solve Turnstile for cents; a per-IP ceiling bounds what
  // one address can post regardless (lib/rate-limit.ts, fails open).
  if (!(await checkRateLimit("form_survey", clientIp(req), 60))) {
    return NextResponse.json({ error: await apiT("api.tooManyRequestsPleaseTryAgain") }, { status: 429 });
  }
  if (!(await verifyTurnstile(body.token))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 403 });
  }

  const admin = createContentAdminClient();
  const { data: response, error } = await admin
    .from("survey_responses")
    .insert({
      profile,
      language: (body.language ?? "fr").slice(0, 10),
      source: "web",
      completed: true,
      time_to_complete_seconds:
        typeof body.time_to_complete_seconds === "number" && body.time_to_complete_seconds > 0
          ? Math.min(Math.round(body.time_to_complete_seconds), 86400)
          : null,
    })
    .select("id")
    .single();
  if (error || !response) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const rows = answers
    .filter((a) => a.question_id && (a.answer_text || a.answer_choice))
    .map((a) => ({
      response_id: response.id as string,
      question_id: String(a.question_id).slice(0, 40),
      answer_text: a.answer_text ? String(a.answer_text).slice(0, 2000) : null,
      answer_choice: a.answer_choice ? String(a.answer_choice).slice(0, 200) : null,
    }));
  if (rows.length > 0) {
    await admin.from("survey_answers").insert(rows);
  }

  return NextResponse.json({ ok: true, id: response.id });
}
