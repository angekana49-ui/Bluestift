import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Licensing, until online payment is live: a school pays the founder directly
 * and the founder activates its plan. So a school admin can ASK for a licence
 * and can no longer GRANT one — before this, any admin_master could activate
 * any plan by declaring a payment nobody had seen.
 */

const state = {
  user: { id: "admin-1" } as { id: string } | null,
  founder: false,
  role: "admin_master" as string,
  allowed: true,
  inserted: [] as Record<string, unknown>[],
  activated: 0,
  emails: [] as { to: string; subject: string }[],
};

vi.mock("next/server", async (orig) => {
  const real = await orig<typeof import("next/server")>();
  // Run `after` work immediately so the test can see the founder's email.
  return { ...real, after: (fn: () => unknown) => void Promise.resolve().then(fn) };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/ops", () => ({ isPlatformOwner: async () => state.founder }));
vi.mock("@/lib/school-admin", () => ({
  getAdminMembership: async () => ({ schoolId: "school-1", schoolName: "Lycée Test", role: state.role }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkStrictUserRateLimit: async () => state.allowed }));
vi.mock("@/lib/billing", () => ({
  PAYMENT_METHODS: ["manual", "transfer"],
  getSchoolBilling: async () => ({
    seats: { used: 120, limit: null, remaining: null },
    history: [],
    plans: [{ id: "std", name: "Standard", price: 2, priceUnit: "per_seat", billingPeriod: "month" }],
  }),
  activateSubscription: async () => {
    state.activated++;
    return { ok: true, subscriptionId: "sub", expiresAt: new Date().toISOString() };
  },
  setPilotSeats: async () => null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createContentAdminClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        state.inserted.push(row);
        return { error: null };
      },
    }),
  }),
  createAdminClient: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: { id: "founder-1" } }),
      };
      return chain;
    },
  }),
}));
vi.mock("@/lib/email", () => ({
  getUserEmail: async (id: string) => (id === "founder-1" ? "founder@example.com" : "admin@school.example"),
  siteUrl: () => "https://schools.example",
  sendBrandedEmail: async (m: { to: string; subject: string }) => {
    state.emails.push({ to: m.to, subject: m.subject });
    return { ok: true };
  },
}));
vi.mock("@/lib/observability/report", () => ({ reportError: async () => {} }));
vi.mock("@/lib/i18n/server", () => ({ apiT: async (k: string) => k, getServerLocale: async () => "en" }));

const post = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  Object.assign(state, { user: { id: "admin-1" }, founder: false, role: "admin_master", allowed: true, inserted: [], activated: 0, emails: [] });
});

describe("a school cannot grant itself a plan", () => {
  const activate = async () =>
    (await import("@/app/api/school/billing/route")).POST(post({ planId: "std", paymentMethod: "transfer", months: 12 }));

  it("refuses the school's own admin", async () => {
    expect((await activate()).status).toBe(403);
    expect(state.activated).toBe(0);
  });

  it("still lets the founder activate", async () => {
    state.founder = true;
    expect((await activate()).status).toBe(200);
    expect(state.activated).toBe(1);
  });
});

describe("a school can ask for a licence", () => {
  const ask = async (body: unknown) => (await import("@/app/api/school/billing/request/route")).POST(post(body));

  it("records the request and tells the founder, with a total worked out on the server", async () => {
    const res = await ask({ planId: "std", seats: 150, months: 12, note: "Paiement par virement" });
    expect(res.status).toBe(200);
    await flush();
    expect(state.inserted).toHaveLength(1);
    const msg = String(state.inserted[0].message);
    expect(msg).toContain("Lycée Test");
    expect(msg).toContain("Students: 150");
    expect(msg).toContain("Paiement par virement");
    expect(state.inserted[0].source).toBe("form"); // content.contact_messages CHECK
    expect(state.emails).toEqual([{ to: "founder@example.com", subject: "Licence request — Lycée Test" }]);
    expect(state.activated).toBe(0);
  });

  it("never quotes fewer students than the school already has", async () => {
    await ask({ planId: "std", seats: 3, months: 1 });
    expect(String(state.inserted[0].message)).toContain("Students: 120");
  });

  it("is for the school's main admin only", async () => {
    state.role = "teacher";
    expect((await ask({ planId: "std" })).status).toBe(403);
    expect(state.inserted).toEqual([]);
  });

  it("refuses a plan that does not exist, and a flood", async () => {
    expect((await ask({ planId: "nope" })).status).toBe(400);
    state.allowed = false;
    expect((await ask({ planId: "std" })).status).toBe(429);
    expect(state.inserted).toEqual([]);
  });
});

describe("the Billing tab", () => {
  it("asks for a licence instead of recording a payment", () => {
    const src = readFileSync(join(process.cwd(), "components/school-billing.tsx"), "utf8");
    expect(src).toContain('"/api/school/billing/request"');
    expect(src).not.toMatch(/method: "POST"[\s\S]{0,200}paymentReference/);
  });
});
