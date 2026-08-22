import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderEmail, sendEmail, siteUrl } from "@/lib/email";

describe("renderEmail", () => {
  it("renders heading, paragraphs, and an optional CTA button", () => {
    const { html, text } = renderEmail({
      heading: "You've joined Lincoln High",
      lines: ["Line one.", "Line two."],
      cta: { label: "Open dashboard", url: "https://app.example/school" },
    });
    expect(html).toContain("You've joined Lincoln High"); // heading present
    expect(html).toContain("Line one.");
    expect(html).toContain("Line two.");
    expect(html).toContain("https://app.example/school");
    expect(html).toContain("Open dashboard");
    // Plain-text fallback carries the same content.
    expect(text).toContain("Line one.");
    expect(text).toContain("Open dashboard: https://app.example/school");
  });

  it("escapes HTML in user-supplied content (no injection)", () => {
    const { html } = renderEmail({ heading: "Hi", lines: ["<script>alert(1)</script> & <b>x</b>"] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("carries the parent Bluestift wordmark (not the old RAYA), plus a product tag", () => {
    const parent = renderEmail({ heading: "Hi", lines: ["x"] });
    expect(parent.html).toContain("Bluestift");
    expect(parent.html).not.toContain("RAYA");

    const schools = renderEmail({ brand: "schools", heading: "Hi", lines: ["x"] });
    expect(schools.html).toContain("Bluestift");
    expect(schools.html).toContain("Schools");

    const raya = renderEmail({ brand: "raya", heading: "Hi", lines: ["x"] });
    expect(raya.html).toContain("Raya");
  });
});

describe("sendEmail safety", () => {
  const OLD = process.env.RESEND_API_KEY;
  const OLD_FROM = process.env.EMAIL_FROM;
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })))));
  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = OLD;
    if (OLD_FROM === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = OLD_FROM;
  });

  it("is a no-op (skipped) when RESEND_API_KEY is unset — never calls the network", async () => {
    delete process.env.RESEND_API_KEY;
    const r = await sendEmail({ to: "teacher@school.com", subject: "hi", html: "<p>hi</p>" });
    expect(r.skipped).toBe(true);
    expect(r.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never sends to a synthetic recovery address, even when configured", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const r = await sendEmail({ to: "anon-1@anon.bluestift.local", subject: "hi", html: "<p>hi</p>" });
    expect(r.skipped).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends via Resend for a real address when configured", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const r = await sendEmail({ to: "teacher@school.com", subject: "hi", html: "<p>hi</p>" });
    expect(r.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
  });

  it("stamps the product-specific From display name (same verified address)", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Whatever <no-reply@bluestift.com>";
    await sendEmail({ to: "teacher@school.com", subject: "hi", html: "<p>hi</p>", brand: "schools" });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.from).toBe("Bluestift Schools <no-reply@bluestift.com>");
  });
});

/**
 * Link origins are per SURFACE, ready for the site / raya. / schools. split
 * (docs/domains.md). The property that matters most is the LAST one: with the
 * product vars unset — today, on a single origin — no caller's link changes.
 */
describe("siteUrl", () => {
  const VARS = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_RAYA_URL", "NEXT_PUBLIC_SCHOOLS_URL"] as const;
  const SURFACES = ["bluestift", "raya", "schools"] as const;

  beforeEach(() => VARS.forEach((v) => delete process.env[v]));
  afterEach(() => VARS.forEach((v) => delete process.env[v]));

  it("sends each surface to its own origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://thebluestift.com";
    process.env.NEXT_PUBLIC_RAYA_URL = "https://raya.thebluestift.com";
    process.env.NEXT_PUBLIC_SCHOOLS_URL = "https://schools.thebluestift.com";
    expect(siteUrl("bluestift")).toBe("https://thebluestift.com");
    expect(siteUrl("raya")).toBe("https://raya.thebluestift.com");
    expect(siteUrl("schools")).toBe("https://schools.thebluestift.com");
  });

  it("gives every surface the same origin while the product vars are unset", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://thebluestift.com";
    const urls = SURFACES.map((s) => siteUrl(s));
    expect(new Set(urls).size).toBe(1);
    expect(urls[0]).toBe("https://thebluestift.com");
  });

  it("falls back per surface, so one origin can move before the other", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://thebluestift.com";
    process.env.NEXT_PUBLIC_SCHOOLS_URL = "https://schools.thebluestift.com";
    expect(siteUrl("schools")).toBe("https://schools.thebluestift.com");
    expect(siteUrl("raya")).toBe("https://thebluestift.com");
  });

  it("drops a trailing slash on every surface, so callers can append a path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://thebluestift.com/";
    process.env.NEXT_PUBLIC_RAYA_URL = "https://raya.thebluestift.com/";
    expect(`${siteUrl("bluestift")}/s/abc`).toBe("https://thebluestift.com/s/abc");
    expect(`${siteUrl("raya")}/chat`).toBe("https://raya.thebluestift.com/chat");
  });

  it("never yields an empty origin when nothing is configured", () => {
    for (const s of SURFACES) expect(siteUrl(s)).toMatch(/^https:\/\/\S+$/);
  });
});
