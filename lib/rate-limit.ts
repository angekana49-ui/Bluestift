import "server-only";
import { createContentAdminClient } from "@/lib/supabase/admin";

/**
 * Per-IP rate limit for public endpoints, backed by content.check_rate_limit
 * (atomic, advisory-locked — mirrors public.check_signup_ip). Returns true when
 * the call is ALLOWED. FAILS OPEN: any limiter error returns true so a hiccup
 * never locks out legitimate users (this is anti-spam, not an auth gate). An
 * empty IP is allowed (the DB function treats it as unidentifiable).
 */
export async function checkRateLimit(
  bucket: string,
  ip: string,
  max: number,
  windowInterval = "60 minutes",
): Promise<boolean> {
  try {
    const admin = createContentAdminClient() as unknown as {
      rpc: (
        f: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: unknown }>;
    };
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_ip: ip,
      p_max: max,
      p_window: windowInterval,
    });
    if (error) return true; // fail open
    return data !== false;
  } catch {
    return true; // fail open
  }
}

/**
 * Strict variant for unauthenticated, high-risk entry points (account recovery
 * and code redemption). Unlike the public-form limiter, an unavailable backing
 * store denies the request so a database outage cannot become a brute-force
 * bypass.
 */
export async function checkStrictRateLimit(
  bucket: string,
  ip: string,
  max: number,
  windowInterval = "60 minutes",
): Promise<boolean> {
  if (!ip) return false;
  try {
    const admin = createContentAdminClient() as unknown as {
      rpc: (
        f: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: unknown }>;
    };
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_ip: ip,
      p_max: max,
      p_window: windowInterval,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Strict per-user form for paid/expensive authenticated operations. */
export async function checkStrictUserRateLimit(
  bucket: string,
  userId: string,
  max: number,
  windowInterval = "60 minutes",
): Promise<boolean> {
  if (!userId) return false;
  return checkStrictRateLimit(`${bucket}:u:${userId}`, "0.0.0.0", max, windowInterval);
}

/**
 * Per-USER rate limit for AUTHENTICATED endpoints (chat), where keying by IP is
 * wrong: in our markets many students share one campus/mobile-gateway NAT, so an
 * IP bucket would let a few heavy users throttle a whole school.
 *
 * The user identity is carried in the BUCKET; p_ip is pinned to a constant,
 * always-valid address. This makes the limit correct REGARDLESS of how the DB
 * types check_rate_limit's p_ip: "0.0.0.0" parses as both inet and text, and the
 * per-user isolation comes entirely from the distinct bucket key. (Passing a raw
 * UUID as p_ip would silently fail-open — and so silently stop limiting — if p_ip
 * were inet; this avoids that trap.) FAILS OPEN like checkRateLimit. An empty
 * userId is not limited here (auth is the gate in that case).
 */
export async function checkUserRateLimit(
  bucket: string,
  userId: string,
  max: number,
  windowInterval = "60 minutes",
): Promise<boolean> {
  if (!userId) return true;
  return checkRateLimit(`${bucket}:u:${userId}`, "0.0.0.0", max, windowInterval);
}
