/**
 * The Schools dashboard's tabs, given real URLs on the Schools origin.
 *
 * `schools.thebluestift.com/school` said nothing about where you were: nine
 * admin tabs and eight teacher tabs all shared one address, so a bookmark, a
 * link pasted to a colleague and the browser's Back button were all useless
 * inside the dashboard. Raya has this for free — its surfaces are separate
 * routes (/chat, /tools, /rooms) — and Schools does not, because it is
 * deliberately ONE component with tab state (docs/project-status.md).
 *
 * So the URLs are produced rather than routed: next.config.ts rewrites each
 * slug below to `/school?tab=<slug>`, conditioned on the Schools host, and the
 * dashboard writes the matching path back as the tab changes. Two consequences
 * worth stating:
 *
 *  - the rewrite is host-conditioned, so `/billing` is a Schools address and
 *    nothing at all on the apex or on Raya. A staff link copied out of the
 *    dashboard only resolves on the origin it came from;
 *  - a reload lands on the rewrite, which hands `?tab=` to the page, which
 *    seeds the tab. The address and the screen agree in both directions.
 */

/** Admin tabs ∪ teacher tabs. Both roles' keys, because one rewrite serves both
 *  and the page already picks the right dashboard by role. */
export const SCHOOL_TABS = [
  "overview",
  "manage",
  "classes",
  "team",
  "focus",
  "prepare",
  "insights",
  "raya",
  "reports",
  "archive",
  "billing",
  "settings",
] as const;

export type SchoolTab = (typeof SCHOOL_TABS)[number];

/** Must match app/school/layout.tsx's fallback title — pinned by a test. */
export const SCHOOLS_APP_NAME = "Bluestift Schools";

const LABELS: Record<SchoolTab, string> = {
  overview: "Overview",
  manage: "Classes",
  classes: "Classes",
  team: "Team",
  focus: "Focus",
  prepare: "Prepare",
  insights: "Insights",
  raya: "Raya",
  reports: "Reports",
  archive: "Archive",
  billing: "Billing",
  settings: "Settings",
};

export function isSchoolTab(value: string | null | undefined): value is SchoolTab {
  return !!value && (SCHOOL_TABS as readonly string[]).includes(value);
}

/**
 * The tab's tab title. "Settings" exists in Raya too and means something else
 * there — a student's own account, not a school's configuration — so the suffix
 * is what distinguishes them, exactly as it does for Tools and Rooms.
 */
export function schoolTabTitle(tab: string | null | undefined): string {
  return isSchoolTab(tab) ? `${LABELS[tab]} · ${SCHOOLS_APP_NAME}` : SCHOOLS_APP_NAME;
}

/**
 * True when this browser is on the Schools origin — the only place the slugs
 * are rewritten. Anywhere else (the apex today, every preview deploy, local
 * dev) they are not routes, so the dashboard falls back to `?tab=`, which the
 * page has always accepted.
 */
export function onSchoolsOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const configured = process.env.NEXT_PUBLIC_SCHOOLS_URL;
  if (!configured) return false;
  try {
    return new URL(configured).host === window.location.host;
  } catch {
    return false;
  }
}

/** Where the address bar should read for this tab, on this origin. */
export function schoolTabPath(tab: string): string {
  return onSchoolsOrigin() ? `/${tab}` : `/school?tab=${encodeURIComponent(tab)}`;
}
