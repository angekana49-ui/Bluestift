import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/ops";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT = 20;

type SchoolRow = { id: string; name: string; city: string | null; country_code: string | null; pilot_until: string | null };

/** `ilike` without its wildcards, so what is typed is matched as text. */
function literal(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Find a school for the operator console — owner-only, like every /api/ops route.
 *
 * A school's id is the only unambiguous name it has, and nobody knows it by
 * heart. Names repeat (every state has its Lincoln High), so a search by name
 * alone can return several: each result carries its city, country and the
 * email of its admin, which is the last word between two schools with the same
 * name in the same place.
 *
 *   q = an id        → that school
 *   q = an email     → the schools that address administers
 *   q = anything else → schools whose name contains it
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 160);
  if (q.length < 2) return NextResponse.json({ schools: [] });

  const schools = createSchoolsAdminClient();
  const admin = createAdminClient();
  const cols = "id, name, city, country_code, pilot_until";
  let rows: SchoolRow[] = [];

  if (UUID_RE.test(q)) {
    const { data } = await schools.from("schools").select(cols).eq("id", q).limit(1);
    rows = (data as SchoolRow[] | null) ?? [];
  } else if (q.includes("@")) {
    const { data: people } = await admin.from("users").select("id").ilike("email", literal(q)).limit(1);
    const ids = ((people as { id: string }[] | null) ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: links } = await schools
        .from("school_admins")
        .select("school_id")
        .in("user_id", ids)
        .eq("role", "admin_master")
        .limit(LIMIT);
      const schoolIds = ((links as { school_id: string }[] | null) ?? []).map((l) => l.school_id);
      if (schoolIds.length) {
        const { data } = await schools.from("schools").select(cols).in("id", schoolIds).limit(LIMIT);
        rows = (data as SchoolRow[] | null) ?? [];
      }
    }
  } else {
    const { data } = await schools
      .from("schools")
      .select(cols)
      .ilike("name", `%${literal(q)}%`)
      .order("name")
      .limit(LIMIT);
    rows = (data as SchoolRow[] | null) ?? [];
  }

  // Each school's admin_master addresses: what tells two same-named schools apart.
  const ids = rows.map((r) => r.id);
  const adminsBySchool = new Map<string, string[]>();
  if (ids.length) {
    const { data: links } = await schools
      .from("school_admins")
      .select("school_id, user_id")
      .in("school_id", ids)
      .eq("role", "admin_master");
    const pairs = (links as { school_id: string; user_id: string }[] | null) ?? [];
    const userIds = [...new Set(pairs.map((p) => p.user_id))];
    const { data: people } = userIds.length
      ? await admin.from("users").select("id, email").in("id", userIds)
      : { data: [] };
    const emailById = new Map(((people as { id: string; email: string | null }[] | null) ?? []).map((p) => [p.id, p.email]));
    for (const p of pairs) {
      const email = emailById.get(p.user_id);
      if (!email) continue;
      adminsBySchool.set(p.school_id, [...(adminsBySchool.get(p.school_id) ?? []), email]);
    }
  }

  return NextResponse.json({
    schools: rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      countryCode: r.country_code,
      pilotUntil: r.pilot_until,
      adminEmails: adminsBySchool.get(r.id) ?? [],
    })),
  });
}
