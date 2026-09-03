import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One generation, four languages.
 *
 * The feature is only worth having if it is cheap, so the tests are mostly about
 * the money: translate the finished document rather than regenerating it per
 * language, cache the result on the document's CONTENT so a class summarising
 * one lesson pays once between them, and never let a failure anywhere in that
 * chain cost the user the download they came for.
 */

const state: {
  row: Record<string, unknown> | null;
  selectThrows: boolean;
  upserts: Record<string, unknown>[];
  completion: string;
  completeThrows: boolean;
  calls: number;
} = {
  row: null,
  selectThrows: false,
  upserts: [],
  completion: "",
  completeThrows: false,
  calls: 0,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (state.selectThrows) throw new Error("cache down");
                return { data: state.row, error: null };
              },
            }),
          }),
        }),
        update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        upsert: async (row: Record<string, unknown>) => {
          state.upserts.push(row);
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/raya/llm", () => ({
  rayaComplete: async (_m: unknown, tier: string) => {
    state.calls += 1;
    if (state.completeThrows) throw new Error("model down");
    return { text: state.completion, model: `stub-${tier}` };
  },
}));

async function mod() {
  vi.resetModules();
  return import("@/lib/documents/translate");
}

const DOC = { title: "Class report", meta: "Whole school", body: "# Heading\n\n- one\n- two" };
const GOOD = "TITLE: Rapport de classe\nMETA: Toute l'école\n---\n# Titre\n\n- un\n- deux";

beforeEach(() => {
  state.row = null;
  state.selectThrows = false;
  state.upserts = [];
  state.completion = GOOD;
  state.completeThrows = false;
  state.calls = 0;
});

describe("the cache key", () => {
  it("is the CONTENT, not a document id", async () => {
    /**
     * The whole economic argument. Thirty students summarising the same lesson
     * produce thirty documents with one body between them; keyed on an id that
     * is thirty cache misses, keyed on the content it is one.
     */
    const m = await mod();
    const a = m.documentHash(DOC);
    const b = m.documentHash({ ...DOC });
    expect(a).toBe(b);
  });

  it("changes when any part of the document changes", async () => {
    // Which is also the invalidation: an edited report simply asks a different
    // question, and the stale row is never read again. Nothing to expire.
    const m = await mod();
    const base = m.documentHash(DOC);
    expect(m.documentHash({ ...DOC, body: DOC.body + " " })).not.toBe(base);
    expect(m.documentHash({ ...DOC, title: "Other" })).not.toBe(base);
    expect(m.documentHash({ ...DOC, meta: "Other" })).not.toBe(base);
  });
});

describe("translating", () => {
  it("spends nothing when the translation is already cached", async () => {
    const m = await mod();
    state.row = { title: "Rapport", meta: null, body: "# Titre" };
    const out = await m.translateDocument(DOC, "fr");
    expect(out.cached).toBe(true);
    expect(out.doc.title).toBe("Rapport");
    expect(state.calls).toBe(0); // the point
  });

  it("uses the FAST tier — this is a transformation, not a judgement", async () => {
    // The deep tier costs several times as much for text that is already
    // written, which would undercut the reason the feature exists.
    const src = readFileSync(join(process.cwd(), "lib/documents/translate.ts"), "utf8");
    expect(src).toMatch(/rayaComplete\([\s\S]*?"fast",/);
  });

  it("caches what it just paid for", async () => {
    const m = await mod();
    await m.translateDocument(DOC, "fr");
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].locale).toBe("fr");
    expect(state.upserts[0].title).toBe("Rapport de classe");
  });

  it("preserves the Markdown the exporter typesets", async () => {
    const m = await mod();
    const out = await m.translateDocument(DOC, "fr");
    expect(out.doc.body).toMatch(/^# /);
    expect(out.doc.body).toMatch(/- un\n- deux/);
  });
});

describe("nothing costs the user their download", () => {
  it("a model failure returns the ORIGINAL, not an error", async () => {
    // Someone who wanted French and gets English has lost a convenience;
    // someone who gets an error instead of a file has lost the report.
    const m = await mod();
    state.completeThrows = true;
    const out = await m.translateDocument(DOC, "fr");
    expect(out.translated).toBe(false);
    expect(out.doc).toEqual(DOC);
  });

  it("a mangled response returns the ORIGINAL, never a half-parsed document", async () => {
    const m = await mod();
    for (const junk of ["", "sorry, I can't do that", "TITLE: x", "---\nbody only"]) {
      state.completion = junk;
      const out = await m.translateDocument(DOC, "fr");
      expect(out.doc, junk).toEqual(DOC);
      expect(out.translated, junk).toBe(false);
    }
  });

  it("a cache outage costs a call, not the feature", async () => {
    const m = await mod();
    state.selectThrows = true;
    const out = await m.translateDocument(DOC, "fr");
    expect(out.translated).toBe(true);
    expect(state.calls).toBe(1);
  });

  it("strips a code fence a model wrapped the answer in", async () => {
    const m = await mod();
    state.completion = "```\n" + GOOD + "\n```";
    const out = await m.translateDocument(DOC, "fr");
    expect(out.doc.title).toBe("Rapport de classe");
    expect(out.doc.body).not.toMatch(/```/);
  });
});

describe("the endpoint", () => {
  const route = readFileSync(join(process.cwd(), "app/api/documents/translate/route.ts"), "utf8");

  it("is authenticated, capped and rate-limited", () => {
    // It spends a model call on a body the CLIENT supplies. Without all three of
    // these it is an open translation service billed to us.
    expect(route).toMatch(/status: 401/);
    expect(route).toMatch(/MAX_DOC_CHARS/);
    expect(route).toMatch(/checkUserRateLimit/);
  });

  it("limits per USER, not per IP", () => {
    // A whole school shares one NAT in our markets; an IP bucket would let one
    // class throttle the building.
    expect(route).toMatch(/checkUserRateLimit\("doc_translate"/);
  });

  it("accepts only the four shipped languages", () => {
    expect(route).toMatch(/isSupportedLocale\(locale\)/);
  });
});

describe("the cache table is service-role only", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260903120000_document_translations_cache.sql"),
    "utf8",
  );

  it("is not readable or writable from a browser", () => {
    // Readable, it enumerates other people's generated material by hash.
    // Writable, it poisons what everyone else downloads.
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on learning\.document_translations from anon, authenticated/);
  });

  it("is keyed on (source_hash, locale)", () => {
    expect(sql).toMatch(/primary key \(source_hash, locale\)/);
  });
});
