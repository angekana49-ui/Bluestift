import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";

export const runtime = "nodejs";

/**
 * Upload a school's profile photo (logo). Admin-master only. Stored in the public
 * `avatars` bucket under a school-scoped path (service-role write), then recorded
 * on `schools.logo_url`.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const membership = await getAdminMembership(user.id);
  if (!membership || membership.role !== "admin_master") {
    return NextResponse.json({ error: "Only the school admin can change the logo." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Please choose an image." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 5);
  const path = `schools/${membership.schoolId}/logo-${Date.now()}.${ext}`;
  const up = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);
  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const schools = createSchoolsAdminClient();
  const { error } = await schools
    .from("schools")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", membership.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logoUrl });
}
