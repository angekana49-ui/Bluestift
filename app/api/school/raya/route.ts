import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildProfContext, buildSchoolContext, getAdminMembership } from "@/lib/school-admin";
import { rayaComplete, type ChatMsg } from "@/lib/raya/llm";

const SYSTEM = `You are RAYA for Schools, an analytics assistant for a school staff member.
Answer ONLY from the DATA SNAPSHOT below — never invent students, classes, or numbers.
Be concise and cite the actual figures. If the snapshot lacks the information, say so
plainly and suggest what would surface it (e.g. students using RAYA more). Reply in the
user's language.`;

/** RAYA-for-Schools: answer an admin question grounded in their school's real data. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const message = (body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "empty message" }, { status: 400 });

  const membership = await getAdminMembership(user.id);
  if (!membership) {
    return NextResponse.json({ error: "School staff only." }, { status: 403 });
  }

  // Admin sees the whole school; a prof is grounded in their assigned classes.
  const context =
    membership.role === "admin_master"
      ? await buildSchoolContext(user.id)
      : await buildProfContext(user.id);
  if (context == null) {
    return NextResponse.json(
      { error: "No school data available for you yet." },
      { status: 403 },
    );
  }

  // Recent turns only, to bound the prompt.
  const history: ChatMsg[] = (body.history ?? [])
    .slice(-8)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? "").slice(0, 2000),
    }));

  const messages: ChatMsg[] = [
    { role: "system", content: `${SYSTEM}\n\n=== DATA SNAPSHOT ===\n${context}` },
    ...history,
    { role: "user", content: message },
  ];

  try {
    const { text, model } = await rayaComplete(messages);
    return NextResponse.json({ reply: text, model });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "llm error" },
      { status: 502 },
    );
  }
}
