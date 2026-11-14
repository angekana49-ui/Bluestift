import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, createContentAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/ops";
import { QUARANTINE_BUCKET } from "@/lib/research/publish";

export const runtime = "nodejs";

type PendingRow = {
  id: string;
  title: string | null;
  category: string | null;
  contributor_name: string | null;
  email: string | null;
  description: string | null;
  storage_path: string | null;
  submitted_at: string;
};

/**
 * Owner-only review queue: pending research contributions with a short-lived
 * read URL for each quarantined file. The file itself stays in the private
 * `contributions` bucket — this URL (1h) is only for the review step.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const content = createContentAdminClient();
  const { data, error } = await content
    .from("contributions")
    .select("id, title, category, contributor_name, email, description, storage_path, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: "load_failed" }, { status: 500 });

  const admin = createAdminClient();
  const rows = (data as PendingRow[] | null) ?? [];
  const contributions = await Promise.all(
    rows.map(async (row) => {
      let fileUrl: string | null = null;
      if (row.storage_path) {
        try {
          const { data: signed } = await admin.storage
            .from(QUARANTINE_BUCKET)
            .createSignedUrl(row.storage_path, 3600);
          fileUrl = signed?.signedUrl ?? null;
        } catch {
          fileUrl = null;
        }
      }
      return { ...row, fileUrl };
    }),
  );
  return NextResponse.json({ contributions });
}
