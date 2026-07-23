import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderEmail, sendEmail } from "@/lib/email";

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
});

describe("sendEmail safety", () => {
  const OLD = process.env.RESEND_API_KEY;
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })))));
  afterEach(() => {
    vi.unstubAllGlobals();
    if (OLD === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = OLD;
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
});
