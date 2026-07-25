import { describe, it, expect } from "vitest";
import { initialsOf, avatarInitials } from "@/lib/name";

describe("initialsOf", () => {
  it("is one letter for a single name (never padded)", () => {
    expect(initialsOf("Emma")).toBe("E");
    expect(initialsOf("James")).toBe("J");
  });
  it("is the first letter of each word, two words max", () => {
    expect(initialsOf("Emma Lila")).toBe("EL");
    expect(initialsOf("Angelo Ryan Kana")).toBe("AR");
  });
  it("falls back to ME for empty/whitespace", () => {
    expect(initialsOf("   ")).toBe("ME");
    expect(initialsOf("")).toBe("ME");
  });
});

describe("avatarInitials", () => {
  it("is one letter for a single name", () => {
    expect(avatarInitials("Emma")).toBe("E");
    expect(avatarInitials("James")).toBe("J");
  });
  it("is the first letter of each word, two words max", () => {
    expect(avatarInitials("Emma Lila")).toBe("EL");
    expect(avatarInitials("Angelo Ryan Kana")).toBe("AR");
  });
  it("handles null/undefined/empty", () => {
    expect(avatarInitials(null)).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
    expect(avatarInitials("  ")).toBe("?");
  });
});
