import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanNameSet, conceptName, readableLabel } from "@/lib/kernel/concept-names";

/**
 * A Kernel concept's label is its identity (French snake_case, on purpose);
 * people read its display name. These pin what a teacher or a student is shown.
 */

const NAMES = {
  resoudre_equations_lineaires: {
    en: "Solving linear equations",
    fr: "Résoudre des équations linéaires",
  },
};

describe("the name shown for a concept", () => {
  it("is the reader's language when the Kernel has it", () => {
    expect(conceptName("resoudre_equations_lineaires", "en", NAMES)).toBe("Solving linear equations");
    expect(conceptName("resoudre_equations_lineaires", "fr", NAMES)).toBe("Résoudre des équations linéaires");
  });

  it("falls back to English, then to the label made readable — never the raw label", () => {
    expect(conceptName("resoudre_equations_lineaires", "de", NAMES)).toBe("Solving linear equations");
    expect(conceptName("fonction_affine", "en", NAMES)).toBe("Fonction affine");
    expect(conceptName("fonction_affine", "en", null)).toBe("Fonction affine");
  });

  it("matches the label whatever its case or surrounding space", () => {
    expect(conceptName(" Resoudre_Equations_Lineaires ", "en", NAMES)).toBe("Solving linear equations");
  });

  it("leaves free text alone and blank stays blank", () => {
    expect(readableLabel("Review fractions before ratios")).toBe("Review fractions before ratios");
    expect(conceptName("", "en", NAMES)).toBe("");
    expect(conceptName(null, "en", NAMES)).toBe("");
  });
});

describe("display names read from the database", () => {
  it("keep known locales and plain text only", () => {
    const out = cleanNameSet({
      en: "  Slope  of a line ",
      fr: "Pente <script>x</script>",
      xx: "unknown locale",
      es: 3,
      de: "y".repeat(200),
    });
    expect(out.en).toBe("Slope of a line");
    expect(out.fr).not.toMatch(/[<>]/);
    expect(out).not.toHaveProperty("xx");
    expect(out).not.toHaveProperty("es");
    expect(out.de).toHaveLength(80);
    expect(cleanNameSet(null)).toEqual({});
    expect(cleanNameSet(["en"])).toEqual({});
  });
});

// ---- the server loader ------------------------------------------------------

const db: { pages: unknown[][]; error: unknown; reads: number } = { pages: [], error: null, reads: 0 };

vi.mock("@/lib/supabase/admin", () => ({
  createKernelAdminClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (from: number) => {
            db.reads += 1;
            if (db.error) return { data: null, error: db.error };
            return { data: db.pages[from / 1000] ?? [], error: null };
          },
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/i18n/server", () => ({ getServerLocale: async () => "en" }));

async function freshLoader() {
  vi.resetModules();
  return import("@/lib/kernel/concept-names-server");
}

describe("the server's concept vocabulary", () => {
  beforeEach(() => {
    db.pages = [];
    db.error = null;
    db.reads = 0;
  });

  it("is read once and served from memory after", async () => {
    db.pages = [[{ label: "fonction_affine", display_names: { en: "Linear functions" } }]];
    const mod = await freshLoader();
    expect((await mod.loadConceptNames()).fonction_affine.en).toBe("Linear functions");
    await mod.loadConceptNames();
    expect(db.reads).toBe(1);
  });

  it("pages past the row cap instead of truncating", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ label: `c_${i}`, display_names: { en: `C ${i}` } }));
    db.pages = [full, [{ label: "last_one", display_names: { en: "Last one" } }]];
    const mod = await freshLoader();
    const names = await mod.loadConceptNames();
    expect(Object.keys(names)).toHaveLength(1001);
    expect(names.last_one.en).toBe("Last one");
  });

  it("degrades to readable labels when the column is not there yet", async () => {
    db.error = { message: 'column concept_nodes.display_names does not exist' };
    const mod = await freshLoader();
    expect(await mod.loadConceptNames()).toEqual({});
    const name = await mod.readerConceptNamer();
    expect(name("resoudre_equations_lineaires")).toBe("Resoudre equations lineaires");
  });
});
