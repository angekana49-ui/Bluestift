import "server-only";
import {
  createAdminClient,
  createSchoolsAdminClient,
  createKernelAdminClient,
} from "@/lib/supabase/admin";
import { getActiveSchoolId } from "@/lib/school-active";

/**
 * School-admin data layer (Tranche 1). All access is via the service_role
 * (the `schools` schema isn't in the generated types); every caller first
 * resolves the admin's own school, so a user only ever sees their school.
 */

export type AdminSchool = {
  id: string;
  name: string;
  currentYearId: string | null;
  currentYearLabel: string | null;
  city: string | null;
  countryCode: string | null;
  schoolType: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
};

export type AdminClass = {
  id: string;
  name: string;
  level: string | null;
  schoolYearId: string | null;
  studentCount: number;
  expectedSize: number | null; // n: the effectif set by the school
  capacity: number | null; // hard cap = n + overflow (null when no effectif set)
  codes: { id: string; code: string; isActive: boolean }[];
};

// Pure constants live in a server-only-free module so client components can use
// them too; re-exported here so existing server-side imports keep working.
export { CLASS_OVERFLOW, SCHOOL_TYPES, classCapacity } from "@/lib/school-constants";
import { classCapacity, currentAcademicYear } from "@/lib/school-constants";

type ClassMetaRow = {
  id: string;
  name: string;
  level: string | null;
  school_year_id: string | null;
  expected_size: number | null;
  max_overflow: number | null;
};

export type SchoolDashboard = { school: AdminSchool; classes: AdminClass[] };

type AdminRow = { id: string; school_id: string; role: string };

/**
 * The user's *active* school_admins row. A user can have several memberships
 * (multi-school); the one whose school matches the active-school cookie wins,
 * else the first. Centralizes multi-school resolution for the whole data layer.
 */
async function pickActiveAdminRow(
  schools: ReturnType<typeof createSchoolsAdminClient>,
  userId: string,
): Promise<AdminRow | null> {
  const { data } = await schools
    .from("school_admins")
    .select("id, school_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as AdminRow[];
  if (rows.length === 0) return null;
  const activeId = await getActiveSchoolId();
  return (activeId && rows.find((r) => r.school_id === activeId)) || rows[0];
}

/** The school this user administers (active membership), or null if none. */
export async function getAdminSchool(userId: string): Promise<AdminSchool | null> {
  try {
    const schools = createSchoolsAdminClient();
    const adminRow = await pickActiveAdminRow(schools, userId);
    const schoolId = adminRow?.school_id;
    if (!schoolId) return null;

    const { data: s } = await schools
      .from("schools")
      .select("id, name, current_school_year_id, city, country_code, school_type, logo_url, email, phone")
      .eq("id", schoolId)
      .maybeSingle();
    const row = s as {
      id: string;
      name: string;
      current_school_year_id: string | null;
      city: string | null;
      country_code: string | null;
      school_type: string | null;
      logo_url: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    if (!row) return null;

    // Label of the active school year (for the dashboard header).
    let currentYearLabel: string | null = null;
    if (row.current_school_year_id) {
      const { data: y } = await schools
        .from("school_years")
        .select("label")
        .eq("id", row.current_school_year_id)
        .maybeSingle();
      currentYearLabel = (y as { label: string | null } | null)?.label ?? null;
    }

    return {
      id: row.id,
      name: row.name,
      currentYearId: row.current_school_year_id,
      currentYearLabel,
      city: row.city,
      countryCode: row.country_code,
      schoolType: row.school_type,
      logoUrl: row.logo_url,
      email: row.email,
      phone: row.phone,
    };
  } catch {
    return null;
  }
}

/**
 * Auto-rollover: if the school's active year has ended (end_date < today), roll
 * forward to the academic year spanning today. Forward-only — a school that was
 * manually advanced early (active year not yet ended) is left alone, so this
 * never moves backward. The new year starts empty; past years stay archived.
 *
 * Lazy (runs when an admin loads /school) — there is no cron in this app, so the
 * rollover materializes on the first admin visit after the year ends.
 * Idempotent: a no-op once the active year already spans today.
 */
export async function ensureCurrentSchoolYear(schoolId: string): Promise<void> {
  try {
    const schools = createSchoolsAdminClient();
    const { data: cur } = await schools
      .from("school_years")
      .select("id, label, end_date")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const active = cur as { id: string; label: string; end_date: string | null } | null;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // Still running (or manually set ahead): nothing to do.
    if (active?.end_date && active.end_date >= today) return;

    const target = currentAcademicYear();
    if (active && active.label === target.label) return;

    // One atomic call: find-or-create the target year, activate it, deactivate
    // the rest, repoint the school. Idempotent under concurrent admin loads.
    await schools.rpc("set_active_school_year", {
      p_school_id: schoolId,
      p_label: target.label,
      p_start: target.start_date,
      p_end: target.end_date,
    });
  } catch {
    // Never block the dashboard on rollover.
  }
}

/** Full dashboard: the admin's school with its classes, access codes, and rosters. */
export async function getSchoolDashboard(userId: string): Promise<SchoolDashboard | null> {
  const school = await getAdminSchool(userId);
  if (!school) return null;

  const schools = createSchoolsAdminClient();
  // Only the active year's classes — past years stay archived under their own
  // year, so "3e B" from two years never collide in the dashboard.
  let classQuery = schools
    .from("classes")
    .select("id, name, level, school_year_id, expected_size, max_overflow")
    .eq("school_id", school.id);
  if (school.currentYearId) classQuery = classQuery.eq("school_year_id", school.currentYearId);
  const { data: classData } = await classQuery.order("created_at", { ascending: true });
  const classRows =
    (classData as ClassMetaRow[] | null) ?? [];
  const classIds = classRows.map((c) => c.id);

  // Codes + rosters for all classes in one round-trip each, tallied in memory.
  const [{ data: codeData }, { data: idData }] = await Promise.all([
    classIds.length
      ? schools
          .from("class_access_codes")
          .select("id, code, is_active, class_id")
          .in("class_id", classIds)
          .is("retired_at", null) // only the current code (0/1 per class)
      : Promise.resolve({ data: [] as unknown }),
    schools.from("student_identities").select("class_id").eq("school_id", school.id),
  ]);
  const codes = (codeData as { id: string; code: string; is_active: boolean; class_id: string }[] | null) ?? [];
  const identities = (idData as { class_id: string }[] | null) ?? [];

  const countByClass = new Map<string, number>();
  for (const i of identities) countByClass.set(i.class_id, (countByClass.get(i.class_id) ?? 0) + 1);

  const classes: AdminClass[] = classRows.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    schoolYearId: c.school_year_id,
    studentCount: countByClass.get(c.id) ?? 0,
    expectedSize: c.expected_size,
    capacity: classCapacity(c.expected_size, c.max_overflow),
    codes: codes
      .filter((k) => k.class_id === c.id)
      .map((k) => ({ id: k.id, code: k.code, isActive: k.is_active })),
  }));

  return { school, classes };
}

// ---- ClassView / StudentView (Tranche 2): rosters + cognitive detail --------

export type RosterStudent = {
  userId: string;
  firstName: string;
  lastName: string;
  riskLevel: string | null;
  statusLabel: string | null;
  sessionsLast7d: number | null;
  lastActiveAt: string | null;
  avgMastery: number | null; // 0..1
  mindsetScore: number | null; // 0..1
};

export type ClassRoster = { classId: string; className: string; students: RosterStudent[] };

/** Latest risk row per user (assessed_at desc), keyed by user_id. */
function latestByUser<T extends { user_id: string; assessed_at?: string | null }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const r of rows) {
    const cur = map.get(r.user_id);
    if (!cur || (r.assessed_at ?? "") > (cur.assessed_at ?? "")) map.set(r.user_id, r);
  }
  return map;
}

/** The roster of a class the caller administers, merged with each student's latest risk. */
export async function getClassRoster(userId: string, classId: string): Promise<ClassRoster | null> {
  const schools = createSchoolsAdminClient();
  const { data: classData } = await schools
    .from("classes")
    .select("id, name, school_id")
    .eq("id", classId)
    .maybeSingle();
  const cls = classData as { id: string; name: string; school_id: string } | null;
  if (!cls || !(await assertClassAccess(userId, classId))) return null;

  const { data: idData } = await schools
    .from("student_identities")
    .select("user_id, first_name, last_name")
    .eq("class_id", classId);
  const identities = (idData as { user_id: string; first_name: string; last_name: string }[] | null) ?? [];
  if (identities.length === 0) return { classId: cls.id, className: cls.name, students: [] };

  const userIds = identities.map((i) => i.user_id);
  type RiskRow = {
    user_id: string;
    risk_level: string | null;
    status_label: string | null;
    sessions_last_7d: number | null;
    last_active_at: string | null;
    avg_mastery: number | null;
    mindset_score: number | null;
    assessed_at: string | null;
  };
  let riskByUser = new Map<string, RiskRow>();
  try {
    const kernel = createKernelAdminClient();
    const { data: riskData } = await kernel
      .from("student_risk_assessments")
      .select("user_id, risk_level, status_label, sessions_last_7d, last_active_at, avg_mastery, mindset_score, assessed_at")
      .eq("class_id", classId)
      .in("user_id", userIds);
    riskByUser = latestByUser((riskData as RiskRow[] | null) ?? []);
  } catch {
    // Kernel unavailable → students show without risk data.
  }

  const students: RosterStudent[] = identities.map((i) => {
    const r = riskByUser.get(i.user_id);
    return {
      userId: i.user_id,
      firstName: i.first_name,
      lastName: i.last_name,
      riskLevel: r?.risk_level ?? null,
      statusLabel: r?.status_label ?? null,
      sessionsLast7d: r?.sessions_last_7d ?? null,
      lastActiveAt: r?.last_active_at ?? null,
      avgMastery: r?.avg_mastery ?? null,
      mindsetScore: r?.mindset_score ?? null,
    };
  });
  return { classId: cls.id, className: cls.name, students };
}

export type SchoolRole = "admin_master" | "prof";
export type Membership = { schoolId: string; adminId: string; role: SchoolRole; schoolName: string };

/** The user's *active* school_admins membership (id, role, school), or null. */
export async function getAdminMembership(userId: string): Promise<Membership | null> {
  try {
    const schools = createSchoolsAdminClient();
    const row = await pickActiveAdminRow(schools, userId);
    if (!row) return null;
    const { data: s } = await schools.from("schools").select("name").eq("id", row.school_id).maybeSingle();
    return {
      schoolId: row.school_id,
      adminId: row.id,
      role: row.role === "admin_master" ? "admin_master" : "prof",
      schoolName: (s as { name: string } | null)?.name ?? "School",
    };
  } catch {
    return null;
  }
}

export type MembershipSummary = { schoolId: string; role: SchoolRole; schoolName: string };

/**
 * Every school the user belongs to (admin or teacher), for the school switcher.
 * Ordered oldest-first so the default/first membership is stable.
 */
export async function getMemberships(userId: string): Promise<MembershipSummary[]> {
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("school_admins")
      .select("school_id, role")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as { school_id: string; role: string }[];
    if (rows.length === 0) return [];

    const { data: names } = await schools
      .from("schools")
      .select("id, name")
      .in("id", rows.map((r) => r.school_id));
    const nameById = new Map(
      ((names ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
    );
    return rows.map((r) => ({
      schoolId: r.school_id,
      role: r.role === "admin_master" ? "admin_master" : "prof",
      schoolName: nameById.get(r.school_id) ?? "School",
    }));
  } catch {
    return [];
  }
}

/** True when the user is the admin_master of the given school (gates writes). */
export async function assertAdminMaster(userId: string, schoolId: string): Promise<boolean> {
  const m = await getAdminMembership(userId);
  return !!m && m.schoolId === schoolId && m.role === "admin_master";
}

/** True when the user may view a class: admin_master of its school, or an assigned prof. */
export async function assertClassAccess(userId: string, classId: string): Promise<boolean> {
  const schools = createSchoolsAdminClient();
  const { data: classData } = await schools
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  const schoolId = (classData as { school_id?: string } | null)?.school_id;
  if (!schoolId) return false;

  const m = await getAdminMembership(userId);
  if (!m || m.schoolId !== schoolId) return false;
  if (m.role === "admin_master") return true;

  const { data: asg } = await schools
    .from("assignments")
    .select("id")
    .eq("prof_id", m.adminId)
    .eq("class_id", classId)
    .limit(1)
    .maybeSingle();
  return !!asg;
}

/** The classes a prof is assigned to (via assignments). */
export async function getProfClasses(userId: string): Promise<AdminClass[]> {
  const m = await getAdminMembership(userId);
  if (!m) return [];
  const schools = createSchoolsAdminClient();
  const { data: asgData } = await schools
    .from("assignments")
    .select("class_id")
    .eq("prof_id", m.adminId);
  const classIds = [...new Set(((asgData as { class_id: string }[] | null) ?? []).map((a) => a.class_id))];
  if (classIds.length === 0) return [];

  const { data: classData } = await schools
    .from("classes")
    .select("id, name, level, school_year_id, expected_size, max_overflow")
    .in("id", classIds);
  const classRows = (classData as ClassMetaRow[] | null) ?? [];

  const { data: idData } = await schools
    .from("student_identities")
    .select("class_id")
    .in("class_id", classIds);
  const counts = new Map<string, number>();
  for (const i of (idData as { class_id: string }[] | null) ?? [])
    counts.set(i.class_id, (counts.get(i.class_id) ?? 0) + 1);

  return classRows.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    schoolYearId: c.school_year_id,
    studentCount: counts.get(c.id) ?? 0,
    expectedSize: c.expected_size,
    capacity: classCapacity(c.expected_size, c.max_overflow),
    codes: [],
  }));
}

/**
 * Identity context for a teacher's dashboard: the school they're viewing plus the
 * subject(s) they've been assigned. Powers the "You're teaching as … · Teacher of
 * <subjects>" framing — the prof dashboard is an extension of Raya for a user who
 * also teaches, so we surface their teaching hat explicitly.
 */
export type ProfContext = { schoolName: string; schoolLogoUrl: string | null; subjects: string[] };
export async function getProfContext(userId: string): Promise<ProfContext> {
  const m = await getAdminMembership(userId);
  if (!m) return { schoolName: "School", schoolLogoUrl: null, subjects: [] };
  const schools = createSchoolsAdminClient();
  // The school's logo, so the teacher dashboard header can brand the school
  // (name + logo) rather than a generic "Teacher dashboard" title.
  const { data: sLogo } = await schools.from("schools").select("logo_url").eq("id", m.schoolId).maybeSingle();
  const schoolLogoUrl = (sLogo as { logo_url: string | null } | null)?.logo_url ?? null;
  const { data: asgData } = await schools
    .from("assignments")
    .select("subject_id")
    .eq("prof_id", m.adminId);
  const subjectIds = [
    ...new Set(((asgData as { subject_id: string | null }[] | null) ?? []).map((a) => a.subject_id).filter(Boolean) as string[]),
  ];
  if (subjectIds.length === 0) return { schoolName: m.schoolName, schoolLogoUrl, subjects: [] };
  const { data: subs } = await schools.from("subjects").select("name").in("id", subjectIds);
  const subjects = [...new Set(((subs as { name: string }[] | null) ?? []).map((s) => s.name))];
  return { schoolName: m.schoolName, schoolLogoUrl, subjects };
}

// ---- LMS connections + class mappings (admin_master) ------------------------

export const LMS_PROVIDERS = ["google_classroom", "powerschool", "canvas", "minesec"] as const;
export type LmsProvider = (typeof LMS_PROVIDERS)[number];

export type LmsMapping = {
  id: string;
  externalClassId: string;
  externalClassName: string | null;
  classId: string | null;
  className: string | null;
};
export type LmsConnection = {
  id: string;
  provider: string;
  externalOrgName: string | null;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  mappings: LmsMapping[];
};

/** LMS connections + their class mappings for the admin's school. */
export async function getLmsConnections(userId: string): Promise<LmsConnection[] | null> {
  const m = await getAdminMembership(userId);
  if (!m || m.role !== "admin_master") return null;

  const schools = createSchoolsAdminClient();
  const { data: connData } = await schools
    .from("lms_connections")
    .select("id, provider, external_org_name, is_active, sync_status, last_synced_at")
    .eq("school_id", m.schoolId)
    .order("created_at", { ascending: true });
  const conns =
    (connData as {
      id: string;
      provider: string;
      external_org_name: string | null;
      is_active: boolean;
      sync_status: string;
      last_synced_at: string | null;
    }[] | null) ?? [];
  if (conns.length === 0) return [];

  const [{ data: mapData }, { data: classData }] = await Promise.all([
    schools
      .from("lms_class_mappings")
      .select("id, lms_connection_id, external_class_id, external_class_name, class_id")
      .in("lms_connection_id", conns.map((c) => c.id)),
    schools.from("classes").select("id, name").eq("school_id", m.schoolId),
  ]);
  const classById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const maps =
    (mapData as {
      id: string;
      lms_connection_id: string;
      external_class_id: string;
      external_class_name: string | null;
      class_id: string | null;
    }[] | null) ?? [];

  return conns.map((c) => ({
    id: c.id,
    provider: c.provider,
    externalOrgName: c.external_org_name,
    isActive: c.is_active,
    syncStatus: c.sync_status,
    lastSyncedAt: c.last_synced_at,
    mappings: maps
      .filter((mp) => mp.lms_connection_id === c.id)
      .map((mp) => ({
        id: mp.id,
        externalClassId: mp.external_class_id,
        externalClassName: mp.external_class_name,
        classId: mp.class_id,
        className: mp.class_id ? classById.get(mp.class_id) ?? null : null,
      })),
  }));
}

// ---- Kernel insights + simulations (admin_master) ---------------------------

export type ClassInsight = {
  id: string;
  className: string;
  subjectName: string;
  avgMastery: number | null;
  masteryTrend: number | null;
  topGaps: string[];
  rootCauses: string[];
  topRecommendation: string | null;
  confidence: number | null;
  studentCount: number | null;
  period: string | null;
};

// class_insights jsonb (top_gaps / root_causes) can hold strings or objects.
function toStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object"
          ? String((x as Record<string, unknown>).label ?? (x as Record<string, unknown>).concept ?? (x as Record<string, unknown>).name ?? "")
          : "",
    )
    .filter(Boolean);
}

type InsightRow = {
  id: string;
  class_id: string;
  subject_id: string | null;
  avg_mastery: number | null;
  mastery_trend: number | null;
  top_gaps: unknown;
  root_causes: unknown;
  top_recommendation: string | null;
  confidence: number | null;
  student_count: number | null;
  period: string | null;
  period_end: string | null;
  created_at: string;
};

/** Kernel-certified class insights for the admin's school (latest per class×subject). */
export async function getClassInsights(userId: string): Promise<ClassInsight[] | null> {
  const m = await getAdminMembership(userId);
  if (!m || m.role !== "admin_master") return null;

  const schools = createSchoolsAdminClient();
  const [{ data: insData }, { data: classData }, subjects] = await Promise.all([
    schools
      .from("class_insights")
      .select(
        "id, class_id, subject_id, avg_mastery, mastery_trend, top_gaps, root_causes, top_recommendation, confidence, student_count, period, period_end, created_at",
      )
      .eq("school_id", m.schoolId)
      .order("created_at", { ascending: false }),
    schools.from("classes").select("id, name").eq("school_id", m.schoolId),
    getSchoolSubjects(userId),
  ]);
  const rows = (insData as InsightRow[] | null) ?? [];
  const classById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const subjById = new Map(subjects.map((s) => [s.id, s.name]));

  // Keep the most recent row per (class, subject).
  const seen = new Set<string>();
  const out: ClassInsight[] = [];
  for (const r of rows) {
    const key = `${r.class_id}:${r.subject_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: r.id,
      className: classById.get(r.class_id) ?? "Class",
      subjectName: r.subject_id ? subjById.get(r.subject_id) ?? "Subject" : "—",
      avgMastery: r.avg_mastery,
      masteryTrend: r.mastery_trend,
      topGaps: toStringList(r.top_gaps),
      rootCauses: toStringList(r.root_causes),
      topRecommendation: r.top_recommendation,
      confidence: r.confidence,
      studentCount: r.student_count,
      period: r.period ?? r.period_end ?? null,
    });
  }
  return out;
}

export type ProfAlert = {
  userId: string;
  classId: string;
  className: string;
  name: string;
  riskLevel: string | null;
  statusLabel: string | null;
  avgMastery: number | null;
};
export type ProfInsights = { insights: ClassInsight[]; alerts: ProfAlert[] };

/**
 * Certified class insights + at-risk students for a teacher's assigned classes
 * (read-only dashboard). Scoped to getProfClasses — never the whole school.
 */
export async function getProfInsights(userId: string): Promise<ProfInsights | null> {
  const m = await getAdminMembership(userId);
  if (!m) return null;
  const classes = await getProfClasses(userId);
  if (classes.length === 0) return { insights: [], alerts: [] };

  const schools = createSchoolsAdminClient();
  const classIds = classes.map((c) => c.id);
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const subjects = await getSchoolSubjects(userId);
  const subjById = new Map(subjects.map((s) => [s.id, s.name]));

  const [{ data: insData }, { data: idData }] = await Promise.all([
    schools
      .from("class_insights")
      .select(
        "id, class_id, subject_id, avg_mastery, mastery_trend, top_gaps, root_causes, top_recommendation, confidence, student_count, period, period_end, created_at",
      )
      .in("class_id", classIds)
      .order("created_at", { ascending: false }),
    schools
      .from("student_identities")
      .select("user_id, first_name, last_name, class_id")
      .in("class_id", classIds),
  ]);

  // Latest insight per (class, subject).
  const rows = (insData as InsightRow[] | null) ?? [];
  const seen = new Set<string>();
  const insights: ClassInsight[] = [];
  for (const r of rows) {
    const key = `${r.class_id}:${r.subject_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    insights.push({
      id: r.id,
      className: classNameById.get(r.class_id) ?? "Class",
      subjectName: r.subject_id ? subjById.get(r.subject_id) ?? "Subject" : "—",
      avgMastery: r.avg_mastery,
      masteryTrend: r.mastery_trend,
      topGaps: toStringList(r.top_gaps),
      rootCauses: toStringList(r.root_causes),
      topRecommendation: r.top_recommendation,
      confidence: r.confidence,
      studentCount: r.student_count,
      period: r.period ?? r.period_end ?? null,
    });
  }

  // At-risk students across those classes (latest kernel risk row per user).
  const identities =
    (idData as { user_id: string; first_name: string; last_name: string; class_id: string }[] | null) ?? [];
  const alerts: ProfAlert[] = [];
  if (identities.length) {
    try {
      const kernel = createKernelAdminClient();
      const { data: riskData } = await kernel
        .from("student_risk_assessments")
        .select("user_id, risk_level, status_label, avg_mastery, assessed_at")
        .in("user_id", identities.map((i) => i.user_id));
      const riskByUser = latestByUser(
        (riskData as {
          user_id: string;
          risk_level: string | null;
          status_label: string | null;
          avg_mastery: number | null;
          assessed_at: string | null;
        }[] | null) ?? [],
      );
      for (const i of identities) {
        const r = riskByUser.get(i.user_id);
        if (!r || !(r.risk_level === "high" || r.risk_level === "medium" || r.risk_level === "med")) continue;
        alerts.push({
          userId: i.user_id,
          classId: i.class_id,
          className: classNameById.get(i.class_id) ?? "Class",
          name: `${i.first_name} ${i.last_name[0] ?? ""}.`,
          riskLevel: r.risk_level,
          statusLabel: r.status_label,
          avgMastery: r.avg_mastery,
        });
      }
      // Highest risk first.
      const rank: Record<string, number> = { high: 0, medium: 1, med: 1 };
      alerts.sort((a, b) => (rank[a.riskLevel ?? ""] ?? 2) - (rank[b.riskLevel ?? ""] ?? 2));
    } catch {
      // Kernel unavailable → no alerts.
    }
  }

  return { insights, alerts };
}

/**
 * Compact certified-insights baseline for a subject, to ground a simulation.
 * When `classId` is given, the baseline is narrowed to that class and enriched
 * with its roster/risk context, so the projection can focus and sharpen.
 */
export async function buildInsightsBaseline(
  userId: string,
  subjectId: string,
  classId?: string | null,
): Promise<{ subjectName: string; className: string | null; baseline: string }> {
  const subjects = await getSchoolSubjects(userId);
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "the subject";
  const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);

  // Resolve the optional class scope.
  let className: string | null = null;
  if (classId) {
    const schools = createSchoolsAdminClient();
    const { data: cls } = await schools.from("classes").select("name").eq("id", classId).maybeSingle();
    className = (cls as { name: string } | null)?.name ?? null;
  }

  const insights = (await getClassInsights(userId)) ?? [];
  const chosen = insights.filter(
    (i) => i.subjectName === subjectName && (!className || i.className === className),
  );

  const parts: string[] = [];
  if (chosen.length === 0) {
    parts.push(
      `No Kernel-certified insights available for ${subjectName}${className ? ` in ${className}` : ""} yet.`,
    );
  } else {
    parts.push(
      chosen
        .map(
          (i) =>
            `${i.className}: avg mastery ${pct(i.avgMastery)}, trend ${i.masteryTrend ?? "n/a"}, ` +
            `top gaps: ${i.topGaps.slice(0, 4).join(", ") || "n/a"}${i.topRecommendation ? `; recommendation: ${i.topRecommendation}` : ""}.`,
        )
        .join("\n"),
    );
  }

  // Class-scoped runs get the roster/risk snapshot for extra grounding.
  if (classId) {
    const ctx = await buildClassContext(userId, classId);
    if (ctx) parts.push(`Class snapshot —\n${ctx.context}`);
  }

  return { subjectName, className, baseline: parts.join("\n\n") };
}

export type Simulation = {
  id: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown> | null;
  status: string;
  createdAt: string;
};

/** Past simulations for the admin's school. */
export async function getSimulations(userId: string): Promise<Simulation[] | null> {
  const m = await getAdminMembership(userId);
  if (!m || m.role !== "admin_master") return null;
  const schools = createSchoolsAdminClient();
  const { data } = await schools
    .from("simulations")
    .select("id, parameters, result, status, created_at")
    .eq("school_id", m.schoolId)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows =
    (data as { id: string; parameters: unknown; result: unknown; status: string; created_at: string }[] | null) ?? [];
  return rows.map((r) => ({
    id: r.id,
    parameters: (r.parameters ?? {}) as Record<string, unknown>,
    result: (r.result ?? null) as Record<string, unknown> | null,
    status: r.status,
    createdAt: r.created_at,
  }));
}

// ---- Team management (admin_master): subjects, profs, assignments -----------

export type TeamProf = { adminId: string; userId: string; name: string; email: string | null };
export type TeamAssignment = { id: string; profName: string; className: string; subjectName: string };
export type TeamInvite = { id: string; code: string; autoApprove: boolean };
export type TeamRequest = { id: string; userId: string; name: string; email: string | null; createdAt: string };
export type Team = {
  subjects: SchoolSubject[];
  profs: TeamProf[];
  assignments: TeamAssignment[];
  invites: TeamInvite[];
  requests: TeamRequest[];
};

/** Full team view for an admin_master: subjects, profs, and their assignments. */
export async function getTeam(userId: string): Promise<Team | null> {
  const m = await getAdminMembership(userId);
  if (!m || m.role !== "admin_master") return null;

  const schools = createSchoolsAdminClient();
  const subjects = await getSchoolSubjects(userId);

  const { data: adminData } = await schools
    .from("school_admins")
    .select("id, user_id")
    .eq("school_id", m.schoolId)
    .eq("role", "prof");
  const profRows = (adminData as { id: string; user_id: string }[] | null) ?? [];

  const usersById = new Map<string, { display_name: string | null; username: string | null; email: string | null }>();
  if (profRows.length) {
    const admin = createAdminClient();
    const { data: us } = await admin
      .from("users")
      .select("id, display_name, username, email")
      .in("id", profRows.map((p) => p.user_id));
    for (const u of us ?? []) usersById.set(u.id, u);
  }
  const profs: TeamProf[] = profRows.map((p) => {
    const u = usersById.get(p.user_id);
    return {
      adminId: p.id,
      userId: p.user_id,
      name: u?.display_name || u?.username || "Prof",
      email: u?.email ?? null,
    };
  });

  const { data: classData } = await schools.from("classes").select("id, name").eq("school_id", m.schoolId);
  const classById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const subjById = new Map(subjects.map((s) => [s.id, s.name]));
  const profNameById = new Map(profs.map((p) => [p.adminId, p.name]));

  let assignments: TeamAssignment[] = [];
  if (classById.size) {
    const { data: asgData } = await schools
      .from("assignments")
      .select("id, prof_id, class_id, subject_id")
      .in("class_id", [...classById.keys()]);
    assignments = ((asgData as { id: string; prof_id: string; class_id: string; subject_id: string }[] | null) ?? []).map(
      (a) => ({
        id: a.id,
        profName: profNameById.get(a.prof_id) ?? "Prof",
        className: classById.get(a.class_id) ?? "Class",
        subjectName: subjById.get(a.subject_id) ?? "Subject",
      }),
    );
  }

  // Staff invite codes + pending join requests. Wrapped so the team view still
  // loads before the join tables' migration is applied (see docs/school-team-join.md).
  let invites: TeamInvite[] = [];
  let requests: TeamRequest[] = [];
  try {
    const [{ data: inviteData }, { data: reqData }] = await Promise.all([
      schools
        .from("staff_invite_codes")
        .select("id, code, auto_approve")
        .eq("school_id", m.schoolId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      schools
        .from("school_join_requests")
        .select("id, user_id, created_at")
        .eq("school_id", m.schoolId)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);
    invites = ((inviteData as { id: string; code: string; auto_approve: boolean }[] | null) ?? []).map((i) => ({
      id: i.id,
      code: i.code,
      autoApprove: i.auto_approve,
    }));

    const reqRows = (reqData as { id: string; user_id: string; created_at: string }[] | null) ?? [];
    if (reqRows.length) {
      const admin = createAdminClient();
      const { data: us } = await admin
        .from("users")
        .select("id, display_name, username, email")
        .in("id", reqRows.map((r) => r.user_id));
      const byId = new Map((us ?? []).map((u) => [u.id, u]));
      requests = reqRows.map((r) => {
        const u = byId.get(r.user_id);
        return {
          id: r.id,
          userId: r.user_id,
          name: u?.display_name || u?.username || "Teacher",
          email: u?.email ?? null,
          createdAt: r.created_at,
        };
      });
    }
  } catch {
    // tables not migrated yet — leave invites/requests empty
  }

  return { subjects, profs, assignments, invites, requests };
}

export type SchoolSubject = { id: string; name: string; code: string | null };

/** Subjects available to the admin's school (its own + global). */
export async function getSchoolSubjects(userId: string): Promise<SchoolSubject[]> {
  const school = await getAdminSchool(userId);
  if (!school) return [];
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("subjects")
      .select("id, name, code, is_global, school_id")
      .or(`school_id.eq.${school.id},is_global.eq.true`)
      .order("name", { ascending: true });
    const rows = (data as { id: string; name: string; code: string | null }[] | null) ?? [];
    return rows.map((r) => ({ id: r.id, name: r.name, code: r.code }));
  } catch {
    return [];
  }
}

/** Context for one subject across the school (avg mastery + weakest concepts). */
export async function buildSubjectContext(
  userId: string,
  subjectId: string,
): Promise<{ subjectName: string; context: string } | null> {
  const school = await getAdminSchool(userId);
  if (!school) return null;

  const schools = createSchoolsAdminClient();
  const { data: subjData } = await schools
    .from("subjects")
    .select("id, name, code, is_global, school_id")
    .eq("id", subjectId)
    .maybeSingle();
  const subject = subjData as
    | { id: string; name: string; code: string | null; is_global: boolean; school_id: string | null }
    | null;
  if (!subject || (subject.school_id !== school.id && !subject.is_global)) return null;

  const { data: idData } = await schools
    .from("student_identities")
    .select("user_id")
    .eq("school_id", school.id);
  const memberIds = ((idData as { user_id: string }[] | null) ?? []).map((i) => i.user_id);

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const lines = [`Subject: ${subject.name}`, `${memberIds.length} students in the school.`];

  if (memberIds.length) {
    try {
      const kernel = createKernelAdminClient();
      const { data: stateData } = await kernel
        .from("student_concept_state")
        .select("concept_id, mastery_score_effective")
        .in("user_id", memberIds);
      const states =
        (stateData as { concept_id: string; mastery_score_effective: number | null }[] | null) ?? [];
      if (states.length) {
        const { data: nodeData } = await kernel
          .from("concept_nodes")
          .select("id, label, subject")
          .in("id", [...new Set(states.map((s) => s.concept_id))]);
        const nodes = (nodeData as { id: string; label: string; subject: string | null }[] | null) ?? [];
        const wanted = [subject.code, subject.name].filter(Boolean).map((v) => v!.toLowerCase());
        const inSubject = new Map(
          nodes.filter((n) => n.subject && wanted.includes(n.subject.toLowerCase())).map((n) => [n.id, n.label]),
        );
        const agg = new Map<string, { sum: number; n: number }>();
        for (const s of states) {
          if (!inSubject.has(s.concept_id) || s.mastery_score_effective == null) continue;
          const e = agg.get(s.concept_id) ?? { sum: 0, n: 0 };
          e.sum += s.mastery_score_effective;
          e.n += 1;
          agg.set(s.concept_id, e);
        }
        if (agg.size) {
          const ranked = [...agg.entries()]
            .map(([id, e]) => ({ label: inSubject.get(id) ?? "concept", avg: e.sum / e.n, n: e.n }))
            .sort((a, b) => a.avg - b.avg);
          const overall = ranked.reduce((a, r) => a + r.avg, 0) / ranked.length;
          lines.push(`Average mastery in ${subject.name}: ${pct(overall)} across ${ranked.length} concepts.`);
          lines.push(
            "Weakest concepts: " + ranked.slice(0, 6).map((r) => `${r.label} ${pct(r.avg)} (n=${r.n})`).join(", ") + ".",
          );
        } else {
          lines.push(`No cognitive data tagged to ${subject.name} yet.`);
        }
      } else {
        lines.push("No cognitive data yet.");
      }
    } catch {
      lines.push("Cognitive engine unavailable.");
    }
  }
  return { subjectName: subject.name, context: lines.join("\n") };
}

/** Compact text context for one class (roster + risk), for class-scoped reports. */
export async function buildClassContext(
  userId: string,
  classId: string,
): Promise<{ className: string; context: string } | null> {
  const roster = await getClassRoster(userId, classId);
  if (!roster) return null;
  const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
  const lines = [`Class: ${roster.className}`, `${roster.students.length} students.`];
  for (const s of roster.students) {
    lines.push(
      `- ${s.firstName} ${s.lastName}: ${s.statusLabel ?? "no data"}, mastery ${pct(s.avgMastery)}, ` +
        `${s.sessionsLast7d ?? 0} sessions/7d, last active ${s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString() : "n/a"}.`,
    );
  }
  if (roster.students.length === 0) lines.push("No students have joined this class yet.");
  return { className: roster.className, context: lines.join("\n") };
}

// ---- School-wide overview (Établissement) ----------------------------------

export type ClassSummary = {
  id: string;
  name: string;
  studentCount: number;
  active: number; // active in the last 7 days
  alerts: number; // students at medium/high risk
  avgMastery: number | null; // 0..1
};
export type SchoolOverview = {
  school: AdminSchool;
  totals: { students: number; active: number; alerts: number; avgMastery: number | null };
  classes: ClassSummary[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const isAlert = (level: string | null | undefined) =>
  level === "high" || level === "medium" || level === "med";

/** School-wide roll-up across the admin's classes, from rosters + latest risk. */
export async function getSchoolOverview(userId: string): Promise<SchoolOverview | null> {
  const school = await getAdminSchool(userId);
  if (!school) return null;

  const schools = createSchoolsAdminClient();
  const { data: classData } = await schools
    .from("classes")
    .select("id, name")
    .eq("school_id", school.id)
    .order("created_at", { ascending: true });
  const classRows = (classData as { id: string; name: string }[] | null) ?? [];

  const { data: idData } = await schools
    .from("student_identities")
    .select("user_id, class_id")
    .eq("school_id", school.id);
  const identities = (idData as { user_id: string; class_id: string }[] | null) ?? [];

  // Latest risk per user (a student belongs to one class).
  type RiskRow = {
    user_id: string;
    risk_level: string | null;
    last_active_at: string | null;
    sessions_last_7d: number | null;
    avg_mastery: number | null;
    assessed_at: string | null;
  };
  let riskByUser = new Map<string, RiskRow>();
  const classIds = classRows.map((c) => c.id);
  if (classIds.length) {
    try {
      const kernel = createKernelAdminClient();
      const { data: riskData } = await kernel
        .from("student_risk_assessments")
        .select("user_id, risk_level, last_active_at, sessions_last_7d, avg_mastery, assessed_at")
        .in("class_id", classIds);
      riskByUser = latestByUser((riskData as RiskRow[] | null) ?? []);
    } catch {
      // Kernel unavailable → metrics degrade to counts only.
    }
  }

  const now = Date.now();
  const classes: ClassSummary[] = classRows.map((c) => {
    const members = identities.filter((i) => i.class_id === c.id);
    let active = 0;
    let alerts = 0;
    const masteries: number[] = [];
    for (const m of members) {
      const r = riskByUser.get(m.user_id);
      if (!r) continue;
      if ((r.sessions_last_7d ?? 0) > 0 || (r.last_active_at && now - +new Date(r.last_active_at) <= WEEK_MS))
        active += 1;
      if (isAlert(r.risk_level)) alerts += 1;
      if (r.avg_mastery != null) masteries.push(r.avg_mastery);
    }
    return {
      id: c.id,
      name: c.name,
      studentCount: members.length,
      active,
      alerts,
      avgMastery: masteries.length ? masteries.reduce((a, b) => a + b, 0) / masteries.length : null,
    };
  });

  const totals = classes.reduce(
    (acc, c) => {
      acc.students += c.studentCount;
      acc.active += c.active;
      acc.alerts += c.alerts;
      return acc;
    },
    { students: 0, active: 0, alerts: 0 } as { students: number; active: number; alerts: number },
  );
  const classAvgs = classes.map((c) => c.avgMastery).filter((v): v is number => v != null);
  const avgMastery = classAvgs.length ? classAvgs.reduce((a, b) => a + b, 0) / classAvgs.length : null;

  return { school, totals: { ...totals, avgMastery }, classes };
}

/**
 * Compact, factual snapshot of the admin's school for grounding Raya-for-Schools.
 * Returns null if the user administers no school. Everything comes from real
 * data (rosters + Kernel state); empty sections say so explicitly.
 */
export async function buildSchoolContext(userId: string): Promise<string | null> {
  const overview = await getSchoolOverview(userId);
  if (!overview) return null;

  const schools = createSchoolsAdminClient();
  const { data: idData } = await schools
    .from("student_identities")
    .select("user_id, first_name, last_name, class_id")
    .eq("school_id", overview.school.id);
  const identities =
    (idData as { user_id: string; first_name: string; last_name: string; class_id: string }[] | null) ?? [];
  const nameByUser = new Map(identities.map((i) => [i.user_id, `${i.first_name} ${i.last_name[0] ?? ""}.`]));

  const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
  const lines: string[] = [];
  lines.push(`School: ${overview.school.name}`);
  lines.push(
    `Totals: ${overview.totals.students} students, ${overview.totals.active} active in the last 7 days, ` +
      `${overview.totals.alerts} at-risk, average mastery ${pct(overview.totals.avgMastery)}.`,
  );

  // At-risk students by class (names + status + mastery), from latest risk rows.
  const memberIds = identities.map((i) => i.user_id);
  type RiskRow = {
    user_id: string;
    risk_level: string | null;
    status_label: string | null;
    avg_mastery: number | null;
    assessed_at: string | null;
  };
  let riskByUser = new Map<string, RiskRow>();
  const conceptAvg = new Map<string, { sum: number; n: number }>();
  if (memberIds.length) {
    try {
      const kernel = createKernelAdminClient();
      const [{ data: riskData }, { data: stateData }] = await Promise.all([
        kernel
          .from("student_risk_assessments")
          .select("user_id, risk_level, status_label, avg_mastery, assessed_at")
          .in("user_id", memberIds),
        kernel
          .from("student_concept_state")
          .select("concept_id, mastery_score_effective")
          .in("user_id", memberIds),
      ]);
      riskByUser = latestByUser((riskData as RiskRow[] | null) ?? []);
      for (const s of (stateData as { concept_id: string; mastery_score_effective: number | null }[] | null) ?? []) {
        if (s.mastery_score_effective == null) continue;
        const e = conceptAvg.get(s.concept_id) ?? { sum: 0, n: 0 };
        e.sum += s.mastery_score_effective;
        e.n += 1;
        conceptAvg.set(s.concept_id, e);
      }
    } catch {
      // Kernel unavailable → context carries counts only.
    }
  }

  lines.push("Classes:");
  for (const c of overview.classes) {
    const atRisk = identities
      .filter((i) => i.class_id === c.id)
      .map((i) => ({ name: nameByUser.get(i.user_id) ?? "Student", r: riskByUser.get(i.user_id) }))
      .filter((x) => x.r && (x.r.risk_level === "high" || x.r.risk_level === "medium" || x.r.risk_level === "med"))
      .map((x) => `${x.name} (${x.r?.status_label ?? "at risk"}, ${pct(x.r?.avg_mastery ?? null)})`);
    lines.push(
      `- ${c.name}: ${c.studentCount} students, ${c.active} active, ${c.alerts} at-risk, avg mastery ${pct(c.avgMastery)}.` +
        (atRisk.length ? ` At-risk: ${atRisk.join("; ")}.` : ""),
    );
  }

  // Weakest concepts school-wide (lowest average mastery across students).
  if (conceptAvg.size) {
    const kernel = createKernelAdminClient();
    const { data: nodes } = await kernel
      .from("concept_nodes")
      .select("id, label")
      .in("id", [...conceptAvg.keys()]);
    const labelById = new Map(
      ((nodes as { id: string; label: string }[] | null) ?? []).map((n) => [n.id, n.label]),
    );
    const ranked = [...conceptAvg.entries()]
      .map(([id, e]) => ({ label: labelById.get(id) ?? "concept", avg: e.sum / e.n, n: e.n }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);
    lines.push(
      "Weakest concepts (school-wide): " +
        ranked.map((r) => `${r.label} ${Math.round(r.avg * 100)}% (n=${r.n})`).join(", ") + ".",
    );
  } else {
    lines.push("Weakest concepts: no cognitive data yet.");
  }

  return lines.join("\n");
}

/**
 * Like buildSchoolContext but scoped to a teacher's assigned classes — grounds
 * Raya-for-Schools when a prof asks about their own students. Returns null if the
 * teacher has no assigned classes.
 */
export async function buildProfContext(userId: string): Promise<string | null> {
  const school = await getAdminSchool(userId);
  const classes = await getProfClasses(userId);
  if (!school || classes.length === 0) return null;

  const schools = createSchoolsAdminClient();
  const classIds = classes.map((c) => c.id);
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const { data: idData } = await schools
    .from("student_identities")
    .select("user_id, first_name, last_name, class_id")
    .in("class_id", classIds);
  const identities =
    (idData as { user_id: string; first_name: string; last_name: string; class_id: string }[] | null) ?? [];
  const nameByUser = new Map(identities.map((i) => [i.user_id, `${i.first_name} ${i.last_name[0] ?? ""}.`]));
  const memberIds = identities.map((i) => i.user_id);

  const pct = (v: number | null) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
  const lines: string[] = [];
  lines.push(`School: ${school.name} — your assigned classes only.`);

  type RiskRow = {
    user_id: string;
    risk_level: string | null;
    status_label: string | null;
    avg_mastery: number | null;
    assessed_at: string | null;
  };
  let riskByUser = new Map<string, RiskRow>();
  const conceptAvg = new Map<string, { sum: number; n: number }>();
  if (memberIds.length) {
    try {
      const kernel = createKernelAdminClient();
      const [{ data: riskData }, { data: stateData }] = await Promise.all([
        kernel
          .from("student_risk_assessments")
          .select("user_id, risk_level, status_label, avg_mastery, assessed_at")
          .in("user_id", memberIds),
        kernel
          .from("student_concept_state")
          .select("concept_id, mastery_score_effective")
          .in("user_id", memberIds),
      ]);
      riskByUser = latestByUser((riskData as RiskRow[] | null) ?? []);
      for (const s of (stateData as { concept_id: string; mastery_score_effective: number | null }[] | null) ?? []) {
        if (s.mastery_score_effective == null) continue;
        const e = conceptAvg.get(s.concept_id) ?? { sum: 0, n: 0 };
        e.sum += s.mastery_score_effective;
        e.n += 1;
        conceptAvg.set(s.concept_id, e);
      }
    } catch {
      // Kernel unavailable → counts only.
    }
  }

  lines.push("Classes:");
  for (const c of classes) {
    const members = identities.filter((i) => i.class_id === c.id);
    const atRisk = members
      .map((i) => ({ name: nameByUser.get(i.user_id) ?? "Student", r: riskByUser.get(i.user_id) }))
      .filter((x) => x.r && (x.r.risk_level === "high" || x.r.risk_level === "medium" || x.r.risk_level === "med"))
      .map((x) => `${x.name} (${x.r?.status_label ?? "at risk"}, ${pct(x.r?.avg_mastery ?? null)})`);
    lines.push(
      `- ${classNameById.get(c.id)}: ${c.studentCount} students, ${atRisk.length} at-risk.` +
        (atRisk.length ? ` At-risk: ${atRisk.join("; ")}.` : ""),
    );
  }

  if (conceptAvg.size) {
    const kernel = createKernelAdminClient();
    const { data: nodes } = await kernel
      .from("concept_nodes")
      .select("id, label")
      .in("id", [...conceptAvg.keys()]);
    const labelById = new Map(
      ((nodes as { id: string; label: string }[] | null) ?? []).map((n) => [n.id, n.label]),
    );
    const ranked = [...conceptAvg.entries()]
      .map(([id, e]) => ({ label: labelById.get(id) ?? "concept", avg: e.sum / e.n, n: e.n }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);
    lines.push(
      "Weakest concepts (your classes): " +
        ranked.map((r) => `${r.label} ${Math.round(r.avg * 100)}% (n=${r.n})`).join(", ") + ".",
    );
  } else {
    lines.push("Weakest concepts: no cognitive data yet.");
  }

  return lines.join("\n");
}

export type StudentRecommendation = { content: string; source: string };

/**
 * Soft, transparent nudges for a student, shown to them AND passed to Raya as a
 * light preference (never a command). Two sources, merged: their teacher's
 * class recommendations (`class_instructions`) and their school's directives
 * (`school_directives`, audience students/both). Empty when the student isn't
 * linked to a school. Read with the service role (a student has no RLS read on
 * schools tables). Best-effort: any failure yields none rather than an error.
 */
export async function getStudentRecommendations(userId: string): Promise<StudentRecommendation[]> {
  try {
    const schools = createSchoolsAdminClient();
    const { data: idRow } = await schools
      .from("student_identities")
      .select("class_id, school_id")
      .eq("user_id", userId)
      .maybeSingle();
    const id = idRow as { class_id?: string; school_id?: string } | null;
    if (!id?.school_id) return [];

    const [classRes, schoolRes] = await Promise.all([
      id.class_id
        ? schools
            .from("class_instructions")
            .select("content, subject_id")
            .eq("class_id", id.class_id)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as { content: string | null; subject_id: string | null }[] }),
      schools
        .from("school_directives")
        .select("content")
        .eq("school_id", id.school_id)
        .eq("is_active", true)
        .in("audience", ["students", "both"])
        .order("updated_at", { ascending: false })
        .limit(3),
    ]);

    const classRows = (classRes.data as { content: string | null; subject_id: string | null }[] | null) ?? [];
    const subjectIds = [...new Set(classRows.map((r) => r.subject_id).filter(Boolean) as string[])];
    const subjName = new Map<string, string>();
    if (subjectIds.length) {
      const { data: subs } = await schools.from("subjects").select("id, name").in("id", subjectIds);
      for (const s of (subs as { id: string; name: string }[] | null) ?? []) subjName.set(s.id, s.name);
    }

    const schoolRecs: StudentRecommendation[] = ((schoolRes.data as { content: string | null }[] | null) ?? [])
      .map((r) => ({ content: (r.content ?? "").trim().slice(0, 500), source: "Your school" }))
      .filter((r) => r.content);
    const classRecs: StudentRecommendation[] = classRows
      .map((r) => ({
        content: (r.content ?? "").trim().slice(0, 500),
        source: r.subject_id ? subjName.get(r.subject_id) ?? "Your teacher" : "Your teacher",
      }))
      .filter((r) => r.content);

    // School directives first (they frame the whole school), then class ones.
    return [...schoolRecs, ...classRecs].slice(0, 6);
  } catch {
    return [];
  }
}

export type StudentKc = { label: string; mastery: number | null };

/**
 * A student's personal learning graph: their concepts + the prerequisites those
 * concepts depend on, linked by `kernel.concept_edges`. `depth` is the longest
 * prerequisite chain to the node (roots = 0), so the UI can lay it out in layers.
 */
export type GraphNode = { id: string; label: string; mastery: number | null; depth: number };
export type GraphEdge = { from: string; to: string }; // prerequisite -> dependent concept
export type LearningGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type StudentDetail = {
  userId: string;
  firstName: string;
  lastName: string;
  riskLevel: string | null;
  statusLabel: string | null;
  sessionsLast7d: number | null;
  lastActiveAt: string | null;
  avgMastery: number | null;
  mindsetScore: number | null;
  detectedMindset: string | null;
  kcs: StudentKc[];
  graph: LearningGraph;
  insight: string | null;
};

/** One student's cognitive detail (KCs, mindset, latest Raya insight), admin-gated. */
export async function getStudentDetail(
  adminUserId: string,
  studentUserId: string,
  classId: string,
): Promise<StudentDetail | null> {
  const schools = createSchoolsAdminClient();
  const { data: classData } = await schools
    .from("classes")
    .select("id, school_id")
    .eq("id", classId)
    .maybeSingle();
  const cls = classData as { id: string; school_id: string } | null;
  if (!cls || !(await assertClassAccess(adminUserId, classId))) return null;

  const { data: idData } = await schools
    .from("student_identities")
    .select("first_name, last_name")
    .eq("user_id", studentUserId)
    .eq("class_id", classId)
    .maybeSingle();
  const identity = idData as { first_name: string; last_name: string } | null;
  if (!identity) return null;

  const detail: StudentDetail = {
    userId: studentUserId,
    firstName: identity.first_name,
    lastName: identity.last_name,
    riskLevel: null,
    statusLabel: null,
    sessionsLast7d: null,
    lastActiveAt: null,
    avgMastery: null,
    mindsetScore: null,
    detectedMindset: null,
    kcs: [],
    graph: { nodes: [], edges: [] },
    insight: null,
  };

  try {
    const kernel = createKernelAdminClient();
    const [risk, states, mindset, insight] = await Promise.all([
      kernel
        .from("student_risk_assessments")
        .select("risk_level, status_label, sessions_last_7d, last_active_at, avg_mastery, mindset_score, assessed_at")
        .eq("user_id", studentUserId)
        .eq("class_id", classId)
        .order("assessed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      kernel
        .from("student_concept_state")
        .select("concept_id, mastery_score_effective")
        .eq("user_id", studentUserId),
      kernel
        .from("student_mindset_state")
        .select("m_score, detected_mindset")
        .eq("user_id", studentUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      kernel
        .from("individual_insights")
        .select("insight_text, created_at")
        .eq("user_id", studentUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const r = risk.data as {
      risk_level: string | null;
      status_label: string | null;
      sessions_last_7d: number | null;
      last_active_at: string | null;
      avg_mastery: number | null;
      mindset_score: number | null;
    } | null;
    if (r) {
      detail.riskLevel = r.risk_level;
      detail.statusLabel = r.status_label;
      detail.sessionsLast7d = r.sessions_last_7d;
      detail.lastActiveAt = r.last_active_at;
      detail.avgMastery = r.avg_mastery;
      detail.mindsetScore = r.mindset_score;
    }
    const m = mindset.data as { m_score: number | null; detected_mindset: string | null } | null;
    if (m) {
      detail.mindsetScore = detail.mindsetScore ?? m.m_score;
      detail.detectedMindset = m.detected_mindset;
    }
    detail.insight = (insight.data as { insight_text: string | null } | null)?.insight_text ?? null;

    // KC labels: join concept ids -> concept_nodes.
    const stateRows = (states.data as { concept_id: string; mastery_score_effective: number | null }[] | null) ?? [];
    if (stateRows.length) {
      const conceptIds = stateRows.map((s) => s.concept_id);
      const masteryById = new Map(conceptIds.map((id, i) => [id, stateRows[i].mastery_score_effective]));

      // Prerequisite edges among the student's concepts (concept depends on prereq).
      const { data: edgeData } = await kernel
        .from("concept_edges")
        .select("concept_id, prerequisite_id")
        .in("concept_id", conceptIds);
      const rawEdges = (edgeData as { concept_id: string; prerequisite_id: string }[] | null) ?? [];

      // Graph node set = the student's concepts + the prerequisites they lean on
      // (a foundation the student may not have touched yet — a gap to surface).
      const nodeIds = [...new Set([...conceptIds, ...rawEdges.map((e) => e.prerequisite_id)])].slice(0, 60);
      const nodeSet = new Set(nodeIds);

      const { data: nodeData } = await kernel.from("concept_nodes").select("id, label").in("id", nodeIds);
      const labelById = new Map(
        ((nodeData as { id: string; label: string }[] | null) ?? []).map((n) => [n.id, n.label]),
      );

      detail.kcs = stateRows.map((s) => ({
        label: labelById.get(s.concept_id) ?? "Concept",
        mastery: s.mastery_score_effective,
      }));

      // Keep edges whose endpoints are both in the node set, then layer by longest
      // prerequisite chain (roots at depth 0).
      const edges = rawEdges.filter((e) => nodeSet.has(e.concept_id) && nodeSet.has(e.prerequisite_id));
      const depth = new Map(nodeIds.map((id) => [id, 0]));
      for (let pass = 0; pass < nodeIds.length; pass++) {
        let changed = false;
        for (const e of edges) {
          const d = (depth.get(e.prerequisite_id) ?? 0) + 1;
          if (d > (depth.get(e.concept_id) ?? 0)) {
            depth.set(e.concept_id, d);
            changed = true;
          }
        }
        if (!changed) break; // stable, or cycle guard hit
      }

      detail.graph = {
        nodes: nodeIds.map((id) => ({
          id,
          label: labelById.get(id) ?? "Concept",
          mastery: masteryById.get(id) ?? null,
          depth: depth.get(id) ?? 0,
        })),
        edges: edges.map((e) => ({ from: e.prerequisite_id, to: e.concept_id })),
      };
    }
  } catch {
    // Kernel unavailable → detail shows identity only.
  }

  return detail;
}

// ---- Teacher dashboard: follow-ups, resources, preferences, overview --------

export type Followup = {
  id: string;
  content: string;
  authorAdminId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Personalized follow-up notes on one student, shared across the class team
 * (assigned prof + admin). Access is gated by assertClassAccess; author names are
 * resolved from public.users. Returns null when the caller can't see the class.
 */
export async function getStudentFollowups(
  userId: string,
  classId: string,
  studentUserId: string,
): Promise<Followup[] | null> {
  if (!(await assertClassAccess(userId, classId))) return null;

  const schools = createSchoolsAdminClient();
  const { data } = await schools
    .from("student_followups")
    .select("id, content, author_admin_id, created_at, updated_at")
    .eq("class_id", classId)
    .eq("student_user_id", studentUserId)
    .order("created_at", { ascending: false });
  const rows =
    (data as {
      id: string;
      content: string;
      author_admin_id: string | null;
      created_at: string;
      updated_at: string;
    }[] | null) ?? [];

  // Resolve author names: school_admins.id -> user_id -> users.display_name.
  const nameByAdmin = new Map<string, string>();
  const adminIds = [...new Set(rows.map((r) => r.author_admin_id).filter(Boolean) as string[])];
  if (adminIds.length) {
    const { data: adminData } = await schools
      .from("school_admins")
      .select("id, user_id")
      .in("id", adminIds);
    const admins = (adminData as { id: string; user_id: string }[] | null) ?? [];
    if (admins.length) {
      const admin = createAdminClient();
      const { data: us } = await admin
        .from("users")
        .select("id, display_name, username")
        .in("id", admins.map((a) => a.user_id));
      const nameByUser = new Map(
        ((us ?? []) as { id: string; display_name: string | null; username: string | null }[]).map((u) => [
          u.id,
          u.display_name || u.username || "Staff",
        ]),
      );
      for (const a of admins) nameByAdmin.set(a.id, nameByUser.get(a.user_id) ?? "Staff");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    authorAdminId: r.author_admin_id,
    authorName: r.author_admin_id ? nameByAdmin.get(r.author_admin_id) ?? "Staff" : "Staff",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export type TeacherResource = {
  id: string;
  kind: string;
  title: string;
  content: string;
  questions: unknown[];
  classId: string | null;
  className: string | null;
  subjectId: string | null;
  createdAt: string;
};

/**
 * The exam/exercise library for the caller. An admin_master sees the whole
 * school's resources; a prof sees resources on their assigned classes plus the
 * ones they authored. Returns null if the user is not school staff.
 */
export async function getTeacherResources(userId: string): Promise<TeacherResource[] | null> {
  const m = await getAdminMembership(userId);
  if (!m) return null;

  const schools = createSchoolsAdminClient();
  const [{ data }, { data: classData }] = await Promise.all([
    schools
      .from("teacher_resources")
      .select("id, kind, title, content, questions, class_id, subject_id, created_by, created_at")
      .eq("school_id", m.schoolId)
      .order("created_at", { ascending: false })
      .limit(60),
    schools.from("classes").select("id, name").eq("school_id", m.schoolId),
  ]);
  let rows =
    (data as {
      id: string;
      kind: string;
      title: string;
      content: string;
      questions: unknown;
      class_id: string | null;
      subject_id: string | null;
      created_by: string | null;
      created_at: string;
    }[] | null) ?? [];

  if (m.role !== "admin_master") {
    const myClassIds = new Set((await getProfClasses(userId)).map((c) => c.id));
    rows = rows.filter((r) => (r.class_id && myClassIds.has(r.class_id)) || r.created_by === m.adminId);
  }

  const classById = new Map(((classData as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    content: r.content,
    questions: Array.isArray(r.questions) ? (r.questions as unknown[]) : [],
    classId: r.class_id,
    className: r.class_id ? classById.get(r.class_id) ?? null : null,
    subjectId: r.subject_id,
    createdAt: r.created_at,
  }));
}

export type ProfOverview = {
  classCount: number;
  studentCount: number;
  alertCount: number;
  classes: { id: string; name: string; studentCount: number }[];
  alerts: ProfAlert[];
};

/** Aggregate home view for a teacher: their classes + at-risk feed (reuses existing reads). */
export async function getProfOverview(userId: string): Promise<ProfOverview | null> {
  const m = await getAdminMembership(userId);
  if (!m) return null;
  const [classes, insights] = await Promise.all([getProfClasses(userId), getProfInsights(userId)]);
  const alerts = insights?.alerts ?? [];
  return {
    classCount: classes.length,
    studentCount: classes.reduce((a, c) => a + c.studentCount, 0),
    alertCount: alerts.length,
    classes: classes.map((c) => ({ id: c.id, name: c.name, studentCount: c.studentCount })),
    alerts,
  };
}

export type StaffPreferences = {
  defaultClassId: string | null;
  defaultSubjectId: string | null;
  reportTone: string | null;
  examFocusWeakConcepts: boolean;
};
export const DEFAULT_STAFF_PREFERENCES: StaffPreferences = {
  defaultClassId: null,
  defaultSubjectId: null,
  reportTone: null,
  examFocusWeakConcepts: true,
};

/** The caller's teaching preferences (keyed by their active school_admins row). */
export async function getStaffPreferences(userId: string): Promise<StaffPreferences> {
  const m = await getAdminMembership(userId);
  if (!m) return DEFAULT_STAFF_PREFERENCES;
  try {
    const schools = createSchoolsAdminClient();
    const { data } = await schools
      .from("staff_preferences")
      .select("prefs")
      .eq("admin_id", m.adminId)
      .maybeSingle();
    const stored = ((data as { prefs: Record<string, unknown> } | null)?.prefs ?? {}) as Partial<StaffPreferences>;
    return { ...DEFAULT_STAFF_PREFERENCES, ...stored };
  } catch {
    return DEFAULT_STAFF_PREFERENCES;
  }
}
