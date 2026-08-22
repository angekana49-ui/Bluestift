"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Theme } from "./theme";
import { useAppLocale } from "@/components/ui/locale";
import {
  LOCALES,
  LOCALE_KEY,
  LOCALE_ASKED_KEY,
  matchLocale,
  normalizeLocale,
  type Locale,
} from "@/lib/locale";
import { prefsUsable, readPref, writePref } from "@/lib/shared-pref";

/**
 * First-visit language offer for the public site.
 *
 * Why offer at all rather than hide a picker in the nav: the nav has no room
 * for a fifth control, and a visitor who reads French shouldn't have to hunt
 * for a menu to discover the site speaks it.
 *
 * It is deliberately NOT a hard gate — an interstitial in front of the content
 * costs bounce rate. That was always the intent, but the implementation used to
 * contradict it: a centred `aria-modal` dialog over a dimmed, blurred backdrop,
 * which is an interstitial by any definition. The very first thing a new
 * visitor saw was a dialog, before a single word of the page. It is now a bar
 * that settles at the bottom of the viewport:
 *
 *  - the page is readable immediately, and stays clickable — the fixed wrapper
 *    is `pointer-events: none`, so only the bar itself catches clicks;
 *  - the browser's own language is detected and pre-selected, making this a
 *    one-click confirmation rather than a question;
 *  - Escape dismisses it, and dismissal is remembered;
 *  - it never shows twice, and never shows at all to someone who already has a
 *    language (e.g. set inside the app — `LOCALE_KEY` is shared).
 *
 * It also no longer takes focus on appear. Stealing the caret is defensible for
 * a modal, which owns the screen until answered; for a bar sitting beside the
 * content it would just interrupt someone who has started reading. Keyboard
 * users reach it by Tab, and it is last in the DOM.
 *
 * SSR-safe: it renders nothing until an effect has read localStorage, so the
 * server and first client render agree.
 */
export function LanguagePrompt({ theme: t }: { theme: Theme }) {
  const { locale, setLocale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState<Locale | null>(null);
  const firstBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Both keys live in a cookie as well as localStorage (lib/shared-pref.ts),
    // which is what stops this bar from reappearing on every origin once the
    // products split: "already asked" has to travel with the visitor, or a
    // three-origin visit would ask three times.
    // Nothing can be stored (private mode, an embedded webview): stay quiet.
    // Asking would be asking on EVERY page load, since the answer could not be
    // recorded — the same reason the previous localStorage-only read defaulted
    // to "already answered" when it threw.
    if (!prefsUsable()) return;
    if (readPref(LOCALE_KEY) || readPref(LOCALE_ASKED_KEY)) return;
    const preferred =
      typeof navigator !== "undefined"
        ? navigator.languages?.length
          ? navigator.languages
          : [navigator.language]
        : [];
    setSuggested(matchLocale(preferred ?? []));
    setOpen(true);
  }, []);

  // Remember that we asked, whatever the outcome, so the prompt is a one-time event.
  const markAsked = useCallback(() => writePref(LOCALE_ASKED_KEY, "1"), []);

  const dismiss = useCallback(() => {
    markAsked();
    setOpen(false);
  }, [markAsked]);

  function choose(code: Locale) {
    setLocale(code);
    markAsked();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    // No focus() here on purpose — see the note on focus above.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  // The heading is shown in the language we're about to suggest, so it's
  // readable by the person we're asking. Falls back to English.
  const headingFor: Record<Locale, string> = {
    en: "Choose your language",
    fr: "Choisissez votre langue",
    es: "Elige tu idioma",
    de: "Wähle deine Sprache",
  };
  const dismissLabelFor: Record<Locale, string> = {
    en: "Dismiss",
    fr: "Fermer",
    es: "Cerrar",
    de: "Schließen",
  };
  const shown = suggested ?? normalizeLocale(locale);

  return (
    // Fixed, but transparent to the pointer: the visitor can keep reading and
    // clicking the page underneath. Only the bar re-enables pointer events.
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        padding: 16,
        pointerEvents: "none",
      }}
    >
      <div
        role="region"
        aria-label={headingFor[shown]}
        className="pub-lang-bar"
        // Two rows rather than one: label + dismiss, then the languages. Laid
        // out on a single line, the label competes with four chips for width and
        // the chips collapse into a tall vertical stack on a phone.
        style={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          maxWidth: 520,
          background: t.cardBg,
          color: t.text,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 18,
          boxShadow: t.cardShadowLg,
          padding: "13px 15px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>
            {headingFor[shown]}
          </span>
          <button
            onClick={dismiss}
            aria-label={dismissLabelFor[shown]}
            className="pub-focus"
            style={{
              flex: "none",
              width: 26,
              height: 26,
              borderRadius: 999,
              cursor: "pointer",
              background: "transparent",
              border: "none",
              color: t.muted,
              fontSize: 17,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LOCALES.map((l, i) => {
            const isSuggested = l.code === suggested;
            return (
              <button
                key={l.code}
                ref={i === 0 ? firstBtn : undefined}
                onClick={() => choose(l.code)}
                className="pub-press"
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  // The detected language is the primary action — one click and
                  // the visitor is reading the site in their own language.
                  background: isSuggested ? t.ctaBg : "transparent",
                  color: isSuggested ? t.ctaText : t.text,
                  border: `1px solid ${isSuggested ? t.ctaBg : t.cardBorder}`,
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
