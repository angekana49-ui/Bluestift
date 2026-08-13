import { describe, it, expect } from "vitest";
import {
  RECOVERY_KEY_ALPHABET,
  formatRecoveryKey,
  isValidRecoveryKey,
  maskedRecoveryKey,
  normalizeRecoveryKey,
  recoveryKeyTail,
} from "@/lib/recovery-key";

const KEY = "7KFM9QRT2XBH4DWP";
const GROUPED = "7KFM-9QRT-2XBH-4DWP";

// The display format and the accepted input format must never drift apart: we
// show the key grouped, so every grouped form the user can copy back has to
// match. A regression here locks people out of their own accounts.
describe("normalizeRecoveryKey", () => {
  it("accepts the grouped form we display", () => {
    expect(normalizeRecoveryKey(GROUPED)).toBe(KEY);
  });
  it("accepts lowercase, spaces, tabs and stray separators", () => {
    expect(normalizeRecoveryKey("7kfm-9qrt-2xbh-4dwp")).toBe(KEY);
    expect(normalizeRecoveryKey(" 7KFM 9QRT 2XBH 4DWP ")).toBe(KEY);
    expect(normalizeRecoveryKey("7KFM\t9QRT\n2XBH 4DWP")).toBe(KEY);
    expect(normalizeRecoveryKey("7KFM—9QRT–2XBH_4DWP")).toBe(KEY);
  });
  it("leaves an already-bare key untouched", () => {
    expect(normalizeRecoveryKey(KEY)).toBe(KEY);
  });
});

describe("isValidRecoveryKey", () => {
  it("accepts a real key in every form a user might type it", () => {
    expect(isValidRecoveryKey(KEY)).toBe(true);
    expect(isValidRecoveryKey(GROUPED)).toBe(true);
    expect(isValidRecoveryKey("7kfm 9qrt 2xbh 4dwp")).toBe(true);
  });
  it("rejects wrong lengths", () => {
    expect(isValidRecoveryKey("")).toBe(false);
    expect(isValidRecoveryKey("7KFM9QRT2XBH4DW")).toBe(false);
    expect(isValidRecoveryKey("7KFM9QRT2XBH4DWPP")).toBe(false);
  });
  it("rejects the ambiguous characters the alphabet excludes", () => {
    for (const bad of ["O", "0", "I", "1"]) {
      expect(RECOVERY_KEY_ALPHABET).not.toContain(bad);
      expect(isValidRecoveryKey(`${bad}KFM9QRT2XBH4DWP`)).toBe(false);
    }
  });
});

describe("formatRecoveryKey", () => {
  it("groups a bare key into fours", () => {
    expect(formatRecoveryKey(KEY)).toBe(GROUPED);
  });
  it("is idempotent — re-formatting an already grouped key is stable", () => {
    expect(formatRecoveryKey(GROUPED)).toBe(GROUPED);
  });
  it("round-trips back to the stored form", () => {
    expect(normalizeRecoveryKey(formatRecoveryKey(KEY))).toBe(KEY);
  });
});

describe("recoveryKeyTail", () => {
  it("returns the last group — what the user retypes as proof", () => {
    expect(recoveryKeyTail(KEY)).toBe("4DWP");
    expect(recoveryKeyTail(GROUPED)).toBe("4DWP");
  });
});

describe("maskedRecoveryKey", () => {
  it("mirrors the grouped shape so the layout doesn't jump on reveal", () => {
    const masked = maskedRecoveryKey(KEY);
    expect(masked).toBe("••••-••••-••••-••••");
    expect(masked.length).toBe(GROUPED.length);
  });
  it("falls back to full width when there is no key yet", () => {
    expect(maskedRecoveryKey(null)).toBe("••••-••••-••••-••••");
  });
});
