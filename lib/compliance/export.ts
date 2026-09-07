import "server-only";
import {
  createAdminClient,
  createSchoolsAdminClient,
  createKernelAdminClient,
} from "@/lib/supabase/admin";

/**
 * The data bundle behind "download my data" (GDPR art. 15 access and art. 20
 * portability, and the inspect-and-review right a school passes on under
 * FERPA). JSON, because art. 20 asks for structured and machine-readable and
 * this is the format the data already has.
 *
 * Two rules govern what goes in:
 *
 *  - Everything we hold ABOUT the person, including the parts they never see
 *    in the UI — the Kernel's model of what they know and how they approach
 *    work. An export that only returns what the product already displays is
 *    not an access request, it's a screenshot.
 *
 *  - No credentials. The recovery code is authentication material, not
 *    personal data to be portable, and a copy of it in a downloaded file is a
 *    copy of the account. It is left out and its absence is stated in the file.
 *
 * Every section fails soft. A bundle missing one area with `_errors` naming it
 * is far more useful to the person asking than a 500.
 */

/**
 * The same list erasure.ts deletes from. The last three are the Kernel's
 * working record — what was sent to it, what it answered, and the alerts it
 * raised about the learner — which is held about the person as much as the
 * profile is, and was missing from the bundle until the audit of 2026-09-06.
 */
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

/**
 * Every list read here asks for the exact row count beside the rows.
 *
 * PostgREST applies a `db.max_rows` ceiling per project and a select that
 * reaches it returns a SHORT answer with no error at all — so without this,
 * an account with more rows than the ceiling would receive a quietly
 * incomplete export, which is an article 15 failure wearing a performance
 * costume. Nothing in this codebase can read that setting, and it can be
 * changed in a dashboard without touching the repository, so the export
 * verifies rather than trusts.
 */
const COUNTED = { count: "exact" } as const;

export type DataExport = Record<string, unknown>;

export async function buildDataExport(userId: string, email: string | null): Promise<DataExport> {
  const admin = createAdminClient();
  const schools = createSchoolsAdminClient();
  const kernel = createKernelAdminClient();

  const errors: string[] = [];
  const section = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run();
    } catch {
      errors.push(label);
      return null;
    }
  };


  /**
   * Say so when a section came back shorter than the database says it is.
   *
   * The rows are still returned: a partial answer the subject knows is
   * partial beats a silent one, and beats no answer at all. `_errors` in the
   * bundle carries the shortfall, with both numbers, so the gap is legible
   * to whoever has to act on it rather than inferred from a suspicious total.
   */
  const whole = <T>(label: string, list: T[], count: number | null | undefined): T[] => {
    if (typeof count === "number" && count > list.length) {
      errors.push(`${label}:incomplete:${list.length}/${count}`);
    }
    return list;
  };

  const rows = async (
    label: string,
    q: PromiseLike<{ data: unknown; error: unknown; count?: number | null }>,
  ) =>
    section(label, async () => {
      const { data, error, count } = await q;
      if (error) throw error;
      return whole(label, (data ?? []) as unknown[], count);
    });

  const conversationIds = await section("conversation_ids", async () => {
    const { data, count } = await admin
      .schema("learning")
      .from("conversations")
      .select("id", COUNTED)
      .eq("user_id", userId);
    return whole("conversation_ids", data ?? [], count).map((r) => r.id);
  });

  const [
    account,
    onboarding,
    conversations,
    messages,
    toolOutputs,
    files,
    roomMemberships,
    roomMessages,
    challenges,
    attempts,
    shares,
    simulations,
    media,
    schoolIdentity,
    enrollments,
    staffNotes,
    profileSnapshot,
    promo,
    requests,
  ] = await Promise.all([
    section("account", async () => {
      // Deliberately column-by-column rather than `*`: the recovery-key columns
      // (recovery_code_hash / recovery_code_issued_at) must not be able to sneak
      // into the bundle when the table gains a column. An allowlist is what makes
      // that a property of this code rather than a thing to remember.
      const { data } = await admin
        .from("users")
        .select(
          "id, username, display_name, email, account_type, account_state, role, " +
            "school_level, school_id, school_year_id, birth_year, age_declared_at, " +
            "minor_consent_source, minor_consent_at, training_consent, training_consent_at, " +
            "profile_picture_url, is_founder, created_at, updated_at, " +
            "last_activity_at, onboarding_completed_at, email_verified_at",
        )
        .eq("id", userId)
        .maybeSingle();
      return { ...((data ?? {}) as Record<string, unknown>), auth_email: email };
    }),
    rows("onboarding_events", admin.from("onboarding_events").select("*", COUNTED).eq("user_id", userId)),
    rows(
      "conversations",
      admin.schema("learning").from("conversations").select("*", COUNTED).eq("user_id", userId),
    ),
    section("messages", async () => {
      // Both sides of the exchange: their own messages and Raya's replies,
      // which are only reachable through the conversations they own.
      const ids = conversationIds ?? [];
      if (ids.length === 0) return [];
      const { data, count } = await admin
        .schema("learning")
        .from("messages")
        .select("*", COUNTED)
        .in("conversation_id", ids)
        .order("created_at", { ascending: true });
      return whole("messages", data ?? [], count);
    }),
    rows(
      "tool_outputs",
      admin.schema("learning").from("tool_outputs").select("*", COUNTED).eq("user_id", userId),
    ),
    section("conversation_files", async () => {
      const ids = conversationIds ?? [];
      if (ids.length === 0) return [];
      const { data, count } = await admin
        .schema("learning")
        .from("conversation_files")
        .select("*", COUNTED)
        .in("conversation_id", ids);
      return whole("conversation_files", data ?? [], count);
    }),
    rows(
      "room_members",
      admin.schema("learning").from("room_members").select("*", COUNTED).eq("user_id", userId),
    ),
    rows(
      "room_messages",
      admin.schema("learning").from("room_messages").select("*", COUNTED).eq("user_id", userId),
    ),
    rows(
      "challenges",
      admin.schema("learning").from("challenges").select("*", COUNTED).eq("created_by", userId),
    ),
    rows(
      "challenge_attempts",
      admin.schema("learning").from("challenge_attempts").select("*", COUNTED).eq("user_id", userId),
    ),
    rows("shares", admin.schema("learning").from("shares").select("*", COUNTED).eq("user_id", userId)),
    rows(
      "student_simulations",
      admin.schema("learning").from("student_simulations").select("*", COUNTED).eq("user_id", userId),
    ),
    rows("user_media", admin.schema("rag").from("user_media").select("*", COUNTED).eq("user_id", userId)),
    rows("school_identity", schools.from("student_identities").select("*", COUNTED).eq("user_id", userId)),
    rows("class_enrollments", admin.from("class_enrollments").select("*", COUNTED).eq("user_id", userId)),
    // Notes staff wrote ABOUT the student. They are in the school's own record
    // of the student, and art. 15 covers what is held about a person, not only
    // what they typed — so they belong in the student's bundle too.
    rows(
      "staff_followups",
      schools.from("student_followups").select("*", COUNTED).eq("student_user_id", userId),
    ),
    // The app's durable copy of the Kernel's read of the learner, including the
    // analysis the learner asked to keep ("Memorize") and the Kernel's summary.
    rows(
      "kernel_profile_snapshot",
      admin
        .schema("learning")
        .from("kernel_profile_snapshots")
        .select("*", COUNTED)
        .eq("user_id", userId),
    ),
    rows(
      "promo_redemptions",
      admin.from("user_promo_code_redemptions").select("*", COUNTED).eq("user_id", userId),
    ),
    rows(
      "data_requests",
      admin.from("data_requests").select("*", COUNTED).eq("subject_user_id", userId),
    ),
  ]);

  // The Kernel's model of the learner — what it believes they know, how
  // confidently, and how they approach difficulty. Held about them, never shown
  // to them in this form, and therefore exactly what art. 15 is for.
  const cognitive: Record<string, unknown> = {};
  await Promise.all(
    KERNEL_TABLES.map(async (table) => {
      cognitive[table] =
        (await rows(`kernel:${table}`, kernel.from(table).select("*", COUNTED).eq("user_id", userId))) ?? [];
    }),
  );

  return {
    _about: {
      subject_user_id: userId,
      generated_at: new Date().toISOString(),
      format: "application/json",
      contains:
        "Everything Bluestift holds about this account, including the Kernel's " +
        "internal model of the learner.",
      excludes:
        "Account credentials (the recovery key and any password) are omitted on " +
        "purpose — they authenticate the account rather than describe you.",
      note:
        "Payment records are retained separately under a statutory accounting " +
        "duty and are not erased with the account.",
    },
    account,
    onboarding_events: onboarding,
    conversations,
    messages,
    tool_outputs: toolOutputs,
    conversation_files: files,
    room_members: roomMemberships,
    room_messages: roomMessages,
    challenges,
    challenge_attempts: attempts,
    shares,
    student_simulations: simulations,
    uploads: media,
    school_identity: schoolIdentity,
    class_enrollments: enrollments,
    staff_followups: staffNotes,
    promo_redemptions: promo,
    data_requests: requests,
    cognitive_profile: cognitive,
    kernel_profile_snapshot: profileSnapshot,
    _errors: errors,
  };
}
