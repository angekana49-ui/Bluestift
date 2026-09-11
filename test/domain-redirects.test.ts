import { describe, it, expect, vi, afterEach } from "vitest";
import type { Redirect } from "next/dist/lib/load-custom-routes";

/**
 * The apex → product-origin 308s (docs/domains.md). Two properties matter more
 * than the routing table itself: they must be COMPLETELY inert until the
 * product origins exist, and they must never be able to send an origin to
 * itself — a loop here would be served to the product's own users on migration
 * day, which is the worst possible moment to discover it.
 */

const SITE = "https://thebluestift.com";
const RAYA = "https://raya.thebluestift.com";
const SCHOOLS = "https://schools.thebluestift.com";

async function allRedirectsWith(env: Record<string, string>): Promise<Redirect[]> {
  for (const k of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_RAYA_URL", "NEXT_PUBLIC_SCHOOLS_URL"]) {
    vi.stubEnv(k, env[k] ?? "");
  }
  vi.resetModules();
  const config = (await import("@/next.config")).default;
  return ((await config.redirects?.()) ?? []) as Redirect[];
}

/**
 * Only the CROSS-ORIGIN rules — the ones this file is about.
 *
 * `redirects()` also carries same-origin path renames (/homework →
 * /assignments), which are a different class entirely: they have no product
 * origin to switch on, no host to condition on, and no loop to avoid. Folding
 * them into the assertions below would make "emits nothing until the origins
 * exist" quietly false for a reason that has nothing to do with the property.
 * A cross-origin destination is absolute; a rename's is a path.
 */
async function redirectsWith(env: Record<string, string>): Promise<Redirect[]> {
  return (await allRedirectsWith(env)).filter((r) => /^https?:\/\//.test(r.destination));
}

afterEach(() => vi.unstubAllEnvs());

describe("apex redirects", () => {
  it("emits nothing while the product origins are unconfigured", async () => {
    // The state of the repo today. Setting the site URL alone must not start
    // redirecting traffic to origins that do not answer yet.
    expect(await redirectsWith({})).toEqual([]);
    expect(await redirectsWith({ NEXT_PUBLIC_SITE_URL: SITE })).toEqual([]);
  });

  it("emits nothing without an apex to anchor the host condition", async () => {
    // No apex means no way to tell the apex from the product origin, which is
    // exactly the loop below. Silence is the only safe output.
    expect(await redirectsWith({ NEXT_PUBLIC_RAYA_URL: RAYA })).toEqual([]);
  });

  it("switches on per product, so one origin can move before the other", async () => {
    const rules = await redirectsWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS });
    expect(rules.every((r) => r.destination.startsWith(SCHOOLS))).toBe(true);
    expect(rules.some((r) => r.source === "/school")).toBe(true);
    expect(rules.some((r) => r.source.startsWith("/chat"))).toBe(false);
  });

  it("never sends an origin to itself", async () => {
    // A product var still pointing at the apex means that product has not
    // moved. Emitting the rule anyway is a redirect loop.
    const rules = await redirectsWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_RAYA_URL: SITE });
    expect(rules).toEqual([]);
  });

  it("fires only on the apex host, so the product does not redirect to itself", async () => {
    const rules = await redirectsWith({
      NEXT_PUBLIC_SITE_URL: SITE,
      NEXT_PUBLIC_RAYA_URL: RAYA,
      NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS,
    });
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(r.has).toEqual([{ type: "host", value: "thebluestift.com" }]);
    }
  });

  it("covers each product path bare and with a subpath, and is permanent", async () => {
    const rules = await redirectsWith({
      NEXT_PUBLIC_SITE_URL: SITE,
      NEXT_PUBLIC_RAYA_URL: RAYA,
      NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS,
    });
    const owned: [string, string][] = [
      ["/chat", RAYA], ["/rooms", RAYA], ["/assignments", RAYA], ["/tools", RAYA], ["/profile", RAYA],
      ["/school", SCHOOLS],
    ];
    for (const [path, origin] of owned) {
      // Bare, because `/chat/:rest*` does not match `/chat`.
      expect(rules).toContainEqual(
        expect.objectContaining({ source: path, destination: `${origin}${path}`, permanent: true }),
      );
      // And deeper, carrying the rest of the path through.
      expect(rules).toContainEqual(
        expect.objectContaining({
          source: `${path}/:rest*`,
          destination: `${origin}${path}/:rest*`,
          permanent: true,
        }),
      );
    }
    expect(rules).toHaveLength(owned.length * 2);
  });

  it("keeps the /homework rename alive regardless of the origin split", async () => {
    // A same-origin rename, so it must fire in EVERY configuration — including
    // the repo's current one, where no product origin is set and the
    // cross-origin rules are silent. Links to /homework are already in the wild
    // (a bookmark, an installed PWA shortcut) and outlive the rename.
    const envs: Record<string, string>[] = [
      {},
      { NEXT_PUBLIC_SITE_URL: SITE },
      { NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_RAYA_URL: RAYA },
    ];
    for (const env of envs) {
      const all = await allRedirectsWith(env);
      const bare = all.find((r) => r.source === "/homework");
      expect(bare, JSON.stringify(env)).toMatchObject({ destination: "/assignments", permanent: true });
      expect(all.some((r) => r.source === "/homework/:rest*")).toBe(true);
    }
  });

  it("leaves the site's own paths alone", async () => {
    const rules = await redirectsWith({
      NEXT_PUBLIC_SITE_URL: SITE,
      NEXT_PUBLIC_RAYA_URL: RAYA,
      NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS,
    });
    // /s and /checkout stay on the apex — they are cross-product, and the
    // aggregator's webhook needs one stable origin (app/api/billing/checkout).
    for (const path of ["/", "/research", "/survey", "/pricing", "/s", "/checkout", "/login"]) {
      expect(rules.some((r) => r.source === path)).toBe(false);
    }
  });
});

/**
 * The bare root of a product origin (raya./schools.), found live to be
 * serving the marketing landing page instead of that product — because `/`
 * is the same route on every origin, and nothing sent the bare root anywhere
 * product-specific. These rules have a RELATIVE destination (`/chat`,
 * `/school`), so they never show up in `redirectsWith`'s cross-origin filter
 * above — asserted with `allRedirectsWith` instead, same as the /homework
 * rename.
 */
describe("product home redirects (bare root of a product origin)", () => {
  it("emits nothing while the product origins are unconfigured", async () => {
    const all = await allRedirectsWith({ NEXT_PUBLIC_SITE_URL: SITE });
    expect(all.some((r) => r.source === "/" && r.destination === "/chat")).toBe(false);
    expect(all.some((r) => r.source === "/" && r.destination === "/school")).toBe(false);
  });

  it("sends each product's bare root to that product's home, conditioned on ITS OWN host", async () => {
    const all = await allRedirectsWith({
      NEXT_PUBLIC_SITE_URL: SITE,
      NEXT_PUBLIC_RAYA_URL: RAYA,
      NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS,
    });
    expect(all).toContainEqual(
      expect.objectContaining({
        source: "/",
        destination: "/chat",
        permanent: false,
        has: [{ type: "host", value: "raya.thebluestift.com" }],
      }),
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        source: "/",
        destination: "/school",
        permanent: false,
        has: [{ type: "host", value: "schools.thebluestift.com" }],
      }),
    );
  });

  it("switches on per product, independently of the other", async () => {
    const all = await allRedirectsWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_RAYA_URL: RAYA });
    expect(all.some((r) => r.source === "/" && r.destination === "/chat")).toBe(true);
    expect(all.some((r) => r.source === "/" && r.destination === "/school")).toBe(false);
  });

  it("is temporary (307), not permanent — a browser must not cache it past a future fix", async () => {
    const all = await allRedirectsWith({
      NEXT_PUBLIC_SITE_URL: SITE,
      NEXT_PUBLIC_RAYA_URL: RAYA,
      NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS,
    });
    const home = all.filter((r) => r.source === "/" && (r.destination === "/chat" || r.destination === "/school"));
    expect(home.length).toBe(2);
    expect(home.every((r) => r.permanent === false)).toBe(true);
  });
});

/**
 * The other half of "each origin is its own product": what the tab says once
 * you are there.
 *
 * The redirects above land `raya.` on /chat and `schools.` on /school, and for
 * a while only the first of those named itself — schools.thebluestift.com
 * opened a tab reading "Bluestift", the same string the marketing site shows,
 * on the one origin whose entire purpose is the staff product.
 */
describe("each product origin's home names its own product", () => {
  it("titles /chat and /school absolutely, not through the shared template", async () => {
    const chat = (await import("@/app/chat/layout")).metadata;
    const school = (await import("@/app/school/layout")).metadata;
    // A plain string would come out "Raya · Bluestift" / "Schools · Bluestift"
    // via the root layout's template. These are product names, not pages
    // inside something else.
    expect(chat.title).toEqual({ absolute: "Raya" });
    expect(school.title).toEqual({ absolute: "Bluestift Schools" });
  });

  it("gives Schools a title without giving it a second install identity", async () => {
    // Raya overrides manifest/icons/appleWebApp because it IS a separate
    // installable app. Schools is not: lib/manifest.ts states the split as "a
    // student installs Raya; a school installs Bluestift", and
    // lib/launch-screens.ts names the Bluestift bird as Schools' artwork.
    // Adding a third identity on the same icon set would contradict both — and
    // test/pwa-manifest.test.ts pins that no two apps share an icon set.
    const school = (await import("@/app/school/layout")).metadata;
    expect(school.manifest).toBeUndefined();
    expect(school.icons).toBeUndefined();
    expect(school.appleWebApp).toBeUndefined();
  });
});
