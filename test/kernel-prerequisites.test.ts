import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "Why am I stuck?" — the Kernel's /prerequisite_gaps for the signed-in learner.
 * The route must ask about the caller and nobody else, on their own token, and
 * tell an unknown concept (an answer) from a failure (an error state).
 */

class FakeKernelError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const state = {
  user: { id: "u1" } as { id: string } | null,
  calls: [] as { payload: Record<string, unknown>; opts: Record<string, unknown> }[],
  impl: async (): Promise<unknown> => ({ target: "derivation_fonction", gaps: [], frontier: [], max_hops: 4, truncated: false, resources_available: false }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      getSession: async () => ({ data: { session: { access_token: "student-token" } } }),
    },
  }),
}));
vi.mock("@/lib/compliance/api-gate", () => ({ ageGateResponse: async () => null }));
vi.mock("@/lib/abuse-limits", () => ({ limitExpensive: async () => null }));
vi.mock("@/lib/observability/report", () => ({ reportError: async () => {} }));
vi.mock("@/lib/kernel/client", () => ({
  KernelError: FakeKernelError,
  kernel: {
    prerequisiteGaps: async (payload: Record<string, unknown>, opts: Record<string, unknown>) => {
      state.calls.push({ payload, opts });
      return state.impl();
    },
  },
}));

const call = async (qs: string) =>
  (await import("@/app/api/kernel/prerequisites/route")).GET(new Request(`http://x/api/kernel/prerequisites${qs}`));

beforeEach(() => {
  state.user = { id: "u1" };
  state.calls = [];
});

describe("GET /api/kernel/prerequisites", () => {
  it("asks about the signed-in learner, on their own token, whatever the query says", async () => {
    const res = await call("?concept=derivation_fonction&user_id=someone-else");
    expect(res.status).toBe(200);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].payload).toMatchObject({ user_id: "u1", concept_label: "derivation_fonction", max_hops: 4 });
    expect(state.calls[0].opts).toMatchObject({ accessToken: "student-token" });
  });

  it("answers an unknown concept as notFound, not as an error", async () => {
    state.impl = async () => {
      throw new FakeKernelError("not found", 404);
    };
    const res = await call("?concept=inconnu");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notFound: true });
  });

  it("fails loudly when the Kernel does, so the page shows an error and not an empty list", async () => {
    state.impl = async () => {
      throw new FakeKernelError("down", 503);
    };
    expect((await call("?concept=x")).status).toBe(502);
  });

  it("refuses a signed-out caller and a missing concept", async () => {
    expect((await call("")).status).toBe(400);
    state.user = null;
    expect((await call("?concept=x")).status).toBe(401);
    expect(state.calls).toEqual([]);
  });
});

describe("what the learner sees", () => {
  const src = readFileSync(join(process.cwd(), "components/kernel-why-stuck.tsx"), "utf8");

  it("keeps the Kernel's teaching order and says when the list is cut", () => {
    expect(src).toContain("{gaps.map((g) =>");
    expect(src).not.toMatch(/gaps\.(slice\(\)\.)?sort|\[\.\.\.gaps\]\.sort/);
    expect(src).toContain('tr("kernel.why.partial", { hops: max_hops })');
    // "Nothing missing" only when the list was NOT cut.
    expect(src).toMatch(/!truncated && \(\s*<p/);
  });

  it("shows an error, never an empty list, when the Kernel did not answer", () => {
    expect(src).toContain('state.kind === "error"');
    expect(src).toContain('tr("kernel.why.error")');
  });

  it("is offered on concepts being worked on, not on ones never assessed", () => {
    const card = readFileSync(join(process.cwd(), "components/cognitive-profile.tsx"), "utf8");
    expect(card).toContain('(c.status === "gap" || c.status === "partial") && <WhyStuck label={c.label} />');
  });

  it("hands Raya a first message the learner sends themselves", () => {
    const chat = readFileSync(join(process.cwd(), "components/chat/chat-surface.tsx"), "utf8");
    expect(chat).toContain('url.searchParams.get("ask")');
    expect(chat).toContain("setInput(ask.slice(0, 500));");
    // Written into the composer, never sent on the learner's behalf.
    const effect = chat.slice(chat.indexOf('url.searchParams.get("ask")'), chat.indexOf("}, []);", chat.indexOf('url.searchParams.get("ask")')));
    expect(effect).not.toMatch(/onSend\(/);
  });
});
