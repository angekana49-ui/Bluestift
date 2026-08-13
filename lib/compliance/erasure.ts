import "server-only";
import {
  createAdminClient,
  createSchoolsAdminClient,
  createKernelAdminClient,
} from "@/lib/supabase/admin";

/**
 * Account erasure (GDPR art. 17, COPPA parental deletion right).
 *
 * Deleting the auth user cascades through most of the schema, but NOT through
 * everything, and the gaps are the sensitive parts. Three classes of leftover
 * exist and each is handled explicitly below:
 *
 *  1. NO FOREIGN KEY. The whole `kernel` schema keys on `user_id` with no
 *     constraint back to public.users, as do rag.conversation_embeddings and
 *     schools.student_followups. A cascade never reaches them — the cognitive
 *     profile, the most sensitive thing we hold, would quietly outlive the
 *     account. These are deleted first, by hand.
 *
 *  2. ON DELETE SET NULL. learning.room_messages and learning.messages
 *     anonymise rather than delete. For solo chat that is moot (the parent
 *     conversation cascades and takes the messages with it), but room messages
 *     hang off a room that survives, so the student's own words would remain.
 *     Deleted by hand too.
 *
 *  3. OBJECT STORAGE. Nothing in the database deletes a file. Both buckets key
 *     objects under `${userId}/…`, so the prefix is walked and removed.
 *
 * What is deliberately KEPT, and why:
 *  - schools.payments — financial records under a statutory retention duty,
 *    which art. 17(3)(b) exempts from erasure. They carry no learning content.
 *  - content.feedbacks — the FK already nulls the author, leaving product
 *    feedback that is no longer attributable to anyone.
 *  - public.data_requests — the record that this erasure happened, which is
 *    why that table has no foreign key of its own.
 *
 * Ordering is intentional: the non-cascading deletes run BEFORE the auth
 * delete. If the run dies halfway, it dies having removed more than it should
 * rather than less, and the account is still there to retry against.
 */

export type ErasureReport = {
  ok: boolean;
  /** Rows/objects removed per area, for the audit note. */
  removed: Record<string, number>;
  /** Areas that failed. A non-empty list means the erasure is incomplete. */
  failed: string[];
};

/** Tables keyed on user_id that no cascade reaches. */
const KERNEL_TABLES = [
  "student_concept_state",
  "student_mindset_state",
  "student_risk_assessments",
  "learning_trajectories",
  "individual_insights",
  "kernel_monitoring",
  "kernel_outputs",
  "kernel_requests",
] as const;

const BUCKETS = ["user-media", "avatars"] as const;

/**
 * Every object under `prefix`, depth-first. Supabase's `list` is one level at a
 * time and marks folders with a null id, so the walk has to be explicit.
 */
async function listObjects(
  storage: ReturnType<typeof createAdminClient>["storage"],
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  // A user's own uploads are never nested this deep; the bound is only here so
  // a cycle or a surprising path can't spin forever.
  if (depth > 6) return [];
  const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const files: string[] = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id == null) {
      files.push(...(await listObjects(storage, bucket, path, depth + 1)));
    } else {
      files.push(path);
    }
  }
  return files;
}

export async function eraseAccount(userId: string): Promise<ErasureReport> {
  const admin = createAdminClient();
  const schools = createSchoolsAdminClient();
  const kernel = createKernelAdminClient();

  const removed: Record<string, number> = {};
  const failed: string[] = [];

  const step = async (label: string, run: () => Promise<number>) => {
    try {
      removed[label] = await run();
    } catch {
      failed.push(label);
    }
  };

  // (1) Object storage, before the account that owns the prefix disappears.
  for (const bucket of BUCKETS) {
    await step(`storage:${bucket}`, async () => {
      const paths = await listObjects(admin.storage, bucket, userId);
      if (paths.length === 0) return 0;
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw new Error(error.message);
      return paths.length;
    });
  }

  // (2) The cognitive profile. No FK reaches these.
  for (const table of KERNEL_TABLES) {
    await step(`kernel:${table}`, async () => {
      const { error, count } = await kernel
        .from(table)
        .delete({ count: "exact" })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    });
  }

  // (3) Other tables a cascade misses or merely anonymises.
  await step("rag:conversation_embeddings", async () => {
    const { error, count } = await admin
      .schema("rag")
      .from("conversation_embeddings" as never)
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  await step("learning:room_messages", async () => {
    const { error, count } = await admin
      .schema("learning")
      .from("room_messages")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  // The school's follow-up notes ABOUT this student. Once the student is gone
  // the notes have no subject to act on, so they go with them.
  await step("schools:student_followups", async () => {
    const { error, count } = await schools
      .from("student_followups")
      .delete({ count: "exact" })
      .eq("student_user_id", userId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  // (4) The account itself. public.users and everything cascading from it goes
  // with it — conversations and their messages, tool outputs, uploads metadata,
  // room membership, school identity, enrolments.
  let authDeleted = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    authDeleted = true;
  } catch {
    failed.push("auth:user");
  }

  return { ok: authDeleted && failed.length === 0, removed, failed };
}

/**
 * Append to the data-request audit trail. Best-effort by design: a logging
 * failure must never be the reason a user's erasure or export is refused.
 */
export async function recordDataRequest(input: {
  userId: string;
  kind: "access" | "export" | "erasure";
  channel?: "self_serve" | "support" | "school" | "parent";
  outcome?: "fulfilled" | "partial" | "refused";
  note?: string;
}): Promise<void> {
  try {
    await createAdminClient()
      .from("data_requests")
      .insert({
        subject_user_id: input.userId,
        kind: input.kind,
        channel: input.channel ?? "self_serve",
        completed_at: new Date().toISOString(),
        outcome: input.outcome ?? "fulfilled",
        note: input.note ?? null,
      });
  } catch {
    // non-fatal
  }
}
