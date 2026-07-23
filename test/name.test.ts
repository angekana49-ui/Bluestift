import { describe, it, expect } from "vitest";
import { initialsOf, avatarInitials } from "@/lib/name";

describe("initialsOf", () => {
  it("pads a single name to two letters", () => {
    expect(initialsOf("James")).toBe("JA");
  });
  it("takes first + last initial for multiple words", () => {
    expect(initialsOf("Angelo Ryan Kana")).toBe("AK");
  });
  it("falls back to ME for empty/whitespace", () => {
    expect(initialsOf("   ")).toBe("ME");
    expect(initialsOf("")).toBe("ME");
  });
});

describe("avatarInitials", () => {
  it("gives one letter for a single name", () => {
    expect(avatarInitials("James")).toBe("J");
  });
  it("gives first+second initial for two+ words", () => {
    expect(avatarInitials("Angelo Ryan")).toBe("AR");
  });
  it("handles null/undefined/empty", () => {
    expect(avatarInitials(null)).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
    expect(avatarInitials("  ")).toBe("?");
  });
});
