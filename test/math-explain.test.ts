import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcFacts, graphFacts } from "@/lib/math-engine";
import { parseGraph } from "@/lib/math-blocks";

/**
 * Raya explaining the calculator and the graph (owner, 2026-10-06: "boosté à
 * l'IA … que l'élève puisse à partir de sa fonction avoir des explications").
 * The maths stays math.js's: the route recomputes the learner's lines on the
 * server and the model only explains those results.
 */

const state = {
  user: { id: "u1" } as { id: string } | null,
  limited: false,
  prompts: [] as { system: string; user: string }[],
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/compliance/api-gate", () => ({ ageGateResponse: async () => null }));
vi.mock("@/lib/abuse-limits", () => ({
  limitExpensive: async () => (state.limited ? new Response(null, { status: 429 }) : null),
}));
vi.mock("@/lib/i18n/server", () => ({ getServerLocale: async () => "fr", apiT: async (k: string) => k }));
vi.mock("@/lib/raya/llm", () => ({
  rayaComplete: async (msgs: { content: string }[]) => {
    state.prompts.push({ system: msgs[0].content, user: msgs[1].content });
    return { text: "On applique la règle de la puissance : $3x^2$." };
  },
}));

const call = async (body: unknown) =>
  (await import("@/app/api/maths/explain/route")).POST(
    new Request("http://x/api/maths/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  );

beforeEach(() => {
  state.user = { id: "u1" };
  state.limited = false;
  state.prompts = [];
});

describe("what the tutor is given", () => {
  it("the calculator's own results, line by line", () => {
    const facts = calcFacts("a = 3\n√(a² + 4²)\ndérivée de x³\nfoo(2)");
    expect(facts[1]).toMatch(/→ {2}5$/);
    expect(facts[2]).toMatch(/→ {2}3 \* x \^ 2|→ {2}3x\^2|→ {2}3 x \^ 2/);
    expect(facts[3]).toContain("could not read");
  });

  it("a graph's derivative, zeros, turning points, areas and tangents", () => {
    const facts = graphFacts(parseGraph("f(x) = x² − 4\narea: f 0..2\ntangent: f 1"), {}).join("\n");
    expect(facts).toContain("derivative: 2 * x");
    expect(facts).toMatch(/zeros: x = -2; 2/);
    expect(facts).toMatch(/derivative is zero at x = 0 \(value -4\)/);
    expect(facts).toMatch(/integral = -16\/3/);
    expect(facts).toMatch(/tangent to f at x = 1: y = 2·x \+ -5/);
  });

  it("uses the slider values on screen", () => {
    const facts = graphFacts(parseGraph("f(x) = a·x + 1"), { a: 3 }).join("\n");
    expect(facts).toContain("a = 3");
    expect(facts).toMatch(/zeros: x = -1\/3/);
  });
});

describe("POST /api/maths/explain", () => {
  it("recomputes on the server and asks only for an explanation", async () => {
    const res = await call({ lang: "calc", src: "x² − 5x + 6 = 0\ndérivée de x³", focus: 1, question: "pourquoi 3 ?" });
    expect(res.status).toBe(200);
    expect((await res.json()).text).toContain("puissance");
    const [p] = state.prompts;
    expect(p.system).toContain("Those results are CORRECT");
    expect(p.user).toContain("answer in that language");
    expect(p.user).toContain("French");
    // The marked line, with the calculator's result; the other as context.
    expect(p.user).toMatch(/► dérivée de x³ {2}→/);
    expect(p.user).toMatch(/x=2, x=3/);
    expect(p.user).toContain("<question>pourquoi 3 ?</question>");
  });

  it("does not take a result from the browser", async () => {
    await call({ lang: "calc", src: "2 + 2", result: "5" });
    expect(state.prompts[0].user).toMatch(/2 \+ 2 {2}→ {2}4/);
    expect(state.prompts[0].user).not.toContain("5");
  });

  it("explains a graph with the sliders it was sent", async () => {
    await call({ lang: "graph", src: "f(x) = a·x²", sliders: { a: 2, "bad key!": 9 } });
    expect(state.prompts[0].user).toContain("a = 2");
    expect(state.prompts[0].user).not.toContain("bad key");
  });

  it("refuses a signed-out caller, an empty request, and past the ceiling", async () => {
    expect((await call({ lang: "calc", src: "" })).status).toBe(400);
    expect((await call({ lang: "poem", src: "x" })).status).toBe(400);
    state.limited = true;
    expect((await call({ lang: "calc", src: "1+1" })).status).toBe(429);
    state.user = null;
    expect((await call({ lang: "calc", src: "1+1" })).status).toBe(401);
    expect(state.prompts).toEqual([]);
  });
});

describe("in the tools", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");
  const tools = read("components/chat/math-tools.tsx");

  it("is offered on the learner's own tools, not on Raya's blocks in a reply", () => {
    expect(tools).toContain("{standalone && line.trim() && (");
    expect(tools).toContain("explainable={standalone}");
  });

  it("is asked once per press, not on every key or slider move", () => {
    expect(tools).toContain("const [explain, setExplain] = useState<{ at: number | \"all\"; req: ExplainRequest } | null>(null);");
    expect(tools).toContain("const [explaining, setExplaining] = useState<ExplainRequest | null>(null);");
  });

  it("sends nothing until pressed", () => {
    const box = read("components/chat/math-explain.tsx");
    expect(box.match(/"\/api\/maths\/explain"/g)).toHaveLength(1);
    // Only MathExplain calls it, and only the explain buttons mount it.
    expect(tools.match(/<MathExplain /g)?.length).toBe(3);
  });
});

describe("from a conversation to Tools", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");

  it("carries a reply's graph or calculation to the Tools page, in a Raya conversation only", () => {
    const tools = read("components/chat/math-tools.tsx");
    expect(tools).toContain('mode === "inline" && !dock && chatEnv?.enabled');
    expect(tools).toContain("saveMathTool(lang, current);");
    expect(tools).toContain("router.push(`/tools?maths=${lang}`);");
  });

  it("opens the panel on it when the Tools page is reached that way", () => {
    const page = read("components/tools.tsx");
    expect(page).toContain('const maths = url.searchParams.get("maths");');
    expect(page).toContain('if (maths === "graph" || maths === "calc") dock?.open(maths);');
  });

  it("tells Raya to offer a block on her own and to point to Tools", () => {
    const prompt = read("lib/raya/prompt.ts");
    expect(prompt).toContain("Don't wait to be asked:");
    expect(prompt).toContain('"Open in Tools"');
  });
});
