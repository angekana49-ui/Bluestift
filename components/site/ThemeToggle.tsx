"use client";

import type { Theme } from "./theme";
import { useTranslate } from "@/components/ui/locale";

/**
 * Day/Night pill switch (66×30, box-sizing:border-box — required, otherwise the
 * padding inflates the box and the knob/label go off-centre). The 22×22 knob
 * springs between left:3px (Day) and left:41px (Night); a single label sits in
 * the empty half opposite the knob.
 */
export default function ThemeToggle({
  theme: t,
  isDark,
  onToggle,
}: {
  theme: Theme;
  isDark: boolean;
  onToggle: () => void;
}) {
  const tr = useTranslate();
  const knobLeft = isDark ? "41px" : "3px";
  const modeLabel = isDark ? tr("theme.night") : tr("theme.day");
  const labelSide: "left" | "right" = isDark ? "left" : "right";
  const labelColor = isDark ? "#e2e8f0" : "#64748b";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={tr("theme.switchAria")}
      title={tr("theme.switchAria")}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 66,
        height: 30,
        borderRadius: 999,
        boxSizing: "border-box",
        cursor: "pointer",
        border: `1px solid ${t.switchBorder}`,
        background: t.switchTrackBg,
        boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
        flexShrink: 0,
        transition: "background 0.4s ease, border-color 0.4s ease",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: knobLeft,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: t.switchKnobBg,
          boxShadow: "0 4px 14px rgba(15,23,42,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {isDark ? (
          <svg width="11" height="11" viewBox="0 0 13 13">
            <circle cx="6.5" cy="6.5" r="5.2" fill="#bae6fd" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" fill="#f59e0b" />
            <path
              d="M7 1.5V3M7 11V12.5M1.5 7H3M11 7H12.5M3.1 3.1L4.1 4.1M9.9 9.9L10.9 10.9M3.1 10.9L4.1 9.9M9.9 4.1L10.9 3.1"
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      <span
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          [labelSide]: 6,
          fontSize: 13,
          fontWeight: 600,
          color: labelColor,
        }}
      >
        {modeLabel}
      </span>
    </button>
  );
}

/** Sun and crescent, sized to sit inside the 34px compact button. */
function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="3" fill="#f59e0b" />
      <path
        d="M7 1.5V3M7 11V12.5M1.5 7H3M11 7H12.5M3.1 3.1L4.1 4.1M9.9 9.9L10.9 10.9M3.1 10.9L4.1 9.9M9.9 4.1L10.9 3.1"
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      {/* A crescent as one filled path, not a circle with a circle punched out
          of it: the bar behind this button is translucent, so a "cut-out" made
          from a background-coloured disc would show as a solid blob over it. */}
      <path
        d="M13.2 9.9A5.6 5.6 0 0 1 6.1 2.8a5.6 5.6 0 1 0 7.1 7.1Z"
        fill="#bae6fd"
      />
    </svg>
  );
}

/**
 * The same switch, as a 34×34 icon button — what the bar carries below 900px.
 *
 * Not a style variant of the pill above but a second element, because the pill
 * cannot shrink into this: its 66px width is what gives the knob somewhere to
 * travel and the label somewhere to sit. Both are rendered, and CSS shows one
 * (`.pub-theme-pill` / `.pub-theme-icon` in globals.css) — deliberately not a
 * `window.innerWidth` check at render, which would have to guess on the server
 * and correct itself after hydration.
 *
 * It shows the CURRENT mode rather than the one a click would bring, matching
 * the pill's knob, which is on screen at every other width. The two disagreeing
 * across a breakpoint would be worse than either convention.
 */
export function ThemeToggleCompact({
  theme: t,
  isDark,
  onToggle,
}: {
  theme: Theme;
  isDark: boolean;
  onToggle: () => void;
}) {
  const tr = useTranslate();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={tr("theme.switchAria")}
      title={tr("theme.switchAria")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 999,
        boxSizing: "border-box",
        cursor: "pointer",
        border: `1px solid ${t.switchBorder}`,
        background: t.switchTrackBg,
        // No drop shadow here. The pill's exists to lift a wide control off the
        // bar; on a 34px circle at this density it only muddies the edge.
        flexShrink: 0,
        padding: 0,
        transition: "background 0.4s ease, border-color 0.4s ease",
      }}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
