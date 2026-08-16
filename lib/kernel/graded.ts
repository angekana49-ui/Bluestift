import "server-only";
import { kernel, clampHistory } from "./client";
import { invalidateProfile, setLatestAnalysis } from "./profile-cache";
import { generateJson } from "@/lib/raya/llm";
import type { KernelMessage } from "./types";

/**
 * Reporting a graded submission (challenge, assignment) to the Kernel.
 *
 * A graded attempt is the strongest signal the product produces: a real score on
 * a known question, not something inferred from chat. It deserves the precise
 * route — POST /update_concept_state with the actual partial credit — rather than
 * being flattened into a synthetic conversation for /analyze to re-infer.
 *
 * Both are still sent, because they answer different questions: the per-KC
 * updates carry the truth about *this* attempt, /analyze produces the root-gap
 * diagnosis across the graph. The diagnosis call runs with `commit_state: false`
 * so the kernel doesn't commit its own BKT updates on top of ours — the same
 * evidence twice would inflate mastery.
 *
 * The whole thing is best-effort: the caller has already persisted the attempt
 * and returned the student's score. Nothing here is allowed to throw into that
 * path, so every failure degrades to "the kernel didn't learn from this one".
 */

/** One graded question, as the caller's grader produced it. */
export type GradedQuestion = {
  question: string;
  /** Partial credit 0..1, or null when grading was unavailable (skipped). */
  score: number | null;
  /** True when the student got help on this one (caps the credit kernel-side). */
  isAssisted?: boolean;
};

type LabelledSubmission = { subject: string; labels: (string | null)[] };

/**
 * Ask the LLM which knowledge component each question tests, in one call.
 *
 * Labels are snake_case concept names, not UUIDs — the kernel owns the ontology
 * and canonicalizes what we send onto its existing KCs (or creates the KC). The
 * prompt asks for the *concept under test*, not a restatement of the question,
 * because a label that mirrors the wording produces a new near-duplicate KC in
 * the graph every time.
 */
async function labelKnowledgeComponents(questions: string[]): Promise<LabelledSubmission> {
  const fallback: LabelledSubmission = { subject: "MATH", labels: questions.map(() => null) };
  if (questions.length === 0) return fallback;
  try {
    const raw = await generateJson(
      "You map exam questions onto the knowledge component (concept) each one tests. " +
        'Return JSON exactly as {"subject":"MATH","kcs":["nom_du_concept"]}, one kcs entry per question IN THE SAME ORDER. ' +
        "subject is one of MATH, PHYSICS, CHEMISTRY, BIOLOGY, HISTORY, ENGLISH, OTHER. " +
        "Each kcs entry is the underlying concept in snake_case, in French, general enough that other questions on the same concept get the identical label " +
        '(e.g. "derivation_fonction", not "derivee_de_x_carre"). Use null for a question that tests no identifiable concept.',
      questions.map((q, i) => `Q${i + 1}: ${q}`).join("\n"),
    );
    const parsed = JSON.parse(raw) as { subject?: string; kcs?: (string | null)[] };
    const kcs = Array.isArray(parsed?.kcs) ? parsed.kcs : [];
    return {
      subject: typeof parsed?.subject === "string" && parsed.subject ? parsed.subject : "MATH",
      labels: questions.map((_, i) => {
        const label = kcs[i];
        return typeof label === "string" && label.trim() ? label.trim().slice(0, 128) : null;
      }),
    };
  } catch {
    return fallback;
  }
}

/**
 * Send a graded submission to the Kernel: precise per-KC state updates, then a
 * diagnose-only /analyze. Resolves once done; never rejects.
 *
 * Callers should `void` this — the student's response must not wait on it.
 */
export async function reportGradedSubmission(opts: {
  userId: string;
  questions: GradedQuestion[];
  /** Line describing the overall result, fed to the diagnosis call. */
  resultSummary: string;
  level?: string;
  trigger?: string;
}): Promise<void> {
  const { userId, questions, resultSummary, level = "unknown", trigger = "post_challenge" } = opts;

  try {
    const { subject, labels } = await labelKnowledgeComponents(questions.map((q) => q.question));

    // Several questions can test the same KC. The kernel expects one graded
    // attempt per KC, so average the scores rather than firing N updates that
    // would each move mastery on partial evidence.
    const perKc = new Map<string, { total: number; n: number; assisted: number }>();
    questions.forEach((q, i) => {
      const label = labels[i];
      if (!label || q.score == null) return; // ungraded or unlabelled: no signal
      const acc = perKc.get(label) ?? { total: 0, n: 0, assisted: 0 };
      acc.total += q.score;
      acc.n += 1;
      if (q.isAssisted) acc.assisted += 1;
      perKc.set(label, acc);
    });

    // Sequential on purpose: each update triggers a background recalibration of
    // that KC kernel-side, and a burst of concurrent writes on the shared DB is
    // how the kernel's grants got hammered before. A submission is a handful of KCs.
    for (const [label, acc] of perKc) {
      try {
        await kernel.updateConceptState({
          user_id: userId,
          concept_label: label,
          subject,
          level,
          partial_credit_score: acc.total / acc.n,
          is_assisted: acc.assisted > acc.n / 2,
        });
      } catch {
        // One KC failing (unknown label, transient 5xx) must not drop the rest.
      }
    }

    const convo: KernelMessage[] = [{ role: "user", content: resultSummary }];
    const diagnosis = await kernel.analyze({
      user_id: userId,
      conversation_history: clampHistory(convo),
      subject,
      level,
      trigger,
      commit_state: false, // state already committed above — don't count it twice
    });
    // Same as the chat path: park the whole diagnosis so RAYA's next turn reacts
    // to it. A graded submission is where false_mastery and cognitive_overload
    // surface — and where the root gap behind a bad score is worth most, since
    // nothing else in the app can reconstruct the chain the Kernel walked.
    setLatestAnalysis(userId, diagnosis);
  } catch {
    // Best-effort by contract: the attempt is saved and the score is returned
    // regardless of whether the kernel heard about it.
  } finally {
    // The profile changed (or may have); drop the cache either way.
    invalidateProfile(userId);
  }
}
