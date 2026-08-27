"use client";

import { useEffect, useRef, useState } from "react";
import type { Theme } from "./theme";
import { IconGlobe } from "./icons";
import { useAppLocale, useTranslate } from "@/components/ui/locale";
import { LOCALES } from "@/lib/locale";

/**
 * Persistent language switcher — bottom-right, everywhere on the public site
 * (mounted from SitePage and LandingPage), so changing language is never more
 * than one click away, first visit or the hundredth.
 *
 * This is deliberately separate from LanguagePrompt: that one is a one-time
 * nudge that asks itself, pre-selects the visitor's browser language, and
 * never shows twice. This one is the opposite shape — always there, answers
 * nothing on its own, and is how anyone changes their mind afterwards. Kept
 * out of the navbar (see Navbar.tsx) so the pill bar isn't made deeper for a
 * control most visitors will never touch.
 */
export function LanguageSwitcher({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  const { locale, setLocale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={rootRef} style={{ position: "fixed", right: 16, bottom: 16, zIndex: 150 }}>
      {open && (
        <div
          role="listbox"
          aria-label={tr("site.langSwitcher.ariaLabel")}
          style={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 10px)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 16,
            boxShadow: t.cardShadowLg,
            padding: 6,
            minWidth: 168,
          }}
        >
          {LOCALES.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  textAlign: "left",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 11px",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? t.text : t.muted,
                  background: active ? t.pillActiveBg : "transparent",
                  boxShadow: active ? t.pillActiveShadow : "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span>{l.label}</span>
                <span style={{ fontSize: 11.5, opacity: 0.65, fontWeight: 600, letterSpacing: "0.04em" }}>
                  {l.code.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tr("site.langSwitcher.ariaLabel")}
        title={tr("site.langSwitcher.ariaLabel")}
        className="pub-press"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          // Height well under the width — a squat oval, not a circle and not a
          // long text pill (see PR discussion: not folded into the navbar's
          // theme toggle, a small standalone shape of its own instead).
          height: 34,
          padding: "0 16px",
          borderRadius: 999,
          border: `1px solid ${t.cardBorder}`,
          background: t.cardBg,
          color: t.text,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          boxShadow: t.cardShadow,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <IconGlobe size={15} strokeWidth={1.8} />
        {current.code.toUpperCase()}
      </button>
    </div>
  );
}
