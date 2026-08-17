import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import type { MetadataRoute } from "next";
import manifest from "@/app/manifest";
import { GET as rayaManifestRoute } from "@/app/raya-manifest/route";
import { startupImages, rayaStartupImages } from "@/lib/launch-screens";
import { THEME_COLOR_LIGHT, THEME_COLOR_DARK } from "@/lib/theme-color";

/**
 * A manifest is a set of string literals pointing at binary files, which is the
 * same failure shape test/brand-assets.test.ts exists for: TypeScript never
 * checks "/icon-512.png", and a wrong or missing icon does not throw — the
 * install silently falls back to a generic glyph, on a device nobody is testing
 * on. Worse, sizes are declared separately from the files, so an icon
 * regenerated at the wrong dimensions stays "valid" while being wrong.
 *
 * Everything here is checked against the bytes on disk rather than against the
 * declaration, and both installable apps go through the same assertions.
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

function hasNoAlpha(file: string, label: string) {
  const meta = png(join(PUBLIC, file));
  expect(meta.colorType, `${label} has an alpha channel`).not.toBe(6);
  expect(meta.colorType, `${label} has an alpha channel`).not.toBe(4);
  return meta;
}

/**
 * The two installable apps. Raya is separate because an installed app has one
 * identity — one name, one icon, one launch screen — and iOS picks a launch
 * image by device geometry alone, never by route, so one manifest could only
 * ever have one launch screen.
 */
const APPS: {
  label: string;
  manifest: () => Promise<MetadataRoute.Manifest> | MetadataRoute.Manifest;
  appleTouchIcon: string;
  startup: typeof startupImages;
  launchPrefix: string;
  startUrl: string;
}[] = [
  {
    label: "Bluestift",
    manifest: () => manifest(),
    appleTouchIcon: "apple-touch-icon.png",
    startup: startupImages,
    launchPrefix: "launch",
    startUrl: "/login",
  },
  {
    label: "Raya",
    manifest: async () => (await rayaManifestRoute().json()) as MetadataRoute.Manifest,
    appleTouchIcon: "apple-touch-icon-raya.png",
    startup: rayaStartupImages,
    launchPrefix: "launch-raya",
    startUrl: "/chat",
  },
];

describe.each(APPS)("PWA manifest — $label", (app) => {
  it("points every icon at a file that exists, at the size it claims", async () => {
    const m = await app.manifest();
    // Guard the guard: an empty icon list would satisfy every assertion below.
    expect(m.icons?.length).toBeGreaterThanOrEqual(3);

    for (const icon of m.icons ?? []) {
      const file = join(PUBLIC, icon.src);
      expect(existsSync(file), `${icon.src} is declared but missing`).toBe(true);

      const [w, h] = String(icon.sizes).split("x").map(Number);
      const meta = png(file);
      expect([meta.width, meta.height], `${icon.src} is ${meta.width}x${meta.height}`).toEqual([w, h]);
      // Near the 2G/3G budget the brand marks are held to (20 KB). A little
      // above it, because the Raya rosace carries more line work than the bird
      // and its 512 lands at ~21 KB.
      expect(meta.kb, `${icon.src} is ${meta.kb.toFixed(1)} KB`).toBeLessThan(25);
    }
  });

  it("ships a maskable icon, and it is opaque to the corners", async () => {
    const m = await app.manifest();
    const maskable = (m.icons ?? []).filter((i) => String(i.purpose).includes("maskable"));
    // Without one, Android draws our square icon inside its own white circle —
    // the "looks unfinished" outcome the manifest was added to fix.
    expect(maskable.length, "no maskable icon").toBeGreaterThanOrEqual(1);

    for (const icon of maskable) {
      // A maskable icon is cropped to a platform shape. Any transparency in it
      // is cropped to transparent corners, which is worse than not shipping one.
      const meta = hasNoAlpha(icon.src, icon.src);
      // Android guarantees only a centred circle of 80% diameter, so a maskable
      // icon has to be at least 192 to leave usable artwork after the crop.
      expect(meta.width).toBeGreaterThanOrEqual(192);
    }
  });

  it("ships an apple-touch-icon with no transparency at all", () => {
    // Safari does not read the manifest's icons for the home screen, so this
    // file is the only thing standing between an iPhone and a generic glyph —
    // and, for Raya, between it and the Bluestift bird.
    const file = join(PUBLIC, app.appleTouchIcon);
    expect(existsSync(file), `${app.appleTouchIcon} is missing`).toBe(true);

    // iOS composites a transparent icon onto BLACK rather than onto the icon's
    // own background, so alpha here shows up as a dark halo on the home screen.
    const meta = hasNoAlpha(app.appleTouchIcon, app.appleTouchIcon);
    expect([meta.width, meta.height]).toEqual([180, 180]);
    expect(meta.hasTrns, `${app.appleTouchIcon} carries a tRNS chunk`).toBe(false);
  });

  it("launches standalone, at the URL this app is for, inside its scope", async () => {
    const m = await app.manifest();
    // A start_url outside scope launches the browser instead of the app.
    expect(m.start_url?.startsWith(m.scope ?? "/")).toBe(true);
    expect(m.start_url).toBe(app.startUrl);
    // display:standalone is the entire point — browser tab chrome is what
    // installing removes.
    expect(m.display).toBe("standalone");
  });

  it("agrees with the theme-color the document declares", async () => {
    const m = await app.manifest();
    // A manifest colour cannot follow the dark toggle (see lib/theme-color), so
    // it must be the light one — which is also the first paint, because both dark
    // hooks render light before reading localStorage. It is additionally the top
    // of the gradient the launch screens open on.
    expect(m.theme_color).toBe(THEME_COLOR_LIGHT);
    expect(m.background_color).toBe(THEME_COLOR_LIGHT);
    expect(THEME_COLOR_DARK).not.toBe(THEME_COLOR_LIGHT);
  });

  /**
   * The geometries exist twice: as a list in lib/launch-screens.ts and as files
   * rendered by scripts/render-launch-screens.mjs from its own copy. iOS matches
   * on EXACT device metrics, so a mismatch is not a degraded launch screen — it
   * is no launch screen, and a blank white screen on open. Neither half can see
   * the other, so both directions get checked.
   */
  describe("iOS launch screens", () => {
    it("declares one per geometry, each resolving to a file of exactly that size", () => {
      expect(app.startup.length).toBeGreaterThanOrEqual(8);

      for (const { url, media } of app.startup) {
        const file = join(PUBLIC, url);
        expect(existsSync(file), `${url} is declared but missing`).toBe(true);

        // The media query and the filename encode the same geometry by two
        // different routes; if they disagree, iOS matches the query and then
        // paints an image of the wrong size.
        const w = Number(media.match(/device-width: (\d+)px/)?.[1]);
        const h = Number(media.match(/device-height: (\d+)px/)?.[1]);
        const ratio = Number(media.match(/-webkit-device-pixel-ratio: (\d+)/)?.[1]);
        expect([w, h, ratio].some(Number.isNaN), `unparseable media: ${media}`).toBe(false);

        const meta = png(file);
        expect([meta.width, meta.height], `${url} vs its media query`).toEqual([w * ratio, h * ratio]);
        // Portrait, as the query claims.
        expect(meta.height).toBeGreaterThan(meta.width);
      }
    });

    it("leaves no generated launch screen undeclared", () => {
      // The other direction: a file rendered under a name nothing points at is
      // dead weight in /public, and the geometry it was meant for silently has
      // no image. Anchored on the exact prefix so the two apps' sets don't
      // count each other — "launch-1170x2532" must not match "launch-raya-".
      const onDisk = readdirSync(PUBLIC).filter((f) =>
        new RegExp(`^${app.launchPrefix}-\\d+x\\d+\\.png$`).test(f),
      );
      const declared = new Set(app.startup.map((i) => i.url.replace("/", "")));
      expect(onDisk.length).toBe(app.startup.length);
      expect(onDisk.filter((f) => !declared.has(f))).toEqual([]);
    });

    it("keeps each launch screen affordable on a metered connection", () => {
      // A phone downloads exactly one of these, so the per-file size is what
      // matters rather than the total.
      for (const { url } of app.startup) {
        const kb = png(join(PUBLIC, url)).kb;
        expect(kb, `${url} is ${kb.toFixed(1)} KB`).toBeLessThan(50);
      }
    });
  });
});

describe("PWA assets", () => {
  it("gives the two apps different identities", async () => {
    const [bluestift, raya] = await Promise.all(APPS.map((a) => a.manifest()));
    // Two apps sharing a name, id or icon set would install over each other —
    // and the point of splitting them was that a student installs Raya while a
    // school installs Bluestift.
    expect(raya.name).not.toBe(bluestift.name);
    expect(raya.id).not.toBe(bluestift.id);
    expect(raya.start_url).not.toBe(bluestift.start_url);
    const srcs = (m: MetadataRoute.Manifest) => (m.icons ?? []).map((i) => i.src).join();
    expect(srcs(raya)).not.toBe(srcs(bluestift));
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
