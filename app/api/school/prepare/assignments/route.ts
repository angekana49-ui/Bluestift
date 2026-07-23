import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, getProfClasses } from "@/lib/school-admin";

export const runtime = "nodejs";

type AsgRow = {
  id: string;
  challenge_id: string;
  class_id: string;
  title: string;
  kind: string;
  due_at: string | null;
};

/**
 * The caller's active assignments (class-scoped): admin sees the whole school,
 * a prof sees their assigned classes. Each row carries a done/assigned tally so
 * the Prepare tab can show progress at a glance.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const membership = await getAdminMembership(user.id);
  if (!membership) return NextResponse.json({ error: "School staff only." }, { status: 403 });

  const schools = createSchoolsAdminClient();

  // Accessible class ids.
  let classIds: string[];
  if (membership.role === "admin_master") {
    const { data } = await schools.from("classes").select("id").eq("school_id", membership.schoolId);
    classIds = ((data as { id: string }[] | null) ?? []).map((c) => c.id);
  } else {
    classIds = (await getProfClasses(user.id)).map((c) => c.id);
  }
  if (classIds.length === 0) return NextResponse.json({ assignments: [] });

  const [{ data: asgData }, { data: classData }, { data: idData }] = await Promise.all([
    schools
      .from("resource_assignments")
      .select("id, challenge_id, class_id, title, kind, due_at")
      .in("class_id", classIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    schools.from("classes").select("id, name").in("id", classIds),
    schools.from("student_identities").select("class_id").in("class_id", classIds),
  ]);
  const rows = (asgData as AsgRow[] | null) ?? [];
  if (rows.length === 0) return NextResponse.json({ assignments: [] });

  const classNameById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const rosterByClass = new Map<string, number>();
  for (const i of (idData as { class_id: string }[] | null) ?? [])
    rosterByClass.set(i.class_id, (rosterByClass.get(i.class_id) ?? 0) + 1);

  // Completed-attempt counts per challenge (one batched read).
  const admin = createAdminClient();
  const { data: atData } = await admin
    .schema("learning")
    .from("challenge_attempts")
    .select("challenge_id, status")
    .in("challenge_id", rows.map((r) => r.challenge_id))
    .eq("status", "completed");
  const doneByChallenge = new Map<string, number>();
  for (const a of (atData as { challenge_id: string }[] | null) ?? [])
    doneByChallenge.set(a.challenge_id, (doneByChallenge.get(a.challenge_id) ?? 0) + 1);

  const assignments = rows.map((r) => ({
    assignmentId: r.id,
    challengeId: r.challenge_id,
    title: r.title,
    kind: r.kind,
    className: classNameById.get(r.class_id) ?? "Class",
    dueAt: r.due_at,
    assigned: rosterByClass.get(r.class_id) ?? 0,
    done: doneByChallenge.get(r.challenge_id) ?? 0,
  }));

  return NextResponse.json({ assignments });
}
