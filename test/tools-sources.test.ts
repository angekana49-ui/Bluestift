import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A quiz, a summary or a mind map without a file: built from a topic (its
 * Wikipedia article, cited) or from one of the learner's own conversations
 * with Raya. These pin who may use which conversation, what reaches the model,
 * and what the learner is told about where it came from.
 */

type Row = Record<string, unknown>;
const state = {
  conv: null as Row | null,
  msgs: [] as Row[],
  article: null as { title: string; url: string; text: string } | null,
  llm: [] as { system: string; source: string }[],
  updates: [] as Row[],
  wikiCalls: [] as string[],
};

function query(table: string) {
  let op = "select";
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const m of ["select", "eq", "in", "neq", "gte", "order", "limit", "is"]) api[m] = self;
  api.insert = () => ((op = "insert"), api);
  api.update = (p: Row) => ((op = "update"), state.updates.push(p), api);
  const result = () => {
    if (table === "conversations") return { data: state.conv };
    if (table === "messages") return { data: state.msgs };
    if (table === "user_media") return { data: [] };
    if (table === "tool_outputs") return op === "insert" ? { data: { id: "o1" }, error: null } : op === "update" ? { error: null } : { count: 0 };
    return { data: null };
  };
  api.maybeSingle = async () => result();
  api.single = async () => result();
  api.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
  return api;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    schema: () => ({ from: (t: string) => query(t) }),
  }),
}));
vi.mock("@/lib/abuse-limits", () => ({ limitExpensive: async () => null }));
vi.mock("@/lib/compliance/api-gate", () => ({ ageGateResponse: async () => null }));
vi.mock("@/lib/entitlements", () => ({
  resolveRayaEntitlements: async () => ({ ent: { mindMap: true, generationsPerMonth: 100 }, tier: "free" }),
  gateFeature: async () => null,
  gateQuota: async () => null,
  startOfMonthIso: () => "2026-10-01",
}));
vi.mock("@/lib/analytics/server", () => ({ captureServer: async () => {} }));
vi.mock("@/lib/observability/client-error", () => ({ clientError: (_e: unknown, f?: string) => f ?? "error" }));
vi.mock("@/lib/i18n/server", () => ({ apiT: async (k: string) => k, getServerLocale: async () => "fr" }));
vi.mock("@/lib/raya/wikipedia", () => ({
  wikipediaArticle: async (topic: string) => {
    state.wikiCalls.push(topic);
    return state.article;
  },
}));
vi.mock("@/lib/raya/llm", () => ({
  generateJson: async (system: string, source: string) => {
    state.llm.push({ system, source });
    return JSON.stringify({ questions: [{ question: "q", options: ["a", "b", "c", "d"], correct_index: 0, explanation: "e" }] });
  },
  rayaComplete: async (msgs: { content: string }[]) => {
    state.llm.push({ system: msgs[0].content, source: msgs[1].content });
    return { text: "résumé" };
  },
}));

const generate = async (body: Row) =>
  (await import("@/app/api/tools/generate/route")).POST(
    new Request("http://x/api/tools/generate", { method: "POST", body: JSON.stringify({ tool_type: "quiz", ...body }) }),
  );

beforeEach(() => {
  state.conv = null;
  state.msgs = [];
  state.article = null;
  state.llm = [];
  state.updates = [];
  state.wikiCalls = [];
});

describe("from a topic", () => {
  it("builds from the Wikipedia article and says which one", async () => {
    state.article = { title: "Photosynthèse", url: "https://fr.wikipedia.org/wiki/Photosynth%C3%A8se", text: "La photosynthèse est…" };
    const res = await generate({ topic: "La photosynthèse, niveau 3e" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(state.wikiCalls).toEqual(["La photosynthèse, niveau 3e"]);
    expect(state.llm[0].source).toContain("La photosynthèse est…");
    expect(data.reference).toEqual({ title: "Photosynthèse", url: "https://fr.wikipedia.org/wiki/Photosynth%C3%A8se" });
    // Kept with the result, so it is still cited when reopened.
    expect(state.updates.at(-1)).toMatchObject({ status: "done", output_content: { reference: data.reference, topic_only: false } });
  });

  it("falls back to the topic alone, tells the model to stay textbook-level, and flags it", async () => {
    const res = await generate({ topic: "un sujet introuvable" });
    const data = await res.json();
    expect(data.topic_only).toBe(true);
    expect(data.reference).toBeNull();
    expect(state.llm[0].system).toContain("There is no study material");
  });

  it("never mixes a topic into a generation that has its own material", async () => {
    await generate({ topic: "x", source_text: "Mon cours sur les fractions." });
    expect(state.wikiCalls).toEqual([]);
    expect(state.llm[0].source).toBe("Mon cours sur les fractions.");
  });

  it("keeps what it is about with the result, for the library to name it", async () => {
    await generate({ topic: "Les fractions", title: "Les fractions" });
    expect(state.updates.at(-1)).toMatchObject({ output_content: { label: "Les fractions" } });
  });
});

describe("from a conversation", () => {
  it("uses the learner's own conversation, framed so their mistakes are not taught back", async () => {
    state.conv = { id: "c1", user_id: "u1", is_private_room_channel: false };
    state.msgs = [
      { role: "user", content: "c'est quoi une dérivée ?" },
      { role: "assistant", content: "La dérivée mesure la pente." },
    ];
    const res = await generate({ conversation_id: "c1" });
    expect(res.status).toBe(200);
    expect(state.llm[0].source).toContain("never from the student's mistakes");
    expect(state.llm[0].source).toContain("Raya: La dérivée mesure la pente.");
    expect(state.llm[0].source).toContain("Student: c'est quoi une dérivée ?");
  });

  it("refuses someone else's conversation and a room's private channel", async () => {
    state.conv = { id: "c1", user_id: "someone-else", is_private_room_channel: false };
    expect((await generate({ conversation_id: "c1" })).status).toBe(404);
    state.conv = { id: "c1", user_id: "u1", is_private_room_channel: true };
    expect((await generate({ conversation_id: "c1" })).status).toBe(404);
    state.conv = null;
    expect((await generate({ conversation_id: "c1" })).status).toBe(404);
    expect(state.llm).toEqual([]);
  });

  it("says the source is empty rather than generating from nothing", async () => {
    state.conv = { id: "c1", user_id: "u1", is_private_room_channel: false };
    expect((await generate({ conversation_id: "c1" })).status).toBe(400);
  });
});

describe("what leaves for Wikipedia", () => {
  it("strips what identifies a person from the topic", async () => {
    const { topicForLookup } = await vi.importActual<typeof import("@/lib/raya/wikipedia")>("@/lib/raya/wikipedia");
    expect(topicForLookup("révolution française marie@ex.com +33 6 12 34 56 78 @marie")).toBe("révolution française");
    expect(topicForLookup("   ")).toBeNull();
  });

  it("searches for the subject, not the level added for the model", async () => {
    // With "niveau 3e" in the search, Wikipedia ranked cyanobacteria first.
    const { searchPhrase } = await vi.importActual<typeof import("@/lib/raya/wikipedia")>("@/lib/raya/wikipedia");
    expect(searchPhrase("La photosynthèse, niveau 3e")).toBe("La photosynthèse");
    expect(searchPhrase("les fractions (CM2)")).toBe("les fractions");
    expect(searchPhrase("Photosynthesis, Year 9")).toBe("Photosynthesis");
    expect(searchPhrase("Integrale Klasse 11")).toBe("Integrale");
    expect(searchPhrase("Pythagore 4e")).toBe("Pythagore");
  });
});

describe("the Tools page", () => {
  const tools = readFileSync(join(process.cwd(), "components/tools.tsx"), "utf8").split("\r\n").join("\n");
  it("sends only the chosen source", () => {
    expect(tools).toContain('mode === "topic"\n            ? { topic: topic.trim() }');
    expect(tools).toContain(": { conversation_id: conversationId };");
  });
  it("lists only the learner's own, solo, unarchived conversations", () => {
    const page = readFileSync(join(process.cwd(), "app/tools/page.tsx"), "utf8").split("\r\n").join("\n");
    expect(page).toMatch(/from\("conversations"\)\s*\.select\("id, title, updated_at"\)\s*\.eq\("user_id", user\.id\)\s*\.is\("room_id", null\)\s*\.eq\("is_private_room_channel", false\)\s*\.is\("archived_at", null\)/);
  });
  it("names each generation by its subject, not a column of bare \"Quiz\"", () => {
    expect(tools).toContain("return about ? `${name} — ${about}` : name;");
    expect(tools).toContain("label={label}");
  });
  it("offers the calculator and the graph on the page, opening the Maths panel beside it", () => {
    expect(tools).toContain("onClick={() => dock.open(m.lang)}");
    expect(tools).toMatch(/lang: "calc"[\s\S]*lang: "graph"/);
  });
  it("gives every tool its own icon", () => {
    expect(tools).toContain("mind_map: IconMindMap,");
  });
});
