import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import manifest from "@/app/manifest";
import { THEME_COLOR_LIGHT, THEME_COLOR_DARK } from "@/lib/theme-color";

/**
 * The manifest is a set of string literals pointing at binary files, which is
 * the same failure shape test/brand-assets.test.ts exists for: TypeScript never
 * checks "/icon-512.png", and a wrong or missing icon does not throw — the
 * install just silently falls back to a generic glyph, on a device nobody is
 * testing on. Worse, the sizes are declared separately from the files, so an
 * icon regenerated at the wrong dimensions stays "valid" while being wrong.
 *
 * Everything here is checked against the bytes on disk rather than against the
 * declaration.
 */

const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");

/** Width, height, colour type and tRNS presence, straight out of the PNG. */
function png(file: string) {
  const buf = readFileSync(file);
  expect(buf.subarray(1, 4).toString("ascii"), `${file} is not a PNG`).toBe("PNG");
  // IHDR is always the first chunk: length+type occupy bytes 8..16, then the
  // fields. Colour types 4 and 6 carry an alpha channel; a palette image (3)
  // carries transparency only if a tRNS chunk is present.
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
    hasTrns: buf.includes(Buffer.from("tRNS", "ascii")),
    kb: statSync(file).size / 1024,
  };
}

describe("PWA manifest", () => {
  const m = manifest();

  it("points every icon at a file that exists, at the size it claims", () => {
    // Guard the guard: an empty icon list would satisfy every assertion below.
    expect(m.icons?.length).toBeGreaterThanOrEqual(3);

    for (const icon of m.icons ?? []) {
      const file = join(PUBLIC, icon.src);
      expect(existsSync(file), `${icon.src} is declared but missing`).toBe(true);

      const [w, h] = String(icon.sizes).split("x").map(Number);
      const meta = png(file);
      expect([meta.width, meta.height], `${icon.src} is ${meta.width}x${meta.height}`).toEqual([w, h]);
      // Same 2G/3G budget the brand marks are held to.
      expect(meta.kb, `${icon.src} is ${meta.kb.toFixed(1)} KB`).toBeLessThan(20);
    }
  });

  it("ships a maskable icon, and it is opaque to the corners", () => {
    const maskable = (m.icons ?? []).filter((i) => String(i.purpose).includes("maskable"));
    // Without one, Android draws our square icon inside its own white circle —
    // the "looks unfinished" outcome the manifest was added to fix.
    expect(maskable.length, "no maskable icon").toBeGreaterThanOrEqual(1);

    for (const icon of maskable) {
      const meta = png(join(PUBLIC, icon.src));
      // A maskable icon is cropped to a platform shape. Any transparency in it
      // is cropped to transparent corners, which is worse than not shipping one.
      expect(meta.colorType, `${icon.src} has an alpha channel`).not.toBe(6);
      expect(meta.colorType, `${icon.src} has an alpha channel`).not.toBe(4);
      // Android guarantees only a centred circle of 80% diameter, so a maskable
      // icon has to be at least 192 to leave usable artwork after the crop.
      expect(meta.width).toBeGreaterThanOrEqual(192);
    }
  });

  it("ships an apple-touch-icon with no transparency at all", () => {
    // Safari does not read the manifest's icons for the home screen, so this
    // file is the only thing standing between an iPhone and a generic glyph.
    const file = join(PUBLIC, "apple-touch-icon.png");
    expect(existsSync(file), "apple-touch-icon.png is missing").toBe(true);

    const meta = png(file);
    expect([meta.width, meta.height]).toEqual([180, 180]);
    // iOS composites a transparent icon onto BLACK rather than onto the icon's
    // own background, so alpha here shows up as a dark halo on the home screen.
    expect(meta.colorType, "apple-touch-icon has an alpha channel").not.toBe(6);
    expect(meta.colorType, "apple-touch-icon has an alpha channel").not.toBe(4);
    expect(meta.hasTrns, "apple-touch-icon carries a tRNS chunk").toBe(false);
  });

  it("keeps start_url inside scope, so the installed app stays installed", () => {
    // A start_url outside scope launches the browser instead of the app.
    expect(m.start_url?.startsWith(m.scope ?? "/")).toBe(true);
    // display:standalone is the entire point — browser tab chrome is what
    // installing removes.
    expect(m.display).toBe("standalone");
  });

  it("agrees with the theme-color the document declares", () => {
    // The manifest colour cannot follow the dark toggle (see lib/theme-color),
    // so it must be the light one — which is also the first paint, because both
    // dark hooks render light before reading localStorage.
    expect(m.theme_color).toBe(THEME_COLOR_LIGHT);
    expect(m.background_color).toBe(THEME_COLOR_LIGHT);
    expect(THEME_COLOR_DARK).not.toBe(THEME_COLOR_LIGHT);
  });

  it("bumps the service worker whenever the icons change", () => {
    // sw.js caches /public images cache-first with no revalidation, so an icon
    // that keeps its filename is served from the old cache forever — including
    // to an already-installed home screen. scripts/process-logos.py says to bump
    // VERSION; this is that instruction, enforced.
    const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");
    const version = sw.match(/const VERSION = "(v\d+)"/)?.[1];
    expect(version, "sw.js VERSION not found").toBeDefined();
    expect(Number(version!.slice(1)), "sw.js VERSION never bumped for the icons").toBeGreaterThanOrEqual(3);
  });
});
