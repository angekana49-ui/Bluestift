import { describe, it, expect } from "vitest";
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
