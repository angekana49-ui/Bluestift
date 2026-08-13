import "server-only";
import {
  createAdminClient,
  createSchoolsAdminClient,
  createKernelAdminClient,
} from "@/lib/supabase/admin";

/**
 * One student's education record, as the school holds it — what a school hands
 * to a parent exercising the FERPA right to inspect and review.
 *
 * Scope is deliberately NARROWER than the student's own export.
 *
 * A student's solo conversations with Raya are excluded, along with their
 * uploads and their private channel inside a study room. The product promises
 * students a tutor they can be wrong in front of, and a record that quietly
 * hands every one of those exchanges to a teacher would break that promise —
 * a student who believes they are being read stops asking the questions that
 * make the tutoring work. What the school gets is what the school already sees
 * in its dashboard: who the student is, what they were set, how they performed,
 * what the Kernel infers about their understanding, and the notes staff have
 * written about them.
 *
 * A parent who wants everything, including the conversations, can ask for it
 * through the student's own account export — which returns all of it.
 */

export type StudentRecord = Record<string, unknown>;

const KERNEL_TABLES = [
  "student_concept_state",
  "student_mindset_state",
  "student_risk_assessments",
  "learning_trajectories",
] as const;

export async function buildStudentRecord(input: {
  studentUserId: string;
  classId: string;
}): Promise<StudentRecord> {
  const admin = createAdminClient();
  const schools = createSchoolsAdminClient();
  const kernel = createKernelAdminClient();
  const { studentUserId, classId } = input;

  const errors: string[] = [];
  const soft = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run();
    } catch {
      errors.push(label);
      return null;
    }
  };

  const [identity, account, followups, attempts, cognitive] = await Promise.all([
    soft("identity", async () => {
      const { data } = await schools
        .from("student_identities")
        .select("*")
        .eq("user_id", studentUserId)
        .eq("class_id", classId)
        .maybeSingle();
      return data ?? null;
    }),
    soft("account", async () => {
      // No email, no recovery code: the school's record is about the student,
      // not about how they sign in.
      const { data } = await admin
        .from("users")
        .select(
          "id, username, display_name, school_level, school_id, school_year_id, " +
            "created_at, last_activity_at",
        )
        .eq("id", studentUserId)
        .maybeSingle();
      return data ?? null;
    }),
    soft("followups", async () => {
      const { data } = await schools
        .from("student_followups")
        .select("*")
        .eq("student_user_id", studentUserId);
      return data ?? [];
    }),
    soft("challenge_attempts", async () => {
      const { data } = await admin
        .schema("learning")
        .from("challenge_attempts")
        .select("*")
        .eq("user_id", studentUserId);
      return data ?? [];
    }),
    (async () => {
      const out: Record<string, unknown> = {};
      await Promise.all(
        KERNEL_TABLES.map(async (table) => {
          out[table] =
            (await soft(`kernel:${table}`, async () => {
              const { data } = await kernel.from(table).select("*").eq("user_id", studentUserId);
              return data ?? [];
            })) ?? [];
        }),
      );
      return out;
    })(),
  ]);

  return {
    _about: {
      subject_user_id: studentUserId,
      class_id: classId,
      generated_at: new Date().toISOString(),
      scope:
        "The education record held on behalf of the school: identity, enrolment, " +
        "assessment results, inferred understanding, and staff notes.",
      excludes:
        "The student's own conversations with Raya, their uploaded documents and " +
        "their private channel in study rooms. Those belong to the student and are " +
        "available through their own account export.",
    },
    identity,
    account,
    staff_followups: followups,
    assessment_results: attempts,
    cognitive_profile: cognitive,
    _errors: errors,
  };
}
