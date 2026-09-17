import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The hero's "See how it works" plays the explainer rendered from video/.
 *
 * What would break quietly: a missing file (the dialog opens on a black box),
 * a video that loads for every visitor instead of the ones who press play, and
 * a link that stops working without JavaScript.
 */
const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

describe("how it works video", () => {
  const component = read("components/site/HowItWorksVideo.tsx");
  const hero = read("components/site/HeroSection.tsx");

  it("ships the files the dialog points at", () => {
    for (const [constant, path] of component.matchAll(/export const (HOW_IT_WORKS_\w+) = "([^"]+)"/g).map((m) => [m[1], m[2]])) {
      expect(existsSync(join(ROOT, "public", path)), `${constant}: public${path}`).toBe(true);
    }
    // The film ships in the repo at full quality, which git keeps for good and
    // GitHub refuses outright over 100 MiB — a push that hits that limit is a
    // history to rewrite, not a file to shrink. The ceiling is here, below it.
    expect(statSync(join(ROOT, "public/video/how-it-works-en-v2.mp4")).size).toBeLessThan(95 * 1024 * 1024);
  });

  it("caches the film for a year, under a versioned name", () => {
    // The two halves of one decision: bytes that never change behind a URL,
    // and a URL that changes when the bytes do.
    const config = read("next.config.ts");
    expect(config).toContain('source: "/video/:file*"');
    expect(config).toContain("public, max-age=31536000, immutable");
    for (const [, path] of component.matchAll(/export const HOW_IT_WORKS_\w+ = "([^"]+)"/g)) {
      expect(path, `${path} is cached forever, so it must carry a version`).toMatch(/-v\d+\.\w+$/);
    }
  });

  it("offers the narration as captions", () => {
    // Burnt-in captions went with the first cut; the film is narrated now, so
    // the text is a track anyone can turn on — and nobody has to.
    expect(component).toContain('<track kind="captions"');
    expect(component).toContain("srcLang=\"en\"");
    expect(component).not.toContain("<track kind=\"captions\" default");
    const vtt = read("public/video/how-it-works-en-v2.vtt");
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("-->");
  });

  it("mounts the video only while the dialog is open", () => {
    expect(component).toMatch(/\{open && \(/);
    // The JSX element, not the word in the doc comment above it.
    const videoTag = component.search(/^\s*<video$/m);
    expect(videoTag).toBeGreaterThan(-1);
    expect(component.indexOf("{open && (")).toBeLessThan(videoTag);
  });

  it("is a native modal dialog with a labelled close", () => {
    expect(component).toContain("showModal()");
    expect(component).toContain('aria-label={tr("site.hero.videoClose")}');
  });

  it("keeps the button a real link to the section", () => {
    expect(hero).toContain('href="#how-it-works"');
    expect(hero).toMatch(/e\.metaKey \|\| e\.ctrlKey/);
    expect(hero).toContain("<HowItWorksVideo");
    expect(read("components/site/ConnectionSection.tsx")).toContain('id="how-it-works"');
  });

  it("stays within the media policy", () => {
    // Same-origin media only; a CDN URL here would be refused by the CSP.
    expect(read("lib/security/csp.ts")).toContain("media-src 'self'");
    expect(component).not.toMatch(/src=\{?"https?:/);
  });
});
