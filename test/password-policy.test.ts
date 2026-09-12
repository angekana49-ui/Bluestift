import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, isAcceptablePassword, passwordProblem } from "@/lib/password";
import { en } from "@/lib/i18n/en";

/**
 * The client-side password rules. They are a courtesy rather than a control —
 * Supabase enforces its own floor server-side — so what these tests protect is
 * the part a user actually experiences: a specific sentence, in their language,
 * before the request goes out.
 */
describe("passwordProblem", () => {
  it("accepts an ordinary, unremarkable password", () => {
    expect(passwordProblem("Correct horse battery 9")).toBeNull();
    expect(passwordProblem("Mangue-45-bleue")).toBeNull();
    expect(isAcceptablePassword("Mangue-45-bleue")).toBe(true);
  });

  it("rejects anything under the length floor, and nothing at it", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe("pw.err.short");
    // Exactly at the floor the LENGTH rule is satisfied; "aaaaaaaa" then fails
    // the repeated-character rule instead, which is the point of having both.
    expect(passwordProblem("Abcd1234")).toBeNull();
  });

  it("requires what the Supabase project requires: a lowercase, a capital, a digit", () => {
    // Anything this passes and Supabase refuses comes back as a raw English
    // error — the exact failure this module exists to prevent.
    for (const p of ["mangue-45-bleue", "MANGUE-45-BLEUE", "Mangue-bleue", "correct horse battery"]) {
      expect(passwordProblem(p), p).toBe("pw.err.mix");
    }
    // No symbol quota.
    expect(passwordProblem("Mangue45bleue")).toBeNull();
  });

  it("rejects the passwords tried first", () => {
    for (const p of ["password", "12345678", "qwertyui", "bluestift", "PASSWORD"]) {
      expect(passwordProblem(p), p).toBe("pw.err.common");
    }
  });

  it("rejects one character repeated, which the length rule alone lets through", () => {
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("pw.err.common");
    expect(passwordProblem("11111111")).toBe("pw.err.common");
  });

  it("refuses the address the password is meant to protect", () => {
    expect(passwordProblem("ada@school.org", "ada@school.org")).toBe("pw.err.sameAsEmail");
    expect(passwordProblem("ADA@SCHOOL.ORG", "ada@school.org")).toBe("pw.err.sameAsEmail");
    // …and the local part on its own, which is what people actually type.
    expect(passwordProblem("adalovelace", "adalovelace@school.org")).toBe("pw.err.sameAsEmail");
  });

  it("does not read a short local part as the whole password", () => {
    // `jo@x.com` — refusing every password containing "jo" would be absurd, so
    // the local-part rule only applies from three characters up.
    expect(passwordProblem("Jonquille22", "jo@x.com")).toBeNull();
  });

  it("checks length before anything else, so the first message is the useful one", () => {
    // "password" is both too short-ish and obvious; the actionable instruction
    // is the one about length, because it is the one the user can satisfy by
    // typing more rather than by starting over.
    expect(passwordProblem("pass")).toBe("pw.err.short");
  });

  it("only ever returns keys the English catalogue can render", () => {
    // A MessageKey with no entry renders as the raw key at the user. The type
    // system allows any MessageKey here; only this asserts the ones we use
    // exist — including in the locale every other locale falls back to.
    const emitted = [
      passwordProblem("short"),
      passwordProblem("password"),
      passwordProblem("ada@school.org", "ada@school.org"),
      passwordProblem("mangue-45-bleue"),
    ];
    for (const key of emitted) {
      expect(key).not.toBeNull();
      expect(typeof en[key!], String(key)).toBe("string");
      expect(en[key!].length).toBeGreaterThan(0);
    }
  });
});
