import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scrubPath, scrubQuery, scrubUrl } from "@/lib/analytics/scrub-url";

/**
 * Page views must not carry credentials.
 *
 * Two URLs in this app are bearer capabilities — the share link and the private
 * room link — so a `$current_url` sent verbatim would put "anyone at the
 * analytics provider can open a child's shared work" one data export away.
 * These tests hold the shape of what leaves the browser.
 */
describe("scrubPath", () => {
  it("keeps a static route exactly as it is", () => {
    expect(scrubPath("/")).toBe("/");
    expect(scrubPath("/pricing")).toBe("/pricing");
    expect(scrubPath("/school/team")).toBe("/school/team");
    expect(scrubPath("/onboarding")).toBe("/onboarding");
  });

  it("reduces a private room's id — the id IS the invitation", () => {
    expect(scrubPath("/rooms/1f0e5c62-9a3b-4d21-8c77-2b9a4f7d1e00")).toBe("/rooms/[id]");
  });

  it("reduces a share token — the token IS the credential", () => {
    expect(scrubPath("/s/hK3xQ8bTz1Rm")).toBe("/s/[token]");
    // Short and all-lowercase: still a token, because /s/ is named, not matched.
    expect(scrubPath("/s/abcdef")).toBe("/s/[token]");
  });

  it("reduces ids in the middle and at the end of a path", () => {
    expect(scrubPath("/chat/1f0e5c62-9a3b-4d21-8c77-2b9a4f7d1e00/notes")).toBe("/chat/[id]/notes");
  });
});

describe("scrubQuery", () => {
  it("drops what identifies a person or a payment", () => {
    expect(scrubQuery("?pid=1f0e5c62-9a3b-4d21-8c77-2b9a4f7d1e00")).toBe("");
    expect(scrubQuery("?token_hash=abc123&type=magiclink")).toBe("");
    expect(scrubQuery("?code=7KFM9QRT")).toBe("");
    expect(scrubQuery("?userId=x&classId=y")).toBe("");
  });

  it("keeps the keys that describe a page or a campaign, never a visitor", () => {
    expect(scrubQuery("?tab=lms")).toBe("?tab=lms");
    expect(scrubQuery("?utm_source=hn&utm_campaign=launch")).toContain("utm_source=hn");
    expect(scrubQuery("?tab=lms&pid=secret")).toBe("?tab=lms");
  });

  it("is empty for an empty query", () => {
    expect(scrubQuery("")).toBe("");
  });
});

describe("scrubUrl", () => {
  it("keeps the origin — it says which product, and identifies nobody", () => {
    expect(scrubUrl("https://raya.thebluestift.com", "/s/hK3xQ8bTz1Rm", "?ref=x")).toBe(
      "https://raya.thebluestift.com/s/[token]?ref=x",
    );
  });
});

/**
 * The SDK settings these tests exist to protect. Both are one word away from
 * silently undoing the work above, and neither failure would be visible.
 */
describe("the PostHog SDK is initialised with the privacy settings", () => {
  const lazy = readFileSync(join(process.cwd(), "lib/analytics/posthog-lazy.ts"), "utf8");

  it("does not autocapture — clicked element text is a child's message", () => {
    expect(lazy).toContain("autocapture: false");
    expect(lazy).not.toContain("autocapture: true");
  });

  it("rewrites location properties on EVERY event, not just our own pageview", () => {
    expect(lazy).toContain("sanitize_properties");
    expect(lazy).toContain("$current_url");
    expect(lazy).toContain("$referrer");
  });

  it("still keeps session recording off", () => {
    expect(lazy).toContain("disable_session_recording: true");
  });
});
