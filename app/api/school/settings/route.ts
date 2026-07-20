import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership, SCHOOL_TYPES } from "@/lib/school-admin";

const SCHOOL_TYPE_SET: readonly string[] = SCHOOL_TYPES;

/** Update the admin's school info (name, city, country, type, contact). Admin-master only. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Only the school admin can edit school info." }, { status: 403 });
  }

  let body: {
    name?: string;
    city?: string;
    countryCode?: string;
    schoolType?: string;
    email?: string;
    phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Only update fields that were provided; blank string clears an optional field.
  const patch: Record<string, string | null> = {};
  if (body.name !== undefined) {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "School name can't be empty." }, { status: 400 });
    patch.name = name;
  }
  if (body.city !== undefined) patch.city = body.city.trim().slice(0, 80) || null;
  if (body.countryCode !== undefined)
    patch.country_code = body.countryCode.trim().toUpperCase().slice(0, 2) || null;
  if (body.schoolType !== undefined) {
    // school_type has a DB CHECK — only these tokens (or null) are allowed.
    const t = body.schoolType.trim().toLowerCase();
    if (t && !SCHOOL_TYPE_SET.includes(t)) {
      return NextResponse.json({ error: "Invalid school type." }, { status: 400 });
    }
    patch.school_type = t || null;
  }
  if (body.email !== undefined) patch.email = body.email.trim().slice(0, 160) || null;
  if (body.phone !== undefined) patch.phone = body.phone.trim().slice(0, 40) || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const schools = createSchoolsAdminClient();
  const { data, error } = await schools
    .from("schools")
    .update(patch)
    .eq("id", membership.schoolId)
    .select("name, city, country_code, school_type, email, phone, logo_url")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data as {
    name: string;
    city: string | null;
    country_code: string | null;
    school_type: string | null;
    email: string | null;
    phone: string | null;
    logo_url: string | null;
  };
  return NextResponse.json({
    name: row.name,
    city: row.city,
    countryCode: row.country_code,
    schoolType: row.school_type,
    email: row.email,
    phone: row.phone,
    logoUrl: row.logo_url,
  });
}
