import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A quiz generated in Tools, reported to the Kernel when the student finishes it.
 *
 * Before this, Tools practice taught the Kernel nothing: the quiz was scored in
 * the browser and forgotten. The route grades from the STORED quiz — the client
 * only says which option it picked — so a student cannot hand the Kernel a
 * mastery they did not show.
 */

const state = {
  user: { id: "u1" } as { id: string } | null,
  output: null as { tool_type: string; output_content: unknown } | null,
  allowed: true,
  reports: [] as { userId: string; questions: { question: string; score: number | null }[]; resultSummary: string }[],
};

vi.mock("next/server", async (orig) => {
  const real = await orig<typeof import("next/server")>();
  return { ...real, after: (fn: () => unknown) => void fn() };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    schema: () => ({
      from: () => {
        const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.output }) };
        return chain;
      },
    }),
  }),
}));
vi.mock("@/lib/compliance/api-gate", () => ({ ageGateResponse: async () => null }));
vi.mock("@/lib/rate-limit", () => ({ checkStrictUserRateLimit: async () => state.allowed }));
vi.mock("@/lib/kernel/graded", () => ({
  reportGradedSubmission: async (r: (typeof state.reports)[number]) => {
    state.reports.push(r);
  },
}));

const QUIZ = {
  tool_type: "quiz",
  output_content: {
    questions: [
      { question: "Dérivée de x² ?", options: ["x", "2x", "x²"], correct_index: 1 },
      { question: "Racine de 16 ?", options: ["4", "8"], correct_index: 0 },
      { question: "Combien font 3 × 4 ?", options: ["7", "12"], correct_index: 1 },
    ],
  },
};

const post = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const call = async (body: unknown) => (await import("@/app/api/tools/quiz-result/route")).POST(post(body));

beforeEach(() => {
  state.user = { id: "u1" };
  state.output = QUIZ;
  state.allowed = true;
  state.reports = [];
});

describe("POST /api/tools/quiz-result", () => {
  it("grades against the stored quiz and tells the Kernel", async () => {
    // Right, wrong, skipped.
    expect((await call({ outputId: "o1", picks: [1, 1, -1] })).status).toBe(204);
    expect(state.reports).toHaveLength(1);
    const [r] = state.reports;
    expect(r.userId).toBe("u1");
    expect(r.questions).toEqual([
      { question: "Dérivée de x² ?", score: 1, format: "choice" },
      { question: "Racine de 16 ?", score: 0, format: "choice" },
    ]);
    expect(r.resultSummary).toContain("Score: 1/2");
  });

  it("does not take the browser's word for the score", async () => {
    await call({ outputId: "o1", picks: [0, 1, 0], score: 3, correct: 3 });
    expect(state.reports[0].questions.every((q) => q.score === 0)).toBe(true);
  });

  it("reports nothing for a quiz that is not the caller's, or not a quiz", async () => {
    state.output = null;
    expect((await call({ outputId: "someone-else", picks: [1] })).status).toBe(204);
    state.output = { tool_type: "summary", output_content: { text: "…" } };
    await call({ outputId: "o2", picks: [1] });
    expect(state.reports).toEqual([]);
  });

  it("reports nothing when every question was skipped", async () => {
    await call({ outputId: "o1", picks: [-1, -1, -1] });
    expect(state.reports).toEqual([]);
  });

  it("stops counting the same practice past a few an hour, without failing the student", async () => {
    state.allowed = false;
    expect((await call({ outputId: "o1", picks: [1, 0, 1] })).status).toBe(204);
    expect(state.reports).toEqual([]);
  });

  it("refuses a signed-out caller and a malformed body", async () => {
    expect((await call({ picks: [1] })).status).toBe(400);
    state.user = null;
    expect((await call({ outputId: "o1", picks: [1] })).status).toBe(401);
  });
});

describe("the Tools quiz player", () => {
  it("sends the picks when a quiz ends", () => {
    const tools = readFileSync(join(process.cwd(), "components/tools.tsx"), "utf8");
    expect(tools).toContain('"/api/tools/quiz-result"');
    const player = readFileSync(join(process.cwd(), "components/study/focus-player.tsx"), "utf8");
    expect(player).toContain("onFinished?.(questions.map((_, i) => picks[i] ?? -1));");
  });
});
