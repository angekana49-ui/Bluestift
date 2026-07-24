import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkRateLimit, checkUserRateLimit } from "@/lib/rate-limit";

// The limiter is anti-spam, not an auth gate: it must FAIL OPEN. With no
// SUPABASE_SERVICE_ROLE_KEY the admin client throws on construction, and the
// helper must swallow that and allow the request (return true) — never lock out
// a legitimate user because the limiter itself is unavailable.
describe("checkRateLimit fail-open", () => {
  const OLD = process.env.SUPABASE_SERVICE_ROLE_KEY;
  beforeEach(() => delete process.env.SUPABASE_SERVICE_ROLE_KEY);
  afterEach(() => {
    if (OLD === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = OLD;
  });

  it("allows the call when the limiter backend is unavailable", async () => {
    const allowed = await checkRateLimit("wall_react", "1.2.3.4", 1);
    expect(allowed).toBe(true);
  });

  it("checkUserRateLimit also fails open when the backend is unavailable", async () => {
    const allowed = await checkUserRateLimit("raya_chat", "00000000-0000-0000-0000-000000000000", 1);
    expect(allowed).toBe(true);
  });

  it("checkUserRateLimit never blocks an empty/unidentified user", async () => {
    // Even if the backend were up, no userId → don't limit (auth is the gate).
    const allowed = await checkUserRateLimit("raya_chat", "", 1);
    expect(allowed).toBe(true);
  });
});
