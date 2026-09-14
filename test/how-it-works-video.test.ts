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
    // Served straight from public/ to every visitor who presses play, often on
    // a phone plan: a master-quality export dropped in by mistake shows up here.
    expect(statSync(join(ROOT, "public/video/how-it-works-en.mp4")).size).toBeLessThan(20 * 1024 * 1024);
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
