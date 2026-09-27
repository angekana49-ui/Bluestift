import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What a student actually costs us in inference, from the tokens we were billed
 * for — the read side of `learning.messages.tokens_used`, which until now was
 * written on every turn and never looked at once.
 *
 * This exists to answer one question with a number instead of a hope: does a
 * $2/student/month seat cover the student's inference? `lib/raya/routing.ts`
 * splits turns between a cheap and an expensive model on exactly that premise,
 * and the split was never measured against a bill.
 *
 * TWO HONEST LIMITS, both surfaced in the report rather than hidden in it:
 *
 *  1. Only the TOTAL token count is stored, not the input/output split, so the
 *     cost applies a blended rate (see ASSUMED_INPUT_SHARE). Persisting the
 *     split — `usage.prompt` and `usage.completion` are already computed and
 *     thrown away at the insert — is what would make these figures exact.
 *  2. A model with no rate is reported as unpriced, never as free. Silently
 *     costing an unknown model at zero would make the total look best exactly
 *     when we understand it least.
 */

export type ModelRate = { inputPerMTok: number; outputPerMTok: number };

/**
 * USD per million tokens, matched against the stored `model_used` by substring
 * (which reads "gemini:gemini-3.5-flash-lite") — longest key first, so a
 * specific entry beats a family one.
 *
 * TREAT THESE AS PLACEHOLDERS. They are the right order of magnitude for the
 * models in service, not a quote: provider list prices move, and this file is
 * not where the truth about them lives. Set `LLM_RATES` to the figures from the
 * provider's own price page and the report will say the rate came from
 * configuration rather than from here.
 */
const FALLBACK_RATES: Record<string, ModelRate> = {
  "flash-lite": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
  "gpt-oss-120b": { inputPerMTok: 0.15, outputPerMTok: 0.75 },
};

/**
 * Share of a turn's tokens assumed to be input, used to blend one rate out of
 * two when only the total was recorded.
 *
 * 0.9, and deliberately high: a Raya turn sends the system prompt (a rulebook
 * of a few thousand tokens), the conversation history and any attached
 * documents, and gets back a Socratic question of a couple of hundred. The 10
 * turns on record average 3.9k tokens each, which only a prompt that size
 * explains. Guessing 50/50 here would overstate the bill roughly threefold,
 * because output tokens cost several times what input tokens do.
 */
export const ASSUMED_INPUT_SHARE = 0.9;

/** Rows are read in pages of this size, and the report stops after CAP. */
const PAGE = 1000;
const CAP = 50_000;

function configuredRates(): Record<string, ModelRate> {
  const raw = process.env.LLM_RATES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, { in?: number; out?: number }>;
    const out: Record<string, ModelRate> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const i = Number(value?.in);
      const o = Number(value?.out);
      if (Number.isFinite(i) && Number.isFinite(o)) {
        out[key] = { inputPerMTok: i, outputPerMTok: o };
      }
    }
    return out;
  } catch {
    // A malformed LLM_RATES must not take the page down; the report will just
    // say every rate came from the fallback table.
    return {};
  }
}

export type RateSource = "configured" | "fallback" | "none";

export function rateFor(
  modelUsed: string | null,
  overrides: Record<string, ModelRate> = configuredRates(),
): { rate: ModelRate | null; source: RateSource } {
  if (!modelUsed) return { rate: null, source: "none" };
  const name = modelUsed.toLowerCase();
  for (const [table, source] of [
    [overrides, "configured"],
    [FALLBACK_RATES, "fallback"],
  ] as const) {
    const keys = Object.keys(table).sort((a, b) => b.length - a.length);
    const hit = keys.find((k) => name.includes(k.toLowerCase()));
    const rate = hit === undefined ? undefined : table[hit];
    if (rate) return { rate, source };
  }
  return { rate: null, source: "none" };
}

/** Blended cost in USD for `tokens` on one model, or null when unpriced. */
export function costOf(tokens: number, rate: ModelRate | null): number | null {
  if (rate === null) return null;
  const blended =
    ASSUMED_INPUT_SHARE * rate.inputPerMTok + (1 - ASSUMED_INPUT_SHARE) * rate.outputPerMTok;
  return (tokens / 1_000_000) * blended;
}

export type StudentCost = {
  userId: string;
  /** Display name, else email, else a short id — never a bare uuid to squint at. */
  label: string;
  schoolId: string | null;
  /** Assistant turns generated for this student in the window. */
  turns: number;
  /** Turns whose provider never reported a token count: real spend, unmeasured. */
  unmeasuredTurns: number;
  tokens: number;
  /** Tokens on a model we have no rate for — excluded from costUsd. */
  unpricedTokens: number;
  costUsd: number;
};

export type ModelUsage = {
  model: string;
  turns: number;
  tokens: number;
  rate: ModelRate | null;
  rateSource: RateSource;
};

export type CostReport = {
  /** ISO start of the window; the window ends now. */
  since: string;
  windowDays: number;
  students: StudentCost[];
  models: ModelUsage[];
  totals: {
    students: number;
    turns: number;
    unmeasuredTurns: number;
    tokens: number;
    unpricedTokens: number;
    costUsd: number;
  };
  /** Mean and worst cost per student over the window. The mean pays the bill;
   *  the worst is the one that decides whether per-seat pricing survives. */
  meanCostUsd: number | null;
  maxCostUsd: number | null;
  /** True when the row cap was hit — the figures are then a floor, not a total. */
  truncated: boolean;
};

type MessageRow = { conversation_id: string; model_used: string | null; tokens_used: number | null };

/**
 * Aggregate inference spend per student over the last `windowDays`.
 *
 * Grouped through `conversations.user_id`, not `messages.user_id`, because an
 * assistant row is stored with a null user — the reply belongs to the thread,
 * and the thread belongs to the student. A room conversation is attributed to
 * its owner, which is the only student it has.
 *
 * Joined in TypeScript over two flat reads rather than one embedded query: the
 * grouping is a GROUP BY that PostgREST will not do, so the rows have to come
 * over regardless, and two plain selects have no relationship metadata to get
 * wrong. At pilot volumes this is a handful of pages; CAP is what stops it
 * quietly becoming something else.
 */
export async function studentCostReport(windowDays = 30): Promise<CostReport> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const rows: MessageRow[] = [];
  let truncated = false;
  for (let from = 0; from < CAP; from += PAGE) {
    const { data, error } = await admin
      .schema("learning")
      .from("messages")
      .select("conversation_id, model_used, tokens_used")
      .eq("role", "assistant")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as MessageRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
    if (from + PAGE >= CAP) truncated = true;
  }

  const conversationIds = [...new Set(rows.map((r) => r.conversation_id).filter(Boolean))];
  const owner = new Map<string, { userId: string | null; schoolId: string | null }>();
  for (let i = 0; i < conversationIds.length; i += PAGE) {
    const { data, error } = await admin
      .schema("learning")
      .from("conversations")
      .select("id, user_id, school_id")
      .in("id", conversationIds.slice(i, i + PAGE));
    if (error) throw error;
    for (const c of (data ?? []) as { id: string; user_id: string | null; school_id: string | null }[]) {
      owner.set(c.id, { userId: c.user_id, schoolId: c.school_id });
    }
  }

  const overrides = configuredRates();
  const byStudent = new Map<string, StudentCost>();
  const byModel = new Map<string, ModelUsage>();

  for (const row of rows) {
    const model = row.model_used ?? "(unreported)";
    const { rate, source } = rateFor(row.model_used, overrides);
    const tokens = row.tokens_used ?? 0;

    const m = byModel.get(model) ?? { model, turns: 0, tokens: 0, rate, rateSource: source };
    m.turns += 1;
    m.tokens += tokens;
    byModel.set(model, m);

    const userId = owner.get(row.conversation_id)?.userId;
    if (!userId) continue; // an orphaned thread costs money but belongs to no one
    const s =
      byStudent.get(userId) ??
      {
        userId,
        label: userId.slice(0, 8),
        schoolId: owner.get(row.conversation_id)?.schoolId ?? null,
        turns: 0,
        unmeasuredTurns: 0,
        tokens: 0,
        unpricedTokens: 0,
        costUsd: 0,
      };
    s.turns += 1;
    if (row.tokens_used == null) s.unmeasuredTurns += 1;
    s.tokens += tokens;
    const cost = costOf(tokens, rate);
    if (cost === null) s.unpricedTokens += tokens;
    else s.costUsd += cost;
    byStudent.set(userId, s);
  }

  // Names, so the table reads as people rather than as uuids.
  const ids = [...byStudent.keys()];
  for (let i = 0; i < ids.length; i += PAGE) {
    const { data } = await admin
      .from("users")
      .select("id, display_name, email")
      .in("id", ids.slice(i, i + PAGE));
    for (const u of (data ?? []) as { id: string; display_name: string | null; email: string | null }[]) {
      const s = byStudent.get(u.id);
      if (s) s.label = u.display_name || u.email || s.label;
    }
  }

  const students = [...byStudent.values()].sort((a, b) => b.costUsd - a.costUsd);
  const totals = students.reduce(
    (acc, s) => ({
      students: acc.students + 1,
      turns: acc.turns + s.turns,
      unmeasuredTurns: acc.unmeasuredTurns + s.unmeasuredTurns,
      tokens: acc.tokens + s.tokens,
      unpricedTokens: acc.unpricedTokens + s.unpricedTokens,
      costUsd: acc.costUsd + s.costUsd,
    }),
    { students: 0, turns: 0, unmeasuredTurns: 0, tokens: 0, unpricedTokens: 0, costUsd: 0 },
  );

  return {
    since,
    windowDays,
    students,
    models: [...byModel.values()].sort((a, b) => b.tokens - a.tokens),
    totals,
    meanCostUsd: students.length ? totals.costUsd / students.length : null,
    maxCostUsd: students.length ? Math.max(...students.map((s) => s.costUsd)) : null,
    truncated,
  };
}
