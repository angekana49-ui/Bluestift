import type { CSSProperties, ReactNode } from "react";
import type { Theme } from "./theme";
import { RayaName, SchoolsName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import {
  IconBilling,
  IconChat,
  IconClasses,
  IconKernel,
  IconOverview,
  IconRooms,
  IconSettings,
  IconSummary,
} from "@/components/ui/icons";

/**
 * The Schools dashboard, as it appears in the hero.
 *
 * This is a MOCKUP, not a capture: the figures are invented and generous, the
 * way a product shot's figures always are. What is not free to be invented is
 * the *shape*. A drawing whose job is "this is what Schools looks like" fails
 * the moment a visitor opens the product and finds a different application —
 * and the browser frame around it (see DeviceFrame) makes that promise louder,
 * not quieter.
 *
 * So everything structural below is traced from the real admin dashboard:
 *
 *  - the left sidebar and its eight nav items, in order, with the same icons
 *    (`navItems` in components/school-admin.tsx, the admin branch)
 *  - the four KPI tiles and their labels — Students / Active (7d) / Struggling
 *    / Average mastery (`OverviewView`)
 *  - the "{school} · by class" list, which is what the overview actually
 *    renders (`OverviewClassRow`): counts, an alert pill, a mastery bar
 *  - the right panel: mastery gauge, then Alerts, then the weakest classes
 *    (`OverviewRightPanel`)
 *
 * An earlier version of this file drew a horizontal tab bar (Overview /
 * Sessions / Students / Kernel) over a six-month "Sessions vs. mastery"
 * histogram. None of it existed: the app has no tab bar, no sessions counter
 * and no monthly chart. It read as a generic SaaS dashboard, which is the one
 * thing this image must not do.
 *
 * If the admin nav or the overview gains a surface, this drawing is a public
 * claim about the product and has to move with it.
 */

/**
 * Stagger, as an inline custom property the stylesheet reads as an
 * animation-delay (see .pub-hero-* in globals.css). Same device as the product
 * shots use, so one sequence can be written as numbers at the call site and
 * read as a score, rather than as a pile of nth-child rules in the stylesheet.
 */
const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** The admin sidebar, item for item. "Classes & codes" is the real label — the
 *  tab manages both — and LMS stays absent here because it is hidden in the
 *  app until the Google OAuth integration is provisioned. */
const NAV: { key: string; labelKey?: MessageKey; label?: ReactNode; icon: ReactNode }[] = [
  { key: "overview", labelKey: "nav.overview", icon: <IconOverview size={15} /> },
  { key: "manage", labelKey: "nav.classesCodes", icon: <IconClasses size={15} /> },
  { key: "team", labelKey: "nav.team", icon: <IconRooms size={15} /> },
  { key: "insights", labelKey: "nav.insights", icon: <IconKernel size={15} /> },
  { key: "raya", label: <RayaName />, icon: <IconChat size={15} /> },
  { key: "reports", labelKey: "nav.reports", icon: <IconSummary size={15} /> },
  { key: "billing", labelKey: "nav.billing", icon: <IconBilling size={15} /> },
  { key: "settings", labelKey: "nav.settings", icon: <IconSettings size={15} /> },
];

const SCHOOL = "Northgate Academy";

const TOTALS = { students: 1204, active: 482, alerts: 47, mastery: 0.83 };

const CLASSES: { id: string; yearKey: MessageKey; subjectKey: MessageKey; students: number; active: number; alerts: number; mastery: number }[] = [
  { id: "maths9", yearKey: "shot.year.9", subjectKey: "shot.subject.mathematics", students: 128, active: 96, alerts: 3, mastery: 0.88 },
  { id: "physics10", yearKey: "shot.year.10", subjectKey: "onb.subject.physics", students: 112, active: 74, alerts: 12, mastery: 0.71 },
  { id: "french8", yearKey: "shot.year.8", subjectKey: "shot.subject.french", students: 141, active: 103, alerts: 0, mastery: 0.61 },
  { id: "biology11", yearKey: "shot.year.11", subjectKey: "onb.subject.biology", students: 96, active: 88, alerts: 0, mastery: 0.84 },
];

/** The app's own thresholds (`masteryColor` in components/school-admin.tsx). */
const masteryColor = (m: number) => (m >= 0.7 ? "#22c55e" : m >= 0.5 ? "#f59e0b" : "#ef4444");
const pct = (m: number) => `${Math.round(m * 100)}%`;

export default function DashboardMockup({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const panel: CSSProperties = { border: `1px solid ${t.cardBorder}`, borderRadius: 18, padding: 14 };
  const panelTitle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: t.muted,
    marginBottom: 10,
  };

  // One tile used to carry an infinite `shine` sweep. It drew the eye to the
  // tile with the least to say, forever, and made a static dashboard look like
  // a loading skeleton. The tiles are now plain — the numbers are the content.
  const statTile = (label: string, value: string, delay: number) => (
    <div
      className="pub-hero-tile"
      style={{
        ...at(delay),
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 16,
        background: t.inputFieldBg,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 13, color: t.muted }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    // Edge, elevation and radius belong to the BrowserFrame this is rendered
    // inside (see HeroSection) — carrying its own as well drew two borders a
    // pixel apart and stacked two shadows, which is the tell that a mockup was
    // assembled rather than captured.
    <div style={{ display: "flex", background: t.cardBg, textAlign: "left" }}>
      {/* ── Sidebar ───────────────────────────────────────────────────────
          Hidden below 760px, in step with `.dash-grid` collapsing: the real
          shell turns this into an overlay drawer at its own breakpoint, and a
          194px rail inside an already-narrow drawing would leave the content
          with nothing. */}
      <aside
        className="pub-dash-aside"
        style={{
          width: 194,
          flex: "none",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "14px 12px",
          background: t.inputFieldBg,
          borderRight: `1px solid ${t.cardBorder}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "2px 8px 14px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.dark ? "/bluestift-mark-dark.png" : "/bluestift-mark.png"}
            alt=""
            style={{ width: 26, height: 26, borderRadius: 8, objectFit: "cover", flex: "none" }}
          />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>
            <SchoolsName />
          </span>
        </div>

        {NAV.map((n) => {
          const active = n.key === "overview";
          return (
            <div
              key={n.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 10,
                padding: "7px 9px",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? t.text : t.mutedLight,
                background: active ? t.cardBg : "transparent",
                border: `1px solid ${active ? t.cardBorder : "transparent"}`,
              }}
            >
              {n.icon}
              {n.label ?? tr(n.labelKey!)}
            </div>
          );
        })}

        {/* The profile chip pinned to the foot of the rail — the signed-in
            person and their school's plan, exactly as SidebarProfile shows it. */}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 9, paddingTop: 14 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#2f7fe0",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            AD
          </span>
          <span style={{ minWidth: 0, lineHeight: 1.3 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>Amina Diallo</span>
            <span style={{ display: "block", fontSize: 12, color: t.mutedLight }}>{tr("dm.schoolPlan")}</span>
          </span>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── Header ──────────────────────────────────────────────────────
            The header brands the SCHOOL (logo + name), the sidebar brands the
            product. That split is the real shell's, and it is the reason the
            wordmark isn't repeated here. */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, borderBottom: `1px solid ${t.cardBorder}`, padding: "13px 18px" }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "#2f7fe0",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            NA
          </span>
          <span style={{ minWidth: 0, lineHeight: 1.25 }}>
            <span style={{ display: "block", fontSize: 17, fontWeight: 800, fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif" }}>{SCHOOL}</span>
            <span style={{ display: "block", fontSize: 13, color: t.muted, fontWeight: 500 }}>{tr("nav.overview")}</span>
          </span>
        </div>

        <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1.75fr 1fr", gap: 16, padding: 18 }}>
          {/* Left column */}
          <div style={{ minWidth: 0 }}>
            {/* The score starts at 700ms — while the frame's own rise (which
                settles at 860ms) is still finishing, so the two read as one
                arrival rather than as two waits. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
              {statTile(tr("dm.students"), TOTALS.students.toLocaleString("en-US"), 700)}
              {statTile(tr("dm.activeWeek"), TOTALS.active.toLocaleString("en-US"), 760)}
              {statTile(tr("dm.struggling"), String(TOTALS.alerts), 820)}
              {statTile(tr("dm.avgMastery"), pct(TOTALS.mastery), 880)}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>{SCHOOL} · {tr("dm.byClass")}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CLASSES.map((c, i) => (
                <div
                  key={c.id}
                  className="pub-hero-tile"
                  style={{ ...at(920 + i * 70), ...panel, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tr(c.yearKey)} · {tr(c.subjectKey)}
                    </div>
                    <div style={{ fontSize: 13, color: t.mutedLight }}>
                      {c.students} {tr("dm.studentsWord")} · {c.active} {tr("dm.activeWord")}
                    </div>
                  </div>

                  {c.alerts > 0 && (
                    <span
                      className="pub-hide-sm"
                      style={{
                        flex: "none",
                        background: t.dark ? "#3a1a1a" : "#fee2e2",
                        color: "#dc2626",
                        borderRadius: 999,
                        padding: "2px 9px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {c.alerts} {tr("dm.alertsWord")}
                    </span>
                  )}

                  <span style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    <span style={{ display: "block", width: 62, height: 6, borderRadius: 99, background: t.dark ? "rgba(255,255,255,0.10)" : "#e2e8f0", overflow: "hidden" }}>
                      <span
                        className="pub-hero-fill"
                        style={{ ...at(980 + i * 70), display: "block", width: pct(c.mastery), height: "100%", background: masteryColor(c.mastery) }}
                      />
                    </span>
                    <span style={{ fontSize: 13, width: 34, textAlign: "right" }}>{pct(c.mastery)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — the overview's right panel, in its real order. */}
          <div className="pub-hide-sm" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <div style={panel}>
              <div style={panelTitle}>{tr("dm.kernelMasteryTitle")}</div>
              <svg viewBox="0 0 160 96" style={{ width: "100%", display: "block" }}>
                <defs>
                  <linearGradient id="kernelGaugeFill" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="45%" stopColor="#fbbf24" />
                    <stop offset="75%" stopColor="#84cc16" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <path d="M 20 84 A 60 60 0 0 1 140 84" fill="none" stroke={t.dark ? "rgba(255,255,255,0.10)" : "#e2e8f0"} strokeWidth="12" strokeLinecap="round" />
                {/* 188 is the arc's full dasharray, so the offset is the app's
                    own `188 * (1 - avgMastery)` — not a hand-picked number. */}
                <path
                  className="pub-hero-gauge"
                  d="M 20 84 A 60 60 0 0 1 140 84"
                  fill="none"
                  stroke="url(#kernelGaugeFill)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="188"
                  strokeDashoffset={Math.round(188 * (1 - TOTALS.mastery))}
                />
                <text x="80" y="64" textAnchor="middle" fontSize="22" fontWeight="700" fill={t.text}>
                  {pct(TOTALS.mastery)}
                </text>
                <text x="80" y="79" textAnchor="middle" fontSize="8" fill={t.mutedLight}>
                  {TOTALS.students.toLocaleString("en-US")} {tr("dm.studentsTracked")}
                </text>
              </svg>
            </div>

            <div style={panel}>
              <div style={panelTitle}>{tr("dm.alertsTitle")}</div>
              <div style={{ background: t.inputFieldBg, borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{TOTALS.alerts} {tr("dm.studentsStruggling")}</div>
                <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{TOTALS.active} {tr("dm.activeOver7Days")}</div>
              </div>
            </div>

            <div style={panel}>
              <div style={panelTitle}>{tr("dm.needsAttention")}</div>
              {[...CLASSES]
                .sort((a, b) => a.mastery - b.mastery)
                .slice(0, 2)
                .map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, marginTop: 6 }}>
                    <span style={{ flex: 1, minWidth: 0, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tr(c.yearKey)} · {tr(c.subjectKey)}
                    </span>
                    <span style={{ fontWeight: 600, color: masteryColor(c.mastery) }}>{pct(c.mastery)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
