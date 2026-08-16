import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Which credential the kernel client puts on the wire.
 *
 * The service secret can read and write any student's cognitive profile; a
 * student's own token reaches only theirs. Calls that are about one known,
 * present student should carry that student's token — but only once the kernel
 * is able to verify one, hence the flag.
 */

const state: { authHeader: string | null } = { authHeader: null };

vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
  state.authHeader = new Headers(init.headers).get("authorization");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

async function freshClient(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/kernel/client");
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  state.authHeader = null;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("kernel client credentials", () => {
  it("uses the student's token when scoped auth is on", async () => {
    const { kernel } = await freshClient({
      KERNEL_API_SECRET: "service-secret",
      KERNEL_USER_SCOPED_AUTH: "1",
    });

    await kernel.loadProfile({ user_id: "u1" }, { accessToken: "student-token" });
    expect(state.authHeader).toBe("Bearer student-token");
  });

  it("stays on the service secret while the flag is off", async () => {
    // The kernel only accepts user tokens once it holds SUPABASE_JWT_SECRET.
    // Until then, sending one would 401 every scoped call.
    const { kernel } = await freshClient({
      KERNEL_API_SECRET: "service-secret",
      KERNEL_USER_SCOPED_AUTH: undefined,
    });

    await kernel.loadProfile({ user_id: "u1" }, { accessToken: "student-token" });
    expect(state.authHeader).toBe("Bearer service-secret");
  });

  it("falls back to the service secret when there is no session to borrow", async () => {
    // Background work — a cache refresh, a fire-and-forget analysis — runs with
    // no live session, and must keep working.
    const { kernel } = await freshClient({
      KERNEL_API_SECRET: "service-secret",
      KERNEL_USER_SCOPED_AUTH: "1",
    });

    await kernel.loadProfile({ user_id: "u1" }, { accessToken: null });
    expect(state.authHeader).toBe("Bearer service-secret");

    await kernel.analyze({ user_id: "u1", conversation_history: [] });
    expect(state.authHeader).toBe("Bearer service-secret");
  });

  it("scopes every route that names a student", async () => {
    const { kernel } = await freshClient({
      KERNEL_API_SECRET: "service-secret",
      KERNEL_USER_SCOPED_AUTH: "1",
    });
    const as = { accessToken: "student-token" };

    await kernel.analyze({ user_id: "u1", conversation_history: [] }, as);
    expect(state.authHeader).toBe("Bearer student-token");

    await kernel.updateConceptState(
      { user_id: "u1", concept_label: "fractions", partial_credit_score: 0.5 },
      as,
    );
    expect(state.authHeader).toBe("Bearer student-token");
  });
});
