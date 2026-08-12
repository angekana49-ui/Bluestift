import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createSchoolsAdminClient } from "@/lib/supabase/admin";
import { getAdminMembership } from "@/lib/school-admin";
import { contentLengthExceeds, tooLarge } from "@/lib/upload-limits";

export const runtime = "nodejs";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function hasValidImageSignature(file: File, type: string): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

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

  const oversized = contentLengthExceeds(request, MAX_LOGO_BYTES);
  if (oversized) return oversized;

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
  if (!(file.type in IMAGE_EXTENSIONS)) {
    return NextResponse.json({ error: "Please choose an image." }, { status: 400 });
  }
  const tooBig = tooLarge(file, MAX_LOGO_BYTES);
  if (tooBig) return tooBig;
  if (!(await hasValidImageSignature(file, file.type))) {
    return NextResponse.json({ error: "Invalid image file." }, { status: 400 });
  }

  const admin = createAdminClient();
  const ext = IMAGE_EXTENSIONS[file.type];
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
