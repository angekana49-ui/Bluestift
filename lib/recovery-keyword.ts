import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { foldForSearch } from "@/lib/search";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * The memory word that gates recovery-key generation.
 *
 * WHAT IT DEFENDS. `/api/account/recovery-key` mints a new key for whoever holds
 * the session, and an anonymous account has no password to re-enter. So anyone
 * who reaches an unlocked browser — a shared school machine, a sibling, a phone
 * left face-up on a desk — pressed one button, wrote the key down, and owned
 * that account permanently and remotely, long after the owner had walked away.
 * The existing 5-per-day cap is no defence at all: one key is enough.
 *
 * WHAT IT IS NOT. It is not a password and must not be treated as one. The word
 * is chosen to be memorable by a nine-year-old — "banane" — so its entropy is
 * roughly none. Everything below is built on that admission:
 *
 *  - The strength comes from RATE LIMITING the guesses, which lives in the
 *    route. Without that this is theatre; with it, a bystander with two minutes
 *    at someone else's desk gets a handful of tries at a word they do not know.
 *  - The stored form still has to survive the table leaking, and there an
 *    unsalted SHA-256 of a six-letter dictionary word falls to a wordlist in
 *    milliseconds. Hence scrypt with a per-row salt. It is the one place cost
 *    genuinely buys something.
 *
 * WHY NOT REUSE hashRecoveryKey. That function's comment is explicit that a bare
 * SHA-256 is right for an 80-bit uniform secret — no dictionary exists to run
 * against it. Neither half of that reasoning survives being pointed at a word a
 * child picked, which is exactly why this is a separate function rather than a
 * second caller of that one.
 */

/** scrypt cost. 2^15 is ~50-100ms per hash here — deliberate, and only ever paid
 *  on a deliberate generation, never in a hot path. maxmem must be raised above
 *  Node's 32MB default or N=32768 throws. */
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

/**
 * The shortest word we will accept, after folding.
 *
 * Three is low, and chosen anyway: the alternative is a child inventing a word
 * they cannot reproduce a month later, which locks them out of their own account
 * far more reliably than an attacker ever would. The rate limiter carries the
 * weight here, not the length.
 */
export const KEYWORD_MIN_LENGTH = 3;
export const KEYWORD_MAX_LENGTH = 64;

/**
 * Reduce a typed word to what we compare.
 *
 * The SAME folding the search box uses, and for the same reason: this is a
 * string a human is reproducing from memory, so "Banane", "banane " and "BANANE"
 * have to be one word, and a child who wrote "café" must not be locked out for
 * typing "cafe" — or for being on a keyboard that cannot make an é.
 *
 * It costs entropy the word did not have. What it buys is that the failure mode
 * of this gate is not "the rightful owner is permanently locked out by an
 * accent", which is the only failure mode that would matter at our scale.
 */
export function normalizeKeyword(input: string): string {
  return foldForSearch(input).slice(0, KEYWORD_MAX_LENGTH);
}

/** Is this usable as a memory word at all? */
export function isValidKeyword(input: string): boolean {
  return normalizeKeyword(input).length >= KEYWORD_MIN_LENGTH;
}

/** `scrypt$N$r$p$saltHex$hashHex` — self-describing, so the cost can be raised
 *  later without stranding rows hashed at the old parameters. */
export async function hashKeyword(input: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(normalizeKeyword(input), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Verify a typed word against a stored encoding.
 *
 * Reads the cost parameters back OUT of the stored string rather than assuming
 * the current constants, so raising N later keeps every existing row verifiable.
 * Returns false — never throws — for anything malformed, so a corrupted column
 * fails closed instead of 500-ing the route into an unknown state.
 */
export async function verifyKeyword(input: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
    const n = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    // A hostile or corrupted row must not be able to ask for an unbounded amount
    // of memory on our server.
    if (n > 1 << 20 || r > 32 || p > 16) return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = await scrypt(normalizeKeyword(input), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
