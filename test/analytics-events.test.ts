import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT_EVENTS } from "@/lib/analytics/events";

/**
 * The product events PostHog's funnels are built on.
 *
 * What goes wrong here goes wrong quietly: a catalogued event nothing emits is
 * a funnel step stuck at zero, a property carrying what someone wrote is a
 * privacy breach that still "works", and a completion event a client can call
 * at will is a funnel that counts whatever it is told.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8").split("\r\n").join("\n");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

/** Every `captureServer(<id>, "<event>", { ... })` call, with its property block. */
const calls = [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("components")].flatMap((file) => {
  const src = read(file);
  const found: { file: string; event: string; props: string }[] = [];
  const re = /captureServer\(\s*[^,]+,\s*"([a-z_]+)"\s*(?:,\s*\{)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let props = "";
    if (m[0].endsWith("{")) {
      let depth = 1;
      let i = re.lastIndex;
      for (; i < src.length && depth > 0; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
      }
      props = src.slice(re.lastIndex, i - 1);
    }
    found.push({ file, event: m[1], props });
  }
  return found;
});

describe("the event catalogue", () => {
  it("finds the call sites at all (guards the scanner itself)", () => {
    expect(calls.length).toBeGreaterThanOrEqual(PRODUCT_EVENTS.length);
  });

  it("has no event that nothing emits", () => {
    const emitted = new Set(calls.map((c) => c.event));
    expect(PRODUCT_EVENTS.filter((e) => !emitted.has(e))).toEqual([]);
  });

  it("has every emitted event catalogued", () => {
    const known = new Set<string>(PRODUCT_EVENTS);
    expect(calls.filter((c) => !known.has(c.event)).map((c) => `${c.file}: ${c.event}`)).toEqual([]);
  });

  it("never sends what a person wrote or who they are", () => {
    // Keys and values both: `title: x` and `{ content }` shorthand alike.
    const forbidden = /\b(content|title|firstName|lastName|schoolName|display_name|displayName|email|username|city)\b/;
    // String literals are values we chose (`"email"` as a sign-up METHOD), not data.
    const leaks = calls
      .filter((c) => forbidden.test(c.props.replace(/"[^"]*"/g, '""')))
      .map((c) => `${c.file}: ${c.event} → ${c.props.trim()}`);
    expect(leaks).toEqual([]);
  });
});

describe("where the funnel events fire", () => {
  it("counts a Raya message once, after the replay check, on both chats", () => {
    for (const file of ["app/api/raya/chat/route.ts", "app/api/school/raya/chat/route.ts"]) {
      const src = read(file);
      const replay = src.indexOf("existingReply != null");
      const event = src.indexOf('"raya_message_sent"');
      expect(replay, file).toBeGreaterThan(-1);
      expect(event, `${file} counts retries as new messages`).toBeGreaterThan(replay);
    }
  });

  it("sends signed_up at the age step: once, adults only, dated to the account's creation", () => {
    const src = read("app/api/account/age/route.ts");
    const oneShot = src.indexOf("existing?.age_declared_at");
    const stored = src.indexOf("forgetOptionalProcessing(user.id)");
    const event = src.indexOf('"signed_up"');
    expect(oneShot).toBeGreaterThan(-1);
    // After the 409 on a second declaration, and after the band memo is dropped
    // (a stale "unknown age" there would silently drop the event).
    expect(event).toBeGreaterThan(oneShot);
    expect(event).toBeGreaterThan(stored);
    const block = src.slice(src.lastIndexOf("if (isAdult)", event), src.indexOf("});", event));
    expect(block).toContain("if (isAdult)");
    expect(src.slice(event, src.indexOf(");", src.indexOf("{ timestamp", event)) + 2)).toContain("{ timestamp: known }");
  });

  it("times a Raya reply after its stream ends, on both chats, with numbers only", () => {
    for (const file of ["app/api/raya/chat/route.ts", "app/api/school/raya/chat/route.ts"]) {
      const src = read(file);
      const loop = src.indexOf("for await (const delta of deltas)");
      const event = src.indexOf('"raya_response_received"');
      expect(loop, file).toBeGreaterThan(-1);
      expect(event, `${file} reports before the reply has finished`).toBeGreaterThan(loop);
      expect(src.slice(loop, event)).toContain("clock.tick()");
      // The reply's length, never the reply.
      const props = calls.find((c) => c.file === file && c.event === "raya_response_received")!.props;
      expect(props).toContain("clock.done(full.length, interrupted)");
      expect(props).not.toMatch(/\bfull\b(?!\.length)/);
    }
  });

  it("records an invitation on every path that creates one", () => {
    const kinds = calls
      .filter((c) => c.event === "invite_created")
      .map((c) => /kind: "(\w+)"/.exec(c.props)?.[1])
      .sort();
    expect(kinds).toEqual(["account_created", "named", "staff_code"]);
  });

  it("records a team join only once the membership or request exists", () => {
    const src = read("app/api/school/join-team/route.ts");
    const outcomes = [...src.matchAll(/"school_team_joined", \{ outcome: "(\w+)" \}/g)].map((m) => m[1]);
    expect(outcomes.sort()).toEqual(["joined", "renewed", "requested"]);
  });
});

describe("the minor lockout", () => {
  it("revokes consent the moment onboarding learns the account is a minor", () => {
    const form = read("components/onboarding-form.tsx");
    expect(form).toMatch(/if \(data\.band !== "adult"\) lockOutMinor\(\);/);
  });

  it("revokes, stops the SDK, and tells the provider to drop the banner", () => {
    const lazy = read("lib/analytics/posthog-lazy.ts");
    const body = lazy.slice(lazy.indexOf("export function lockOutMinor"));
    expect(body).toContain('setConsent("denied")');
    expect(body).toContain("disableAnalytics()");
    expect(body).toContain("MINOR_LOCKOUT_EVENT");
    const provider = read("components/analytics/PostHogProvider.tsx");
    expect(provider).toContain("addEventListener(MINOR_LOCKOUT_EVENT");
  });
});

/* ── The onboarding route, run for real against mocked Supabase ─────────── */

const state: {
  user: { id: string; is_anonymous?: boolean; created_at?: string } | null;
  claims: Record<string, unknown> | null;
  row: { onboarding_completed_at: string | null; school_level: string | null } | null;
  metadata: Record<string, unknown> | null;
} = { user: null, claims: null, row: null, metadata: null };

const captured: {
  userId: string;
  event: string;
  props: Record<string, unknown>;
  options?: { timestamp?: Date; uuid?: string };
}[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      getClaims: async () => ({ data: state.claims ? { claims: state.claims } : null }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () =>
          table === "users" ? { data: state.row } : { data: state.metadata ? { metadata: state.metadata } : null },
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServer: async (
    userId: string,
    event: string,
    props: Record<string, unknown>,
    options?: { timestamp?: Date; uuid?: string },
  ) => {
    captured.push({ userId, event, props, ...(options ? { options } : {}) });
  },
}));

describe("POST /api/analytics/onboarding", () => {
  beforeEach(() => {
    captured.length = 0;
    state.user = { id: "u1", is_anonymous: true };
    state.row = { onboarding_completed_at: new Date().toISOString(), school_level: "lycee" };
    state.metadata = { track: "raya", role: "student" };
  });

  const call = async () => (await import("@/app/api/analytics/onboarding/route")).POST();

  it("emits a fresh completion, with properties read from the stored rows", async () => {
    const res = await call();
    expect(res.status).toBe(204);
    expect(captured).toEqual([
      {
        userId: "u1",
        event: "onboarding_completed",
        props: { track: "raya", role: "student", school_level: "lycee", anonymous: true },
      },
    ]);
  });

  it("does not replay an old completion into the funnel", async () => {
    state.row = { onboarding_completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), school_level: null };
    expect((await call()).status).toBe(204);
    expect(captured).toEqual([]);
  });

  it("does not invent a completion that never happened", async () => {
    state.row = { onboarding_completed_at: null, school_level: null };
    await call();
    expect(captured).toEqual([]);
  });

  it("answers the same 204 to a signed-out caller, and sends nothing", async () => {
    state.user = null;
    expect((await call()).status).toBe(204);
    expect(captured).toEqual([]);
  });

  it("keeps a school level out of the Schools track", async () => {
    state.metadata = { track: "schools", role: "teacher" };
    await call();
    expect(captured[0].props).toMatchObject({ track: "schools", role: "teacher", school_level: null });
  });
});

/* ── The login route, run for real against mocked Supabase ─────────────── */

describe("POST /api/analytics/login", () => {
  const secondsAgo = (n: number) => Math.floor(Date.now() / 1000) - n;

  beforeEach(() => {
    captured.length = 0;
    state.user = { id: "u1", is_anonymous: false, created_at: new Date(Date.now() - 30 * 86_400_000).toISOString() };
    state.claims = { sub: "u1", session_id: "s1", is_anonymous: false, amr: [{ method: "password", timestamp: secondsAgo(20) }] };
  });

  const call = async () => (await import("@/app/api/analytics/login/route")).POST();

  it("counts a fresh sign-in, dated to the moment the token says it happened", async () => {
    expect((await call()).status).toBe(204);
    expect(captured).toHaveLength(1);
    const [e] = captured;
    expect(e).toMatchObject({ userId: "u1", event: "logged_in", props: { method: "password", new_account: false } });
    const amr = (state.claims!.amr as { timestamp: number }[])[0];
    expect(e.options?.timestamp?.getTime()).toBe(amr.timestamp * 1000);
    expect(e.options?.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("gives the same sign-in the same uuid, so a second ping is the same event", async () => {
    await call();
    await call();
    expect(captured).toHaveLength(2);
    expect(captured[0].options?.uuid).toBe(captured[1].options?.uuid);
  });

  it("does not count an old session as a new login", async () => {
    state.claims!.amr = [{ method: "password", timestamp: secondsAgo(60 * 60) }];
    await call();
    expect(captured).toEqual([]);
  });

  it("does not count an anonymous session (that is a sign-up starting)", async () => {
    state.claims!.is_anonymous = true;
    await call();
    expect(captured).toEqual([]);
  });

  it("flags the first session of a brand-new account", async () => {
    state.user!.created_at = new Date(Date.now() - 60_000).toISOString();
    await call();
    expect(captured[0].props).toMatchObject({ new_account: true });
  });

  it("answers the same 204 to a signed-out caller, and sends nothing", async () => {
    state.claims = null;
    expect((await call()).status).toBe(204);
    expect(captured).toEqual([]);
  });
});
