"use client";

import type { Theme } from "./theme";
import { RayaText } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/**
 * Where the product actually stands — shipped / in progress / coming.
 *
 * This used to be a landing-page section. It moved to /research?tab=progress
 * because it is a changelog, not an argument: it belongs next to the other
 * things we publish about the project, where it can be updated without
 * touching the sales page.
 *
 * It is a promise to stay honest, so it has a maintenance cost: it must track
 * `docs/project-status.md`, not aspiration. Two things are deliberately NOT
 * listed as shipped even though the code for them exists: live payment
 * acquiring (the aggregator runs end to end in sandbox only) and the real
 * Kernel-side trajectory simulation (today's profile curve is a model-guided
 * estimate). Moving either into "Shipped" requires the actual switch-on, not a
 * merge.
 */

type Status = "shipped" | "progress" | "coming";

/**
 * When this list was last checked against the code.
 *
 * A changelog with no date cannot be audited: a reader has no way to tell
 * whether "in progress" was written last week or last year, and an undated
 * status page ages into a liability precisely because nothing on it looks
 * stale. Bump it whenever ITEMS changes — the two live together so that
 * editing one without the other reads as an oversight.
 */
export const ROADMAP_UPDATED = "26 August 2026";

/**
 * Display order is THIS ARRAY, not the key numbers. The i-numbers are the order
 * items were written, so a new entry that belongs in the middle keeps its own
 * number rather than renumbering four locales for nothing.
 */
const ITEMS: {
  status: Status;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  /**
   * An entry whose status and closing clauses are READ OFF THE DEPLOYMENT
   * rather than typed above. `status` and `bodyKey` are then the pre-launch
   * state — what this item says when the thing it describes is not switched on.
   */
  live?: "payments";
}[] = [
  { status: "shipped", titleKey: "site.roadmap.i1.title", bodyKey: "site.roadmap.i1.body" },
  { status: "shipped", titleKey: "site.roadmap.i2.title", bodyKey: "site.roadmap.i2.body" },
  { status: "shipped", titleKey: "site.roadmap.i3.title", bodyKey: "site.roadmap.i3.body" },
  // The service worker shipped in 9ed2576 and the FAQ already answers "does it
  // work on a weak connection?" with it. It was the one piece of the product
  // being sold on the landing page and missing from the page that lists what
  // exists — which is the only page where an omission costs anything.
  { status: "shipped", titleKey: "site.roadmap.i8.title", bodyKey: "site.roadmap.i8.body" },
  // The one entry on this page that used to be able to go stale on its own.
  // "Live acquiring isn't switched on" and "the limits do not turn anyone away"
  // were both hand-written, and both stop being true the afternoon somebody
  // adds the provider keys to an environment — silently, on the page whose
  // whole value is that it would have told them. It reads them instead.
  { status: "progress", titleKey: "site.roadmap.i4.title", bodyKey: "site.roadmap.i4.body", live: "payments" },
  { status: "progress", titleKey: "site.roadmap.i5.title", bodyKey: "site.roadmap.i5.body" },
  // LMS sync was listed "Coming" while the integration was finished: OAuth
  // start/callback, token refresh, course + roster import and the admin UI all
  // exist (lib/lms/google.ts, app/api/school/lms/google/*, school-lms.tsx).
  // Understating it was not the safe error it looks like — the FAQ and both
  // pricing surfaces sell LMS sync in the present tense, so the one page
  // published as the honest account was the one contradicting them. It has the
  // same shape as payments: complete, waiting on credentials.
  { status: "progress", titleKey: "site.roadmap.i6.title", bodyKey: "site.roadmap.i6.body" },
  // Moved here from the Max pricing card, where it was sold as if it existed.
  // A planned feature belongs on the roadmap; the difference between the two
  // pages is exactly that this one is allowed to promise.
  { status: "coming", titleKey: "site.roadmap.i7.title", bodyKey: "site.roadmap.i7.body" },
];

const STATUS_KEY: Record<Status, MessageKey> = {
  shipped: "site.roadmap.status.shipped",
  progress: "site.roadmap.status.progress",
  coming: "site.roadmap.status.coming",
};

export default function RoadmapTimeline({
  theme: t,
  /** Colour behind the rail, used as the halo around each dot so the line
   *  appears to pass under it. Whatever surface the timeline is sitting on. */
  ringColor,
  /** `billingIsLive()` — a real payment provider is configured. */
  paymentsLive = false,
  /** `ENTITLEMENTS_ENFORCE` — the published plan limits refuse rather than log. */
  quotasEnforced = false,
}: {
  theme: Theme;
  ringColor?: string;
  paymentsLive?: boolean;
  quotasEnforced?: boolean;
}) {
  const tr = useTranslate();
  const ring = ringColor ?? t.cardBg;

  /**
   * Both halves of "Payments & quotas", each stated from the deployment.
   *
   * They are two independent facts, not one — enforcement can be held down by
   * hand on a live deployment for a demo — so they get a clause each rather
   * than one sentence chosen from a pair, which could only ever be right about
   * one of them at a time. "Shipped" needs both.
   */
  const resolve = (item: (typeof ITEMS)[number]): { status: Status; body: string } => {
    if (item.live !== "payments") return { status: item.status, body: tr(item.bodyKey) };
    return {
      status: paymentsLive && quotasEnforced ? "shipped" : item.status,
      body: [
        tr(item.bodyKey),
        tr(paymentsLive ? "site.roadmap.i4.pay.live" : "site.roadmap.i4.pay.sandbox"),
        tr(quotasEnforced ? "site.roadmap.i4.quota.enforcing" : "site.roadmap.i4.quota.counting"),
      ].join(" "),
    };
  };

  const inProgressBg = t.dark ? "rgba(78,155,245,0.14)" : "rgba(23,61,138,0.1)";
  const inProgressText = t.dark ? "#7ab3f7" : "#173d8a";
  const railColor = t.dark ? "#4e9bf5" : "#173d8a";

  const pill = (status: Status) => {
    const style =
      status === "shipped"
        ? { background: t.greenBg, color: t.greenText, border: `1px solid ${t.greenBorder}` }
        : status === "progress"
          ? { background: inProgressBg, color: inProgressText, border: `1px solid ${inProgressBg}` }
          : { background: t.crossBg, color: t.crossText, border: `1px solid ${t.cardBorder}` };
    return (
      <span style={{ ...style, display: "inline-block", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {tr(STATUS_KEY[status])}
      </span>
    );
  };

  return (
    <ol style={{ listStyle: "none", margin: 0, padding: "4px 0 0 26px", borderLeft: `1px solid ${t.cardBorder}` }}>
      {ITEMS.map((item, i) => {
        const { status, body } = resolve(item);
        return (
        <li key={item.titleKey} style={{ position: "relative", paddingBottom: i === ITEMS.length - 1 ? 0 : 34 }}>
          <span
            style={{
              position: "absolute",
              left: -31,
              top: 6,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: railColor,
              boxShadow: `0 0 0 4px ${ring}`,
            }}
          />
          {pill(status)}
          <p style={{ margin: "12px 0 0", fontWeight: 700, fontSize: 18, color: t.text }}>
            <RayaText>{tr(item.titleKey)}</RayaText>
          </p>
          <p style={{ margin: "5px 0 0", fontSize: 14.5, color: t.muted, lineHeight: 1.65 }}>
            <RayaText>{body}</RayaText>
          </p>
        </li>
        );
      })}
    </ol>
  );
}
