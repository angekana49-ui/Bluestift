import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import {
  buildClassContext,
  buildSchoolContext,
  buildSubjectContext,
  getAdminMembership,
  getSchoolSubjects,
} from "@/lib/school-admin";
import { rayaComplete, type ChatMsg } from "@/lib/raya/llm";

const SYSTEM = `You are RAYA for Schools. Write a concise performance report for a school
administrator, in the administrator's language, using ONLY the DATA below — never invent
students, classes, or numbers. Use this Markdown structure:
# Overview  (1-2 sentences with the key figures)
## Highlights
## Students needing attention  (name + why, from the data)
## Recommendations  (2-4 concrete, specific actions)
If a section has no supporting data, write "No data yet." Keep it tight.`;

type ReportRow = { id: string; scope: string | null; parameters: unknown; created_at: string };

/** List past reports for the admin's school (best-effort). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("reports")
      .select("id, scope, parameters, created_at")
      .eq("school_id", membership.schoolId)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data as ReportRow[] | null) ?? [];
    const reports = rows.map((r) => {
      const p = (r.parameters ?? {}) as { title?: string; content?: string };
      return { id: r.id, scope: r.scope, title: p.title ?? "Report", content: p.content ?? "", createdAt: r.created_at };
    });
    const subjects = await getSchoolSubjects(user.id);
    return NextResponse.json({ reports, subjects });
  } catch {
    return NextResponse.json({ reports: [], subjects: [] });
  }
}

/** Generate a grounded report for the whole school or one class. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { scope?: string; classId?: string; subjectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const scope = body.scope === "class" || body.scope === "subject" ? body.scope : "school";

  let context: string;
  let title: string;
  if (scope === "class") {
    if (!body.classId) return NextResponse.json({ error: "classId is required." }, { status: 400 });
    const cc = await buildClassContext(user.id, body.classId);
    if (!cc) return NextResponse.json({ error: "Class not found or not yours." }, { status: 404 });
    context = cc.context;
    title = `${cc.className} — performance report`;
  } else if (scope === "subject") {
    if (!body.subjectId) return NextResponse.json({ error: "subjectId is required." }, { status: 400 });
    const sc = await buildSubjectContext(user.id, body.subjectId);
    if (!sc) return NextResponse.json({ error: "Subject not found or not yours." }, { status: 404 });
    context = sc.context;
    title = `${sc.subjectName} — subject report`;
  } else {
    const ctx = await buildSchoolContext(user.id);
    if (ctx == null) return NextResponse.json({ error: "no school" }, { status: 403 });
    context = ctx;
    title = `${membership.schoolName} — performance report`;
  }

  let content: string;
  try {
    const messages: ChatMsg[] = [
      { role: "system", content: `${SYSTEM}\n\n=== DATA ===\n${context}` },
      { role: "user", content: `Write the ${scope} report titled "${title}".` },
    ];
    const out = await rayaComplete(messages);
    content = out.text.trim();
    if (!content) throw new Error("empty report");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "generation failed" }, { status: 502 });
  }

  // Best-effort persistence — reports.scope/format/status may have CHECKs; if the
  // insert is rejected we still return the generated report.
  let reportId: string | null = null;
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("reports")
      .insert({
        school_id: membership.schoolId,
        created_by: membership.adminId,
        scope, // CHECK: school | class | subject
        parameters: { classId: body.classId ?? null, subjectId: body.subjectId ?? null, title, content },
        format: "md", // CHECK: pdf | md
        status: "ready", // CHECK: ready | generating | failed
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    reportId = (data as { id: string } | null)?.id ?? null;
  } catch {
    // not persisted — the report is still returned to the client
  }

  return NextResponse.json({ id: reportId, title, content, scope, createdAt: new Date().toISOString() });
}
