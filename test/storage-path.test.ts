import { describe, it, expect } from "vitest";
import { isOwnedStoragePath } from "@/lib/storage-path";

/**
 * /api/files/signed-url will mint a signed URL for any key this predicate
 * accepts. Everything below is an access-control assertion, not a formatting
 * one: a false positive hands one student a link to another's uploaded work.
 */
const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
// Built, not typed literally: a raw NUL in a source file is invisible in every
// editor and easy to "clean up" by accident.
const NUL = String.fromCharCode(0);

describe("isOwnedStoragePath", () => {
  it("accepts keys inside the caller's own folder", () => {
    expect(isOwnedStoragePath(`${ME}/notes.pdf`, ME)).toBe(true);
    expect(isOwnedStoragePath(`${ME}/2026/term1/essay.docx`, ME)).toBe(true);
    // Dots inside a name are fine — only a whole ".." segment is a traversal.
    expect(isOwnedStoragePath(`${ME}/my..notes.pdf`, ME)).toBe(true);
    expect(isOwnedStoragePath(`${ME}/..hidden`, ME)).toBe(true);
  });

  it("rejects another user's folder", () => {
    expect(isOwnedStoragePath(`${OTHER}/notes.pdf`, ME)).toBe(false);
    // A prefix that merely starts with the id must not pass as the folder.
    expect(isOwnedStoragePath(`${ME}-evil/notes.pdf`, ME)).toBe(false);
    expect(isOwnedStoragePath(ME, ME)).toBe(false);
  });

  it("rejects traversal out of the folder — the bug a prefix check misses", () => {
    expect(isOwnedStoragePath(`${ME}/../${OTHER}/notes.pdf`, ME)).toBe(false);
    expect(isOwnedStoragePath(`${ME}/a/../../${OTHER}/notes.pdf`, ME)).toBe(false);
    expect(isOwnedStoragePath(`${ME}/..`, ME)).toBe(false);
    expect(isOwnedStoragePath(`${ME}/./notes.pdf`, ME)).toBe(false);
  });

  it("rejects separators and empty segments a downstream layer might renormalise", () => {
    expect(isOwnedStoragePath(`${ME}\\..\\${OTHER}\\notes.pdf`, ME)).toBe(false);
    expect(isOwnedStoragePath(`${ME}/sub\\..\\x`, ME)).toBe(false);
    expect(isOwnedStoragePath(`${ME}//notes.pdf`, ME)).toBe(false);
    // A NUL can truncate the key inside a C-string consumer further down.
    expect(isOwnedStoragePath(`${ME}/notes.pdf${NUL}.png`, ME)).toBe(false);
  });

  it("rejects empty input rather than treating it as permissive", () => {
    expect(isOwnedStoragePath("", ME)).toBe(false);
    expect(isOwnedStoragePath(`${ME}/notes.pdf`, "")).toBe(false);
  });
});
