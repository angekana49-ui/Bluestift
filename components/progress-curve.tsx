"use client";

import { useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle } from "@/components/ui/forms";

export type ProgressPoint = { t: string; score: number };

const ACCENT = "#6366f1";

// Plot geometry (SVG user units; the <svg> scales responsively to its box).
const W = 640;
const H = 240;
const M = { top: 16, right: 16, bottom: 28, left: 36 };
const innerW = W - M.left - M.right;
const innerH = H - M.top - M.bottom;

export function ProgressCurve({ points }: { points: ProgressPoint[] }) {
  const { theme: t } = useAppTheme();
  const card = panelCard(t);
  const INK_MUTED = t.mutedLight;
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>Graded performance over time</h2>
        <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
          Do a few challenges or self-tests and your score curve will show up here.
        </p>
      </div>
    );
  }

  const sorted = [...points].sort((a, b) => +new Date(a.t) - +new Date(b.t));
  const times = sorted.map((p) => +new Date(p.t));
  const tMin = times[0];
  const tMax = times[times.length - 1];
  const span = tMax - tMin || 1;

  const x = (t: number) =>
    sorted.length === 1 ? M.left + innerW / 2 : M.left + ((t - tMin) / span) * innerW;
  const y = (s: number) => M.top + (1 - Math.max(0, Math.min(1, s))) * innerH;
  const baseline = y(0);

  const coords = sorted.map((p, i) => ({ ...p, px: x(times[i]), py: y(p.score) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.px.toFixed(1)} ${c.py.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].px.toFixed(1)} ${baseline} L ${coords[0].px.toFixed(1)} ${baseline} Z`;

  const gridPct = [0, 25, 50, 75, 100];
  const fmtDate = (t: string) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const active = hover != null ? coords[hover] : null;

  return (
    <div style={card}>
      <h2 style={cardTitle(t)}>Graded performance over time</h2>
      <p style={{ margin: "0 0 12px", color: t.muted, fontSize: 14 }}>
        {sorted.length} {sorted.length === 1 ? "assessment" : "assessments"}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Line chart of your graded scores over time"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines + y labels */}
        {gridPct.map((p) => {
          const gy = y(p / 100);
          return (
            <g key={p}>
              <line x1={M.left} y1={gy} x2={W - M.right} y2={gy} stroke={t.cardBorder} strokeWidth="1" />
              <text x={M.left - 8} y={gy + 4} textAnchor="end" fontSize="11" fill={INK_MUTED}>
                {p}%
              </text>
            </g>
          );
        })}

        {sorted.length > 1 && <path d={area} fill="url(#pc-fill)" />}
        {sorted.length > 1 && (
          <path d={line} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Hover crosshair */}
        {active && (
          <line x1={active.px} y1={M.top} x2={active.px} y2={baseline} stroke={ACCENT} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        )}

        {/* Markers */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.px}
            cy={c.py}
            r={hover === i ? 6 : 4}
            fill={ACCENT}
            stroke={t.cardBg2}
            strokeWidth="2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            style={{ cursor: "pointer" }}
          />
        ))}

        {/* x-axis first / last date */}
        <text x={M.left} y={H - 8} textAnchor="start" fontSize="11" fill={INK_MUTED}>
          {fmtDate(sorted[0].t)}
        </text>
        {sorted.length > 1 && (
          <text x={W - M.right} y={H - 8} textAnchor="end" fontSize="11" fill={INK_MUTED}>
            {fmtDate(sorted[sorted.length - 1].t)}
          </text>
        )}

        {/* Tooltip */}
        {active && (
          <g transform={`translate(${Math.min(Math.max(active.px, M.left + 40), W - M.right - 40)}, ${Math.max(active.py - 14, M.top + 12)})`}>
            <rect x={-38} y={-26} width={76} height={22} rx={5} fill={t.cardBg2} stroke={t.cardBorder} />
            <text x={0} y={-11} textAnchor="middle" fontSize="11" fill={t.text}>
              {Math.round(active.score * 100)}% · {fmtDate(active.t)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
