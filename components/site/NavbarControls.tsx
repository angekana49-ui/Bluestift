"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Theme = "day" | "night";
type NavLink = { label: string; href: string };

/**
 * Public-site nav pills + Day/Night toggle. The theme is persisted under
 * `bluestift-theme` and applied via `data-theme` on <html> — independent of the
 * signed-in app's own `bluestift-dark` dark mode.
 */
export default function NavbarControls({ links, active }: { links: NavLink[]; active?: string }) {
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    const stored = window.localStorage.getItem("bluestift-theme");
    const initial: Theme =
      stored === "night" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "night"
        : "day";
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("bluestift-theme", theme);
  }, [theme]);

  const isDay = theme === "day";

  return (
    <>
      <div className="bluestift-nav-pill hidden md:flex items-center gap-1 rounded-full px-1.5 py-1">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={`bluestift-nav-link rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              active === link.label ? "bg-white text-black shadow-[0_1px_4px_rgba(15,23,42,0.08)]" : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <button
        type="button"
        aria-label={`Switch to ${isDay ? "night" : "day"} theme`}
        aria-pressed={!isDay}
        onClick={() => setTheme((v) => (v === "day" ? "night" : "day"))}
        className="relative inline-flex h-[34px] w-16 items-center rounded-full border p-[3px] cursor-pointer transition-colors"
        style={{
          borderColor: isDay ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
          background: isDay
            ? "linear-gradient(180deg,#dfeef9,#f8fbfe)"
            : "linear-gradient(180deg,#111b2a,#0b1220)",
        }}
      >
        <span
          className="absolute top-[3px] flex h-[26px] w-[26px] items-center justify-center rounded-full shadow-[0_4px_12px_rgba(15,23,42,0.2)] transition-all"
          style={{
            left: isDay ? "3px" : "35px",
            background: isDay ? "white" : "#0b1220",
            transitionDuration: "350ms",
            transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <span className="absolute transition-opacity duration-300" style={{ opacity: isDay ? 1 : 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="3" fill="#f59e0b" />
              <path
                d="M7 1.5V3M7 11V12.5M1.5 7H3M11 7H12.5M3.1 3.1L4.1 4.1M9.9 9.9L10.9 10.9M3.1 10.9L4.1 9.9M9.9 4.1L10.9 3.1"
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="absolute transition-opacity duration-300" style={{ opacity: isDay ? 0 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 13 13">
              <circle cx="6.5" cy="6.5" r="5.2" fill="#bae6fd" />
            </svg>
          </span>
        </span>
        <span
          className="absolute top-1/2 -translate-y-1/2 text-[9px] font-semibold transition-opacity"
          style={{ right: "8px", color: "#64748b", opacity: isDay ? 1 : 0 }}
        >
          Day
        </span>
        <span
          className="absolute top-1/2 -translate-y-1/2 text-[9px] font-semibold transition-opacity"
          style={{ left: "8px", color: "#cbd5e1", opacity: isDay ? 0 : 1 }}
        >
          Night
        </span>
      </button>
    </>
  );
}
