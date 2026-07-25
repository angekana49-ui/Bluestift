"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import type { AppTheme } from "./tokens";
import { status } from "./tokens";

/** KPI tile (`.kpi`): label / big value / delta. Optional `.shine` sweep. */
export function KpiTile({
  theme: t,
  label,
  value,
  delta,
  deltaPositive,
  shine,
}: {
  theme: AppTheme;
  label: string;
  value: ReactNode;
  delta?: string;
  deltaPositive?: boolean;
  shine?: boolean;
}) {
  return (
    <div
      className={shine ? "kpi shine" : "kpi"}
      style={{ background: t.cardBg2, color: t.text }}
    >
      <div style={{ fontSize: 11, color: t.muted }}>{label}</div>
      <div className="val">{value}</div>
      {delta != null && (
        <div
          style={{
            fontSize: 10,
            marginTop: 3,
            color: deltaPositive ? status.positive : t.mutedLight,
          }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

/**
 * Semi-circular mastery gauge. `dashoffset` sets the fill (0 = full, 188 = empty);
 * values are hand-tuned in the reference, so pass one directly. Default stroke is
 * the canonical 4-stop orange→green gradient.
 */
export function MasteryGauge({
  theme: t,
  valueLabel,
  caption,
  dashoffset,
  valueSize = 22,
  stops = [
    { offset: "0%", color: "#f97316" },
    { offset: "45%", color: "#fbbf24" },
    { offset: "75%", color: "#84cc16" },
    { offset: "100%", color: "#22c55e" },
  ],
}: {
  theme: AppTheme;
  valueLabel: string;
  caption: string;
  dashoffset: number;
  valueSize?: number;
  stops?: { offset: string; color: string }[];
}) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 160 96" style={{ width: "100%", display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          {stops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d="M 20 84 A 60 60 0 0 1 140 84"
        fill="none"
        stroke={t.gaugeTrack}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M 20 84 A 60 60 0 0 1 140 84"
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray="188"
        strokeDashoffset={dashoffset}
      />
      <text
        x="80"
        y={valueSize >= 22 ? 64 : 66}
        textAnchor="middle"
        fontSize={valueSize}
        fontWeight="700"
        fill={t.text}
      >
        {valueLabel}
      </text>
      <text
        x="80"
        y={valueSize >= 22 ? 79 : 80}
        textAnchor="middle"
        fontSize="8"
        fill={t.mutedLight}
      >
        {caption}
      </text>
    </svg>
  );
}

/** Thin rounded progress bar. `fill` defaults to amber (<70%) / green (≥70%). */
export function ProgressBar({
  theme: t,
  pct,
  width = "100%",
  height = 6,
  fill,
}: {
  theme: AppTheme;
  pct: number;
  width?: number | string;
  height?: number;
  fill?: string;
}) {
  const color = fill ?? (pct >= 70 ? status.ok : status.warn);
  return (
    <span
      style={{
        display: "block",
        width,
        height,
        borderRadius: 99,
        background: t.gaugeTrack,
        overflow: "hidden",
        flex: "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: `${pct}%`,
          height: "100%",
          borderRadius: 99,
          background: color,
        }}
      />
    </span>
  );
}

/** Concept mastery row (label + pct + bar) — used in Mon Kernel. */
export function ConceptRow({
  theme: t,
  label,
  pct,
}: {
  theme: AppTheme;
  label: string;
  pct: number;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          marginBottom: 6,
          color: t.text,
        }}
      >
        <span>{label}</span>
        <span style={{ color: t.muted }}>{pct}%</span>
      </div>
      <ProgressBar theme={t} pct={pct} />
    </div>
  );
}

/** Pill segmented control (dark-pill active state). */
export function SegTabs<T extends string>({
  theme: t,
  options,
  value,
  onChange,
}: {
  theme: AppTheme;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: t.pillTrackBg,
        borderRadius: 99,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <span
            key={o.value}
            className="segtab"
            onClick={() => onChange(o.value)}
            style={{
              background: on ? t.ctaBg : "transparent",
              color: on ? t.ctaText : t.mutedLight,
            }}
          >
            {o.label}
          </span>
        );
      })}
    </div>
  );
}

/** Initials avatar (circle). */
export function Avatar({
  initials,
  size = 28,
  bg = status.aiIndigo,
  color = "#fff",
  style,
}: {
  initials: string;
  size?: number;
  bg?: string;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        ...style,
      }}
    >
      {initials}
    </span>
  );
}

/** Flying bird silhouette used in the Raya new-session greeting. */
export function Bird({
  variant,
  fill,
}: {
  variant: 1 | 2;
  fill: string;
}) {
  const wrap: CSSProperties =
    variant === 1
      ? {
          position: "absolute",
          width: 20,
          height: 14,
          pointerEvents: "none",
          animation:
            "birdFly 2.2s cubic-bezier(0.65,0,0.35,1) 0.15s 1 both",
        }
      : {
          position: "absolute",
          width: 14,
          height: 10,
          pointerEvents: "none",
          animation: "birdFly2 2.5s cubic-bezier(0.65,0,0.35,1) 0.4s 1 both",
        };
  return (
    <span style={wrap}>
      <svg
        width={variant === 1 ? 20 : 14}
        height={variant === 1 ? 14 : 10}
        viewBox="0 0 24 16"
        style={{
          display: "block",
          animation: `wingFlap ${variant === 1 ? "0.22s" : "0.19s"} ease-in-out infinite`,
          transformOrigin: "center",
        }}
      >
        <path
          d="M12 6 C9 2 4 1 0 3 C4 4 7 6 9 8 C7 10 4 12 0 13 C4 15 9 14 12 10 C15 14 20 15 24 13 C20 12 17 10 15 8 C17 6 20 4 24 3 C20 1 15 2 12 6 Z"
          fill={fill}
        />
      </svg>
    </span>
  );
}
