import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links for the newsletter — confirm and unsubscribe. PREPARED, NOT
 * WIRED.
 *
 * Nothing is stored. A token is the subscriber id plus an HMAC over it, keyed
 * by NEWSLETTER_SECRET, so there is no token column to leak, index or rotate
 * row by row, and a table read hands an attacker nothing. The purpose is inside
 * the MAC, so an unsubscribe token can never be replayed as a confirmation.
 *
 * An unsubscribe link never expires: RFC 8058 one-click and every mail client's
 * "unsubscribe" button may use it years later, and it must still work. A
 * confirmation link expires, so an old signup mail found later cannot opt an
 * address in.
 *
 * An unset secret is closed, not open (the lib/cron-auth.ts rule): minting
 * throws and verification fails.
 */

export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Purpose = "confirm" | "unsubscribe";

function secret(): string | null {
  const s = process.env.NEWSLETTER_SECRET;
  return s && s.length >= 32 ? s : null;
}

function mac(purpose: Purpose, body: string, key: string): string {
  return createHmac("sha256", key).update(`${purpose}:${body}`).digest("base64url");
}

function sameMac(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const ID = /^[0-9a-f-]{36}$/i;

export function mintUnsubscribeToken(subscriberId: string): string {
  const key = secret();
  if (!key) throw new Error("NEWSLETTER_SECRET is not set (32+ chars)");
  return `${subscriberId}.${mac("unsubscribe", subscriberId, key)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const key = secret();
  if (!key) return null;
  const [id, sig, extra] = token.split(".");
  if (extra !== undefined || !id || !sig || !ID.test(id)) return null;
  return sameMac(sig, mac("unsubscribe", id, key)) ? id : null;
}

export function mintConfirmToken(subscriberId: string, now: number = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("NEWSLETTER_SECRET is not set (32+ chars)");
  const exp = Math.floor((now + CONFIRM_TTL_MS) / 1000).toString(36);
  return `${subscriberId}.${exp}.${mac("confirm", `${subscriberId}:${exp}`, key)}`;
}

export function verifyConfirmToken(token: string, now: number = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const [id, exp, sig, extra] = token.split(".");
  if (extra !== undefined || !id || !exp || !sig || !ID.test(id)) return null;
  if (!sameMac(sig, mac("confirm", `${id}:${exp}`, key))) return null;
  const expiresAt = parseInt(exp, 36) * 1000;
  return Number.isFinite(expiresAt) && now < expiresAt ? id : null;
}
