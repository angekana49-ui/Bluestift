import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Redirect, Rewrite } from "next/dist/lib/load-custom-routes";
import { SCHOOL_TABS, SCHOOLS_APP_NAME, isSchoolTab, schoolTabTitle } from "@/lib/school-tabs";
import { crossOriginTarget, isPermanentMove, ownerOf, siteHomeFrom } from "@/lib/origins";

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

async function rewritesWith(env: Record<string, string>): Promise<Rewrite[]> {
  for (const k of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_RAYA_URL", "NEXT_PUBLIC_SCHOOLS_URL"]) {
    vi.stubEnv(k, env[k] ?? "");
  }
  vi.resetModules();
  const config = (await import("@/next.config")).default;
  const out = await config.rewrites?.();
  // A plain array is Next's `afterFiles` form, which is the one this config uses.
  return (Array.isArray(out) ? out : []) as Rewrite[];
}

afterEach(() => vi.unstubAllEnvs());

/**
 * The moves between origins (lib/origins.ts, run by proxy.ts).
 *
 * They used to be next.config redirects from the apex only, so nothing went the
 * other way: a pricing or legal link clicked inside Schools rendered the site's
 * page on schools.thebluestift.com, and the address bar named the wrong space.
 * The table is symmetric now. What matters more than the table itself: it must
 * be completely inert until the origins exist, and it must never be able to
 * send an origin to itself.
 */
describe("moves between origins", () => {
  const ALL = { NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_RAYA_URL: RAYA, NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS };
  const stub = (env: Record<string, string>) => {
    for (const k of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_RAYA_URL", "NEXT_PUBLIC_SCHOOLS_URL"]) {
      vi.stubEnv(k, env[k] ?? "");
    }
  };
  const at = (host: string, pathname: string, search = "") => crossOriginTarget({ host, pathname, search });

  it("does nothing while the product origins are unconfigured", () => {
    stub({});
    expect(at("thebluestift.com", "/school")).toBeNull();
    stub({ NEXT_PUBLIC_SITE_URL: SITE });
    expect(at("thebluestift.com", "/school")).toBeNull();
    expect(at("thebluestift.com", "/chat")).toBeNull();
  });

  it("never redirects a host it does not know — local dev, previews", () => {
    // .env.local carries the production URLs. localhost must still serve
    // everything itself, or every link in development jumps to production.
    stub(ALL);
    expect(at("localhost:3000", "/school")).toBeNull();
    expect(at("bluestift-git-branch.vercel.app", "/pricing")).toBeNull();
    expect(at(null as unknown as string, "/pricing")).toBeNull();
  });

  it("switches on per product, so one origin can move before the other", () => {
    stub({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS });
    expect(at("thebluestift.com", "/school")).toBe(`${SCHOOLS}/school`);
    expect(at("thebluestift.com", "/chat")).toBeNull();
  });

  it("never sends an origin to itself", () => {
    // A product var still pointing at the apex means that product has not moved.
    stub({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_RAYA_URL: SITE });
    expect(at("thebluestift.com", "/chat")).toBeNull();
    expect(at("thebluestift.com", "/pricing")).toBeNull();
    stub(ALL);
    expect(at("raya.thebluestift.com", "/chat")).toBeNull();
    expect(at("schools.thebluestift.com", "/school")).toBeNull();
    expect(at("thebluestift.com", "/pricing")).toBeNull();
  });

  it("sends each product path from the apex to its product, subpath and query kept", () => {
    stub(ALL);
    const owned: [string, string][] = [
      ["/chat", RAYA], ["/rooms", RAYA], ["/assignments", RAYA], ["/tools", RAYA], ["/profile", RAYA],
      ["/school", SCHOOLS],
    ];
    for (const [path, origin] of owned) {
      expect(at("thebluestift.com", path)).toBe(`${origin}${path}`);
      expect(at("thebluestift.com", `${path}/x/y`, "?a=1")).toBe(`${origin}${path}/x/y?a=1`);
    }
    expect(at("thebluestift.com", "/school/enter", "?as=admin")).toBe(`${SCHOOLS}/school/enter?as=admin`);
  });

  it("sends the site's pages home from either product — the bug this block is for", () => {
    stub(ALL);
    for (const host of ["schools.thebluestift.com", "raya.thebluestift.com"]) {
      for (const path of ["/pricing", "/research", "/research/some-post", "/contact", "/legal", "/privacy", "/terms", "/survey"]) {
        expect(at(host, path), `${host}${path}`).toBe(`${SITE}${path}`);
      }
    }
    // /s and /checkout belong to the site: the aggregator calls back one origin.
    expect(at("schools.thebluestift.com", "/checkout/return", "?pid=1")).toBe(`${SITE}/checkout/return?pid=1`);
    expect(at("raya.thebluestift.com", "/s/abc")).toBe(`${SITE}/s/abc`);
  });

  it("sends one product's paths to the other", () => {
    stub(ALL);
    expect(at("raya.thebluestift.com", "/school")).toBe(`${SCHOOLS}/school`);
    expect(at("schools.thebluestift.com", "/profile")).toBe(`${RAYA}/profile`);
    expect(at("schools.thebluestift.com", "/chat", "?c=1")).toBe(`${RAYA}/chat?c=1`);
  });

  it("matches whole path segments — /s is not /survey, /school is not /schoolbook", () => {
    stub(ALL);
    expect(ownerOf("/survey")).toBe("site");
    expect(ownerOf("/s")).toBe("site");
    expect(ownerOf("/subprocessors")).toBe("site");
    expect(ownerOf("/schoolbook")).toBeNull();
    expect(ownerOf("/chatter")).toBeNull();
  });

  it("leaves the account flow, the API and a product's bare root where they are", () => {
    stub(ALL);
    for (const path of ["/", "/login", "/onboarding", "/auth/callback", "/account", "/upgrade/confirm", "/reset", "/api/school/classes", "/ops/billing"]) {
      expect(ownerOf(path), path).toBeNull();
      expect(at("schools.thebluestift.com", path), path).toBeNull();
    }
  });

  it("is permanent only for the apex's old product paths", () => {
    stub(ALL);
    expect(isPermanentMove("thebluestift.com", `${SCHOOLS}/school`)).toBe(true);
    expect(isPermanentMove("thebluestift.com", `${RAYA}/chat`)).toBe(true);
    expect(isPermanentMove("schools.thebluestift.com", `${SITE}/pricing`)).toBe(false);
    expect(isPermanentMove("raya.thebluestift.com", `${SCHOOLS}/school`)).toBe(false);
  });

  it("points 'back to the site' at the site itself from a product origin", () => {
    stub(ALL);
    expect(siteHomeFrom("schools.thebluestift.com")).toBe(`${SITE}/`);
    expect(siteHomeFrom("raya.thebluestift.com")).toBe(`${SITE}/`);
    expect(siteHomeFrom("thebluestift.com")).toBe("/");
    expect(siteHomeFrom("localhost:3000")).toBe("/");
    stub({});
    expect(siteHomeFrom("schools.thebluestift.com")).toBe("/");
  });

  it("is run by the proxy, for reads only, and answers the router without a cross-origin redirect", () => {
    const proxy = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
    expect(proxy).toContain("crossOriginTarget(");
    expect(proxy).toMatch(/request\.method === "GET" \|\| request\.method === "HEAD"/);
    // A redirect to another origin is refused by CORS inside the router's fetch.
    expect(proxy).toMatch(/request\.headers\.has\("rsc"\)[\s\S]{0,200}status: 204/);
    // Before the nonce and the session refresh: a moved request costs nothing.
    expect(proxy.indexOf("crossOriginTarget(")).toBeLessThan(proxy.indexOf("makeNonce()"));
    expect(proxy.indexOf("crossOriginTarget(")).toBeLessThan(proxy.indexOf("updateSession("));
  });

  it("is not also written as a next.config redirect, which the router could not follow", async () => {
    const all = await allRedirectsWith(ALL);
    expect(all.filter((r) => /^https?:\/\//.test(r.destination))).toEqual([]);
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

  it("Home reaches the landing page and nothing else, from any origin", () => {
    stub(ALL);
    // On the site, `/` has no other owner, so nothing ever moves it.
    expect(ownerOf("/")).toBeNull();
    expect(at("thebluestift.com", "/")).toBeNull();
    // From a product origin `/` is that product's home, so Home must be absolute.
    expect(siteHomeFrom("schools.thebluestift.com")).toBe(`${SITE}/`);

    const navbar = readFileSync(join(process.cwd(), "components/site/Navbar.tsx"), "utf8");
    expect(navbar).toMatch(/\{ label: "Home", labelKey: "site\.nav\.home", href: "\/" \}/);
    expect(navbar).toMatch(/link\.label === "Home" \? siteHome : link\.href/);
    // The wordmark is the other way home, and must not keep a bare "/".
    // (Anchored on the attribute on its own line — a comment in the file quotes
    // `<a href="/">` while explaining the link.)
    expect(navbar).not.toMatch(/^\s*href="\/"\s*$/m);
    expect(navbar).toMatch(/^\s*href=\{siteHome\}\s*$/m);

    // And the landing never sends a signed-in visitor into the app: its only
    // redirects are the two auth fallbacks (?code= and ?error=).
    const page = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const redirects = page.match(/\bredirect\(/g) ?? [];
    expect(redirects).toHaveLength(2);
    expect(page).toMatch(/if \(code\) redirect\(/);
    expect(page).toMatch(/if \(error\) redirect\(/);
  });

  it("puts Feedback in the small-screen menu", () => {
    const navbar = readFileSync(join(process.cwd(), "components/site/Navbar.tsx"), "utf8");
    const extra = navbar.slice(navbar.indexOf("const MENU_EXTRA"), navbar.indexOf("];", navbar.indexOf("const MENU_EXTRA")));
    expect(extra).toContain('href: "/feedback"');
    expect(extra).toContain('href: "/legal"');
  });

  it("leaves the site's own paths alone on the site", () => {
    stub(ALL);
    // /s and /checkout stay on the apex — they are cross-product, and the
    // aggregator's webhook needs one stable origin (app/api/billing/checkout).
    for (const path of ["/", "/research", "/survey", "/pricing", "/s", "/checkout", "/login"]) {
      expect(at("thebluestift.com", path), path).toBeNull();
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
/**
 * The Schools dashboard's tabs, as addresses (lib/school-tabs.ts).
 *
 * Twelve very generic words — /team, /billing, /settings — turned into routable
 * paths. Everything here is about keeping that contained: to one origin, to
 * paths no real page wants, and off entirely until the origin exists.
 */
describe("Schools tab rewrites", () => {
  it("emits nothing while the Schools origin is unconfigured", async () => {
    // Today's state, and every preview deploy. Without this guard /billing and
    // /settings would become live paths on the single current origin.
    expect(await rewritesWith({ NEXT_PUBLIC_SITE_URL: SITE })).toEqual([]);
    expect(await rewritesWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_RAYA_URL: RAYA })).toEqual([]);
  });

  it("maps every tab to the dashboard, conditioned on the Schools host alone", async () => {
    const all = await rewritesWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS });
    expect(all.length).toBe(SCHOOL_TABS.length);
    for (const tab of SCHOOL_TABS) {
      expect(all).toContainEqual({
        source: `/${tab}`,
        destination: `/school?tab=${tab}`,
        has: [{ type: "host", value: "schools.thebluestift.com" }],
      });
    }
  });

  it("rewrites rather than redirects — the address bar is the whole point", async () => {
    const all = await rewritesWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS });
    // A redirect would put /school back in the address bar, which is the thing
    // being fixed. Rewrites carry no `permanent`/`statusCode`.
    for (const r of all) expect(r).not.toHaveProperty("permanent");
    const redirects = await allRedirectsWith({ NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_SCHOOLS_URL: SCHOOLS });
    expect(redirects.some((r) => SCHOOL_TABS.some((t) => r.source === `/${t}`))).toBe(false);
  });

  it("claims no path an actual route wants", () => {
    /**
     * These are `afterFiles` rewrites, so a real page at /settings would win and
     * the tab would simply stop resolving — no error, just a Schools tab that
     * 404s for staff and nobody else. Cheaper to fail here, when the route is
     * added, than to find it on the one origin that uses these paths.
     */
    const routes = readdirSync(join(process.cwd(), "app"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("("))
      .map((e) => e.name);
    const clashes = SCHOOL_TABS.filter((t) => routes.includes(t));
    expect(clashes, `slug also exists as app/<name>: ${clashes.join(", ")}`).toEqual([]);
  });

  it("covers both roles' tabs, since one rewrite serves admin and teacher alike", () => {
    const src = readFileSync(join(process.cwd(), "components/school-admin.tsx"), "utf8");
    // Pulled from the two unions in the component. A tab added there without a
    // slug here would work by click and 404 on reload — the worst shape, since
    // it only appears once someone shares the link.
    const declared = (name: string) =>
      (src.match(new RegExp(`const ${name}[^=]*=\\s*\\[([^\\]]*)\\]`, "s"))?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);

    for (const list of ["DASH_TABS", "PROF_TABS"]) {
      const tabs = declared(list);
      expect(tabs.length, `${list} not found`).toBeGreaterThan(3);
      for (const tab of tabs) {
        expect(SCHOOL_TABS as readonly string[], `${list} has "${tab}"`).toContain(tab);
      }
    }
  });
});

describe("each origin's surfaces name the space they belong to", () => {
  /**
   * Three spaces, and every signed-in route is inside exactly one of them:
   *
   *   Bluestift — the landing, on the apex. The umbrella, not an ecosystem.
   *   Raya      — the B2C space. Chat, Tools, Rooms, My Kernel, Assignments,
   *               Settings: surfaces OF Raya, not products beside it.
   *   Schools   — the B2B space, and everything inside /school with it.
   *
   * Read from source rather than by importing the modules: a route module pulls
   * its entire component graph, and what is being checked is one string
   * literal. `absolute` throughout, because the root layout's "%s · Bluestift"
   * template names the LANDING — appending it to a Raya surface would say the
   * page belongs to the marketing site.
   */
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  const SURFACES: [file: string, title: string][] = [
    ["app/chat/layout.tsx", "Raya"],
    ["app/tools/page.tsx", "Tools · Raya"],
    ["app/rooms/layout.tsx", "Rooms · Raya"],
    ["app/school/layout.tsx", "Bluestift Schools"],
  ];

  it.each(SURFACES)("%s titles itself %s", (file, title) => {
    expect(read(file)).toContain(`title: { absolute: "${title}" }`);
  });

  // Surfaces whose name is a word rather than a product name: translated, with
  // the space they belong to still spelled out after it.
  const TRANSLATED: [file: string, key: string][] = [
    ["app/profile/page.tsx", "nav.kernel"],
    ["app/assignments/page.tsx", "nav.assignments"],
    ["app/account/page.tsx", "nav.settings"],
  ];

  it.each(TRANSLATED)("%s titles itself with %s · Raya", (file, key) => {
    expect(read(file)).toContain(`title: { absolute: \`\${tr("${key}")} · Raya\` }`);
  });

  it("never leaves a surface on the bare umbrella name", () => {
    // The bug this whole block exists for: schools.thebluestift.com opened a
    // tab reading "Bluestift", indistinguishable from the marketing site.
    for (const [, title] of SURFACES) expect(title).not.toBe("Bluestift");
    // And every one of them says which space it is in.
    for (const [file, title] of SURFACES) {
      expect(/Raya|Schools/.test(title), file).toBe(true);
    }
  });

  it("covers /rooms/[id] too, which is why Rooms uses a layout", () => {
    // A title on app/rooms/page.tsx would cover the list and leave every actual
    // room — the tab held open longest — falling back to the umbrella.
    expect(existsSync(join(process.cwd(), "app/rooms/[id]/page.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/rooms/layout.tsx"))).toBe(true);
  });

  it("titles a Schools tab by name, and falls back to the space", () => {
    // What a bookmark of /billing renders server-side, and what the dashboard
    // writes client-side on a tab switch — one function, so they cannot drift.
    expect(schoolTabTitle("billing")).toBe(`Billing · ${SCHOOLS_APP_NAME}`);
    expect(schoolTabTitle("team")).toBe(`Team · ${SCHOOLS_APP_NAME}`);
    // "Settings" is the collision that made this worth doing: Raya has one too,
    // and it is a student's own account rather than a school's configuration.
    expect(schoolTabTitle("settings")).toBe(`Settings · ${SCHOOLS_APP_NAME}`);
    expect(schoolTabTitle("settings")).not.toBe("Settings · Raya");
    // A bare /school, or junk in ?tab=, names the space rather than inventing.
    expect(schoolTabTitle(null)).toBe(SCHOOLS_APP_NAME);
    expect(schoolTabTitle("../etc/passwd")).toBe(SCHOOLS_APP_NAME);
    expect(isSchoolTab("nope")).toBe(false);
  });

  it("keeps the layout's fallback title and the tab titles' suffix in step", () => {
    expect(SCHOOLS_APP_NAME).toBe("Bluestift Schools");
    expect(read("app/school/layout.tsx")).toContain(`title: { absolute: "${SCHOOLS_APP_NAME}" }`);
  });

  it("gives Schools a name without giving it a second install identity", () => {
    // Raya overrides manifest/icons/appleWebApp because it IS a separate
    // installable app. Schools is not: lib/manifest.ts states the split as "a
    // student installs Raya; a school installs Bluestift", and
    // lib/launch-screens.ts names the Bluestift bird as Schools' own artwork.
    // A third identity on the same icon set would contradict both — and
    // test/pwa-manifest.test.ts pins that no two apps share an icon set.
    const school = read("app/school/layout.tsx");
    for (const field of ["manifest:", "icons:", "appleWebApp:"]) {
      expect(school, `Schools declares ${field}`).not.toContain(field);
    }
  });
});
