import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KEYWORD_MIN_LENGTH,
  hashKeyword,
  isValidKeyword,
  normalizeKeyword,
  verifyKeyword,
} from "@/lib/recovery-keyword";

/**
 * The memory word that gates recovery-key generation.
 *
 * The hole it closes: `/api/account/recovery-key` mints a NEW key for whoever
 * holds the session, and an anonymous account has no password to re-enter. So
 * anyone reaching an unlocked browser — a shared school machine, a sibling, a
 * phone left on a desk — pressed one button, wrote the key down, and kept remote
 * access to that account forever. The 5-per-day cap was no defence: one is
 * enough.
 *
 * The word is chosen to be memorable by a child, so it has almost no entropy.
 * Every test below is written from that admission: the strength is in the rate
 * limit, the storage has to survive a leak anyway, and the failure mode that
 * actually costs us users is locking the rightful owner out over an accent.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("normalising what a child typed", () => {
  it("ignores capitals, padding and accents", () => {
    // A word reproduced from memory a month later, possibly on a keyboard that
    // cannot make an é. Being locked out of your own account for typing "cafe"
    // is a worse outcome than anything this gate defends against.
    const forms = ["banane", "Banane", "  BANANE  ", "banané"];
    const folded = forms.map(normalizeKeyword);
    expect(new Set(folded).size).toBe(1);
    expect(folded[0]).toBe("banane");
  });

  it("rejects a word too short to be a word", () => {
    expect(isValidKeyword("")).toBe(false);
    expect(isValidKeyword("   ")).toBe(false);
    expect(isValidKeyword("!!")).toBe(false);
    expect(isValidKeyword("a".repeat(KEYWORD_MIN_LENGTH - 1))).toBe(false);
    expect(isValidKeyword("a".repeat(KEYWORD_MIN_LENGTH))).toBe(true);
  });

  it("caps the length so a paste cannot become a scrypt bomb", () => {
    expect(normalizeKeyword("x".repeat(5000)).length).toBeLessThanOrEqual(64);
  });
});

describe("storage", () => {
  it("round-trips the word it was given", async () => {
    const stored = await hashKeyword("banane");
    expect(await verifyKeyword("banane", stored)).toBe(true);
    expect(await verifyKeyword("BANANE", stored)).toBe(true);
    expect(await verifyKeyword("banané", stored)).toBe(true);
  });

  it("refuses a different word", async () => {
    const stored = await hashKeyword("banane");
    expect(await verifyKeyword("banana", stored)).toBe(false);
    expect(await verifyKeyword("banan", stored)).toBe(false);
    expect(await verifyKeyword("", stored)).toBe(false);
  });

  it("salts, so two accounts with the same word do not look the same", async () => {
    // Without this, one leaked table shows at a glance which accounts share a
    // word — and every account whose word is "banane" falls together.
    const a = await hashKeyword("banane");
    const b = await hashKeyword("banane");
    expect(a).not.toBe(b);
    expect(await verifyKeyword("banane", a)).toBe(true);
    expect(await verifyKeyword("banane", b)).toBe(true);
  });

  it("is scrypt, not the SHA-256 the recovery KEY uses", async () => {
    // hashRecoveryKey's own comment says a bare SHA-256 is right for an 80-bit
    // uniform secret — no dictionary exists to run against it. Neither half of
    // that survives being pointed at a word a nine-year-old picked, which is
    // why this is a separate function and not a second caller.
    const stored = await hashKeyword("banane");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored.split("$")).toHaveLength(6);
  });

  it("fails closed on a missing or corrupted column", async () => {
    // A 500 here would leave the caller in an unknown state on a security path.
    for (const bad of [
      null,
      "",
      "not-a-hash",
      "scrypt$32768$8$1$deadbeef", // truncated
      "sha256$32768$8$1$aa$bb", // wrong algorithm
      "scrypt$x$8$1$aa$bb", // non-numeric cost
    ]) {
      expect(await verifyKeyword("banane", bad), String(bad)).toBe(false);
    }
  });

  it("will not let a hostile row ask for unbounded memory", async () => {
    // The cost parameters are read back OUT of the stored string so raising N
    // later keeps old rows verifiable — which means a tampered row could
    // otherwise name an N that exhausts the server.
    const evil = `scrypt$${2 ** 30}$8$1$aabb$ccdd`;
    expect(await verifyKeyword("banane", evil)).toBe(false);
  });

  it("verifies old rows after the cost is raised", async () => {
    // Self-describing encoding: the point of putting N/r/p in the column.
    const cheap = "scrypt$16384$8$1";
    const stored = await hashKeyword("banane");
    expect(stored.split("$").slice(0, 4).join("$")).not.toBe(cheap);
    // Same word, hashed at a lower cost, still verifies.
    const { scryptSync, randomBytes } = await import("node:crypto");
    const salt = randomBytes(16);
    const hash = scryptSync("banane", salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const legacy = `scrypt$16384$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
    expect(await verifyKeyword("banane", legacy)).toBe(true);
  });
});

describe("the route is where the security actually lives", () => {
  const route = read("app/api/account/recovery-key/route.ts");

  it("limits GUESSES separately from generations", () => {
    // The existing 5-keys-a-day cap counts successes. It does nothing against
    // someone trying "chat", "maman", "banane" at a borrowed desk.
    expect(route).toMatch(/recovery_keyword_try/);
    expect(route).toMatch(/recovery_key_issue/);
  });

  it("rate-limits BEFORE verifying, so a flood is not also a CPU attack", () => {
    const gate = route.slice(route.indexOf("if (stored)"), route.indexOf("} else if"));
    expect(gate.indexOf("recovery_keyword_try")).toBeLessThan(gate.indexOf("verifyKeyword"));
  });

  it("sets the word on the first generation and demands it after", () => {
    expect(route).toMatch(/if \(stored\)/);
    expect(route).toMatch(/isValidKeyword\(keyword\)/);
    expect(route).toMatch(/hashKeyword\(keyword\)/);
  });

  it("stores the word only once the key it guards exists", () => {
    // The other order leaves an account whose generation is gated by a word its
    // owner was never shown a key for.
    expect(route.indexOf("issueRecoveryKey")).toBeLessThan(route.indexOf("hashKeyword"));
  });

  it("gives a guesser ONE refusal, with no branch on why", () => {
    // There is nothing useful to tell someone who is guessing, so a bad word and
    // an absent word must be indistinguishable. Asserted on the rendered message
    // rather than the surrounding source — the first version of this test
    // matched the word "wrong" inside its own explanatory comment.
    const gate = route.slice(route.indexOf("if (stored)"), route.indexOf("} else if"));
    const messages = [...gate.matchAll(/error: "([^"]+)"/g)].map((m) => m[1]);
    // Exactly two: the rate-limit refusal and the verification refusal. A third
    // would mean the route had started explaining itself to an attacker.
    expect(messages).toHaveLength(2);
    expect(gate).toMatch(/status: 403/);
    for (const m of messages) {
      expect(m, m).not.toMatch(/not set|never set|no word yet|first time/i);
    }
  });
});

describe("the column is not reachable from a browser", () => {
  const sql = read("supabase/migrations/20260903110000_recovery_keyword_gate.sql");

  it("revokes UPDATE, or the gate can be cleared by the thing it gates", () => {
    expect(sql).toMatch(/revoke update \(recovery_keyword_hash\)/);
    expect(sql).toMatch(/revoke update \(recovery_keyword_set_at\)/);
  });

  it("revokes SELECT on the hash — a six-letter word does not survive offline", () => {
    // Even the legitimate owner's client must not be able to read it: an
    // attacker with a session would otherwise walk away with a wordlist target
    // instead of a rate-limited guess.
    expect(sql).toMatch(/revoke select \(recovery_keyword_hash\)/);
  });

  it("only the fact that a word exists reaches the client", () => {
    const auth = read("lib/auth.ts");
    expect(auth).toMatch(/hasKeyword: Boolean\(data\?\.recovery_keyword_set_at\)/);
    expect(auth).not.toMatch(/recovery_keyword_hash/);
  });
});
