import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIND_MAP_PROMPT, mindMapToMd, normalizeMindMap } from "@/lib/mind-map";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8").replace(/\r/g, "");

/** Owner, 2026-10-06: "trop courte, assez peu illustrative, assez peu de steps". */
describe("the mind map", () => {
  it("asks for more steps, a picture each, and points that teach", () => {
    expect(MIND_MAP_PROMPT).toContain("6 to 9 main branches");
    expect(MIND_MAP_PROMPT).toContain("ONE emoji");
    expect(MIND_MAP_PROMPT).toContain("a detail");
    expect(read("app/api/tools/generate/route.ts")).toContain("generateJson(MIND_MAP_PROMPT + extra, source, 8192)");
  });

  it("reads the new shape, keeping only a real emoji", () => {
    const m = normalizeMindMap({
      title: "Photosynthèse",
      overview: "Comment une plante fabrique sa matière.",
      branches: [
        { label: "Lumière", emoji: "☀️", gist: "L'énergie.", children: [{ label: "Chlorophylle", detail: "Pigment vert qui capte la lumière." }] },
        { label: "Eau", emoji: "water", children: [{ label: "Racines" }, 3, null] },
      ],
    });
    expect(m.overview).toContain("plante");
    expect(m.branches[0]).toMatchObject({ emoji: "☀️", gist: "L'énergie.", children: [{ label: "Chlorophylle", detail: "Pigment vert qui capte la lumière." }] });
    expect(m.branches[1].emoji).toBeUndefined();
    expect(m.branches[1].children).toEqual([{ label: "Racines", detail: undefined }]);
  });

  it("still opens a map stored before, with bare string points", () => {
    const m = normalizeMindMap({ branches: [{ label: "A", children: ["un", "deux"] }] }, "Titre");
    expect(m).toEqual({ title: "Titre", overview: undefined, branches: [{ label: "A", emoji: undefined, gist: undefined, children: [{ label: "un" }, { label: "deux" }] }] });
  });

  it("exports every step with its points' details", () => {
    const md = mindMapToMd(normalizeMindMap({ title: "T", branches: [{ label: "A", emoji: "🔬", children: [{ label: "x", detail: "y" }] }] }));
    expect(md).toContain("## 1. 🔬 A");
    expect(md).toContain("- **x** — y");
  });

  it("is a list of steps on a phone, not a canvas to pan", () => {
    const player = read("components/study/focus-player.tsx");
    expect(player).toContain("<div ref={viewRef}>{narrow ? phone() : canvas()}</div>");
    expect(player).toContain('aria-expanded={isOpen}');
  });
});
