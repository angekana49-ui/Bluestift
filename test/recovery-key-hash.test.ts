import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateRecoveryKey, hashRecoveryKey } from "@/lib/recovery-key-server";
import {
  RECOVERY_KEY_ALPHABET,
  RECOVERY_KEY_LENGTH,
  formatRecoveryKey,
  isValidRecoveryKey,
} from "@/lib/recovery-key";

/**
 * The hash is now the ONLY stored form of a recovery key, so these are lockout
 * tests as much as security ones: if hashing and normalisation ever disagree, a
 * legitimate owner types their key correctly and is refused, with no support
 * path back because nobody — including us — can read the key.
 */
describe("hashRecoveryKey", () => {
  const KEY = "7KFM9QRT2XBH4DWP";

  it("is a stable SHA-256 hex digest", () => {
    const expected = createHash("sha256").update(KEY, "utf8").digest("hex");
    expect(hashRecoveryKey(KEY)).toBe(expected);
    expect(hashRecoveryKey(KEY)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes every form a human might type to the SAME digest", () => {
    // This is the lockout guard: the key is SHOWN grouped, so the grouped form
    // is what people write down and type back.
    const canonical = hashRecoveryKey(KEY);
    expect(hashRecoveryKey(formatRecoveryKey(KEY))).toBe(canonical);
    expect(hashRecoveryKey("7kfm9qrt2xbh4dwp")).toBe(canonical);
    expect(hashRecoveryKey("7kfm-9qrt-2xbh-4dwp")).toBe(canonical);
    expect(hashRecoveryKey(" 7KFM 9QRT 2XBH 4DWP ")).toBe(canonical);
    expect(hashRecoveryKey("7KFM—9QRT—2XBH—4DWP")).toBe(canonical);
  });

  it("separates keys that differ by a single character", () => {
    expect(hashRecoveryKey("7KFM9QRT2XBH4DWP")).not.toBe(hashRecoveryKey("7KFM9QRT2XBH4DWQ"));
  });
});

describe("generateRecoveryKey", () => {
  it("produces keys the shared validator accepts", () => {
    for (let i = 0; i < 50; i++) {
      const key = generateRecoveryKey();
      expect(key).toHaveLength(RECOVERY_KEY_LENGTH);
      expect(isValidRecoveryKey(key)).toBe(true);
    }
  });

  it("only ever uses the unambiguous alphabet", () => {
    // A stray 0/O or 1/I would be transcribed wrong off a piece of paper and the
    // owner would be locked out of an account with no other way in.
    const alphabet = new Set(RECOVERY_KEY_ALPHABET.split(""));
    for (let i = 0; i < 50; i++) {
      for (const ch of generateRecoveryKey()) {
        expect(alphabet.has(ch), `unexpected character ${ch}`).toBe(true);
      }
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateRecoveryKey());
    expect(seen.size).toBe(200);
  });

  it("uses the whole alphabet, so no character class is quietly unreachable", () => {
    // A modulo-biased generator can starve the tail of the alphabet; over 400
    // keys (6400 characters) every one of the 32 symbols should appear.
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) for (const ch of generateRecoveryKey()) seen.add(ch);
    expect(seen.size).toBe(RECOVERY_KEY_ALPHABET.length);
  });
});
