import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalyzeResponse, UpdateConceptStateRequest } from "@/lib/kernel/types";

/**
 * Reporting a graded submission to the Kernel. What matters here is that a real
 * score reaches the precise route once per KC, and that the diagnosis call can't
 * commit the same evidence a second time — double-counted attempts inflate
 * mastery, which is the one thing the Kernel must never get wrong.
 */

const state: {
  labelJson: string;
  updates: UpdateConceptStateRequest[];
  analyzeArgs: Record<string, unknown>[];
  updateImpl: (req: UpdateConceptStateRequest) => Promise<unknown>;
  analysis: AnalyzeResponse | null;
  invalidated: string[];
} = {
  labelJson: "",
  updates: [],
  analyzeArgs: [],
  updateImpl: async () => ({}),
  analysis: null,
  invalidated: [],
};

vi.mock("@/lib/raya/llm", () => ({
  generateJson: async () => state.labelJson,
}));

vi.mock("@/lib/kernel/client", () => ({
  clampHistory: (m: unknown) => m,
  kernel: {
    updateConceptState: async (req: UpdateConceptStateRequest) => {
      state.updates.push(req);
      return state.updateImpl(req);
    },
    analyze: async (args: Record<string, unknown>) => {
      state.analyzeArgs.push(args);
      return {
        alerts: [{ type: "false_mastery" }],
        root_gap: "notion_de_variable",
        recommended_path: ["notion_de_variable", "derivation_fonction"],
      } as unknown as AnalyzeResponse;
    },
  },
}));

vi.mock("@/lib/kernel/profile-cache", () => ({
  invalidateProfile: (u: string) => state.invalidated.push(u),
  setLatestAnalysis: (_u: string, res: AnalyzeResponse) => {
    state.analysis = res;
  },
}));

async function freshModule() {
  vi.resetModules();
  return import("@/lib/kernel/graded");
}

beforeEach(() => {
  state.labelJson = JSON.stringify({ subject: "MATH", kcs: ["derivation_fonction"] });
  state.updates = [];
  state.analyzeArgs = [];
  state.updateImpl = async () => ({});
  state.analysis = null;
  state.invalidated = [];
});

describe("reportGradedSubmission", () => {
  it("sends one update per KC, averaging the questions that test it", async () => {
    state.labelJson = JSON.stringify({
      subject: "MATH",
      kcs: ["derivation_fonction", "derivation_fonction", "notion_de_variable"],
    });
    const { reportGradedSubmission } = await freshModule();

    await reportGradedSubmission({
      userId: "u1",
      questions: [
        { question: "Q1", score: 1 },
        { question: "Q2", score: 0.5 },
        { question: "Q3", score: 0.2 },
      ],
      resultSummary: "Score: 2/3.",
    });

    expect(state.updates).toHaveLength(2);
    const derivation = state.updates.find((u) => u.concept_label === "derivation_fonction");
    expect(derivation?.partial_credit_score).toBeCloseTo(0.75); // (1 + 0.5) / 2
    expect(derivation?.subject).toBe("MATH");
    const variable = state.updates.find((u) => u.concept_label === "notion_de_variable");
    expect(variable?.partial_credit_score).toBeCloseTo(0.2);
  });

  it("asks /analyze to diagnose without committing state a second time", async () => {
    const { reportGradedSubmission } = await freshModule();
    await reportGradedSubmission({
      userId: "u1",
      questions: [{ question: "Q1", score: 1 }],
      resultSummary: "Score: 1/1.",
    });

    expect(state.analyzeArgs).toHaveLength(1);
    expect(state.analyzeArgs[0].commit_state).toBe(false);
    // The diagnosis subject comes from the labelling pass, not a hardcoded default.
    expect(state.analyzeArgs[0].subject).toBe("MATH");
  });

  it("skips ungraded and unlabelled questions", async () => {
    state.labelJson = JSON.stringify({ subject: "MATH", kcs: ["fractions", null] });
    const { reportGradedSubmission } = await freshModule();

    await reportGradedSubmission({
      userId: "u1",
      questions: [
        { question: "graded but…", score: null }, // grading was unavailable
        { question: "labelled as nothing", score: 1 },
      ],
      resultSummary: "…",
    });

    expect(state.updates).toEqual([]);
  });

  it("keeps going when one KC update fails, and still diagnoses", async () => {
    state.labelJson = JSON.stringify({ subject: "MATH", kcs: ["a_kc", "b_kc"] });
    state.updateImpl = async (req) => {
      if (req.concept_label === "a_kc") throw new Error("kernel 500");
      return {};
    };
    const { reportGradedSubmission } = await freshModule();

    await reportGradedSubmission({
      userId: "u1",
      questions: [
        { question: "Q1", score: 0.4 },
        { question: "Q2", score: 0.9 },
      ],
      resultSummary: "…",
    });

    expect(state.updates.map((u) => u.concept_label)).toEqual(["a_kc", "b_kc"]);
    expect(state.analyzeArgs).toHaveLength(1);
  });

  it("parks the whole diagnosis and invalidates the profile", async () => {
    const { reportGradedSubmission } = await freshModule();
    await reportGradedSubmission({
      userId: "u1",
      questions: [{ question: "Q1", score: 0.1 }],
      resultSummary: "…",
    });

    // Not just the alerts: the root gap and the order it wants the concepts
    // taught in are the half of /analyze nothing else can reconstruct.
    expect(state.analysis?.alerts).toEqual([{ type: "false_mastery" }]);
    expect(state.analysis?.root_gap).toBe("notion_de_variable");
    expect(state.analysis?.recommended_path).toEqual([
      "notion_de_variable",
      "derivation_fonction",
    ]);
    expect(state.invalidated).toEqual(["u1"]);
  });

  it("still invalidates the profile when labelling collapses", async () => {
    state.labelJson = "not json at all";
    const { reportGradedSubmission } = await freshModule();

    await reportGradedSubmission({
      userId: "u1",
      questions: [{ question: "Q1", score: 1 }],
      resultSummary: "…",
    });

    expect(state.updates).toEqual([]); // no labels -> no per-KC signal
    expect(state.invalidated).toEqual(["u1"]);
  });
});
