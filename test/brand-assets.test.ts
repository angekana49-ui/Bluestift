import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { DOC_BRANDS } from "@/lib/doc-format";

/**
 * The brand marks are referenced by literal path from a dozen surfaces, so a
 * renamed or regenerated file breaks silently: TypeScript never sees a string
 * like "/raya-mark.png", and a 404'd <img> just renders nothing. This suite is
 * the only thing that connects the two sides.
 */

const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const SCAN = ["app", "components", "lib"];
const SOURCE_EXT = new Set([".ts", ".tsx"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (SOURCE_EXT.has(extname(entry.name))) out.push(full);
  }
  return out;
}

const FILES = SCAN.flatMap((d) => sourceFiles(join(ROOT, d)));

/** Every "/something-mark[-variant].png" literal appearing in app source. */
function referencedMarks(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of FILES) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/["'](\/[a-z0-9-]*mark[a-z0-9-]*\.png)["']/g)) {
      const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
      found.set(m[1], [...(found.get(m[1]) ?? []), rel]);
    }
  }
  return found;
}

describe("brand marks", () => {
  it("every mark referenced in app source exists in /public", () => {
    const refs = referencedMarks();
    // Guard the guard: if the regex ever stops matching, the suite would pass
    // vacuously and we'd learn nothing.
    expect(refs.size).toBeGreaterThan(3);

    const missing = [...refs.entries()]
      .filter(([path]) => !existsSync(join(PUBLIC, path)))
      .map(([path, users]) => `${path} (used by ${users.join(", ")})`);
    expect(missing).toEqual([]);
  });

  it("each light mark has the dark variant the themed surfaces need", () => {
    // A transparent light mark (blue/black artwork) vanishes on a dark surface,
    // so the -dark counterpart must exist for every base mark we ship.
    for (const base of ["bluestift-mark", "raya-mark"]) {
      expect(existsSync(join(PUBLIC, `${base}.png`)), `${base}.png`).toBe(true);
      expect(existsSync(join(PUBLIC, `${base}-dark.png`)), `${base}-dark.png`).toBe(true);
    }
  });

  it("keeps the marks small enough for a 2G/3G first paint", () => {
    // They are quantised by scripts/process-logos.py; skipping that step ships
    // them at ~4x weight, which is exactly the regression worth catching.
    for (const name of readdirSync(PUBLIC).filter((f) => /mark.*\.png$/.test(f))) {
      const kb = statSync(join(PUBLIC, name)).size / 1024;
      expect(kb, `${name} is ${kb.toFixed(1)} KB`).toBeLessThan(20);
    }
  });

  it("exported documents point at a logo that exists", () => {
    for (const brand of Object.values(DOC_BRANDS)) {
      expect(existsSync(join(PUBLIC, brand.logo)), brand.logo).toBe(true);
      expect(brand.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the raw logo sources out of /public, which is served publicly", () => {
    expect(existsSync(join(PUBLIC, "logos"))).toBe(false);
  });
});
