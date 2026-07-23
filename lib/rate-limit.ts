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
