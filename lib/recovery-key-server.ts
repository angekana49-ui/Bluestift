import "server-only";
import { createHash, randomInt } from "node:crypto";
import {
  RECOVERY_KEY_ALPHABET,
  RECOVERY_KEY_LENGTH,
  normalizeRecoveryKey,
} from "@/lib/recovery-key";

/**
 * Server half of the recovery-key contract. Kept apart from lib/recovery-key.ts
 * — which is deliberately isomorphic so the login form and the API validate a
 * typed key identically — because nothing here may ever reach a browser bundle.
 *
 * The key is NEVER stored. `users.recovery_code_hash` holds this digest, and the
 * cleartext exists only in the response that shows it to its owner once.
 */

/**
 * SHA-256 (hex) of a recovery key, normalised first so a key typed as
 * "7kfm 9qrt-2xbh 4dwp" hashes to the same value as the stored form. Getting the
 * normalisation wrong here fails closed — a legitimate owner is refused — which
 * is why both sides go through `normalizeRecoveryKey` and nothing else.
 *
 * A bare SHA-256, no salt and no pepper, is the right primitive for an 80-bit
 * uniformly random secret: there is no dictionary to run against it, a per-row
 * salt would forbid the equality lookup recovery depends on, and a pepper adds a
 * secret to rotate for no gain against an offline read of the table. The
 * migration (20260813200000) carries the full reasoning.
 */
export function hashRecoveryKey(code: string): string {
  return createHash("sha256").update(normalizeRecoveryKey(code), "utf8").digest("hex");
}

/**
 * A fresh key from the unambiguous alphabet. `randomInt` is rejection-sampled by
 * Node, so the distribution is uniform — a modulo of a random byte would not be,
 * and biased characters cost real entropy in a 16-character secret.
 */
export function generateRecoveryKey(): string {
  let code = "";
  for (let i = 0; i < RECOVERY_KEY_LENGTH; i++) {
    code += RECOVERY_KEY_ALPHABET[randomInt(RECOVERY_KEY_ALPHABET.length)];
  }
  return code;
}
