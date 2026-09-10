import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSyntheticEmail, hasRealEmail, SYNTHETIC_EMAIL_DOMAIN } from "@/lib/auth";

// These predicates are a security boundary: the synthetic recovery address of an
// email-less account must NEVER be treated as a real, deliverable, verified email.
describe("isSyntheticEmail", () => {
  it("flags the synthetic recovery domain (case-insensitive)", () => {
    expect(isSyntheticEmail(`anon-123@${SYNTHETIC_EMAIL_DOMAIN}`)).toBe(true);
    expect(isSyntheticEmail(`ANON-123@${SYNTHETIC_EMAIL_DOMAIN.toUpperCase()}`)).toBe(true);
  });
  it("does not flag real addresses or empties", () => {
    expect(isSyntheticEmail("teacher@school.com")).toBe(false);
    expect(isSyntheticEmail(null)).toBe(false);
    expect(isSyntheticEmail(undefined)).toBe(false);
    expect(isSyntheticEmail("")).toBe(false);
  });
});

describe("hasRealEmail", () => {
  it("is true only for a real, non-synthetic address", () => {
    expect(hasRealEmail("teacher@school.com")).toBe(true);
  });
  it("is false for synthetic, null, or empty", () => {
    expect(hasRealEmail(`anon-123@${SYNTHETIC_EMAIL_DOMAIN}`)).toBe(false);
    expect(hasRealEmail(null)).toBe(false);
    expect(hasRealEmail("")).toBe(false);
  });
});

/**
 * A Turnstile token is SINGLE-USE: whoever calls Cloudflare's siteverify first
 * redeems it, and the next caller gets `timeout-or-duplicate`. So exactly one
 * side may verify a given token, and which side that is depends on whether the
 * token is also handed to Supabase.
 *
 * This is asserted against the source rather than by running the routes,
 * because the failure it guards is a *shape* — one extra verifyTurnstile() call
 * added in good faith by someone hardening the endpoint — and because the bug
 * it fixes was invisible in production for as long as TURNSTILE_SECRET_KEY was
 * unset (verifyTurnstile returned false without ever calling Cloudflare, so the
 * token survived and only our own check failed). It only appears once the
 * secret is configured correctly, which is the worst time to find it.
 */
describe("a captcha token is redeemed exactly once", () => {
  /**
   * Comments stripped first: both routes EXPLAIN this rule in prose, naming
   * `verifyTurnstile()` in the very sentence that says why it isn't called
   * there. Asserting over the raw file would count the explanation as a
   * violation — and the fix for that would be to write a worse comment.
   */
  const read = (p: string) =>
    readFileSync(join(process.cwd(), p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("anonymous sign-in leaves the redemption to Supabase", () => {
    const src = read("app/api/auth/anon/route.ts");
    // It passes the token on, so it must not spend it first.
    expect(src).toContain("captchaToken: body.captchaToken");
    expect(src).not.toContain("verifyTurnstile(");
    // A missing token is still refused up front — that costs no redemption.
    expect(src).toContain("if (!body.captchaToken)");
  });

  it("recovery verifies only on the branch that hands the token to nobody", () => {
    const src = read("app/api/auth/recover/route.ts");
    // Exactly one verification, and it sits AFTER the magic-link branch has
    // returned — i.e. it only ever runs for a synthetic (email-less) account,
    // which nothing downstream would otherwise captcha-gate at all.
    expect(src.match(/verifyTurnstile\(/g)).toHaveLength(1);
    expect(src.indexOf("signInWithOtp")).toBeLessThan(src.indexOf("verifyTurnstile("));
    expect(src).toContain("mintSessionFor");
  });
});
