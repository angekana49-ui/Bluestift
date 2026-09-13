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
 * A CENTRED popup (owner decision, 2026-09-13). It had become a bar at the
 * bottom edge, stacked above the analytics consent banner, and in practice it
 * read as misplaced — half a card wedged between the page and another banner,
 * and on a phone the one thing that should be answered first was the easiest
 * to miss. So it is asked in the middle of the screen, once, and made cheap to
 * answer or skip:
 *
 *  - the browser's own language is detected and pre-selected, so this is a
 *    one-click confirmation rather than a question;
 *  - Escape, the ×, or a click on the backdrop dismisses it, and dismissal is
 *    remembered like an answer;
 *  - it never shows twice, and never shows at all to someone who already has a
 *    language (e.g. set inside the app — `LOCALE_KEY` is shared);
 *  - on a phone the four languages sit on a 2×2 grid of full-width buttons, not
 *    a row of chips that wraps unevenly.
 *
 * Focus moves to the suggested language when it opens (a dialog owns the screen
 * until answered) and returns where it was when it closes.
 *
 * SSR-safe: it renders nothing until an effect has read localStorage, so the
 * server and first client render agree.
 */
export function LanguagePrompt({ theme: t }: { theme: Theme }) {
  const { locale, setLocale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState<Locale | null>(null);
  const primaryBtn = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Both keys live in a cookie as well as localStorage (lib/shared-pref.ts),
    // which is what stops this prompt from reappearing on every origin once the
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
    returnFocus.current = document.activeElement as HTMLElement | null;
    // After the entrance animation has begun, so the ring lands on a visible button.
    const focusTimer = window.setTimeout(() => primaryBtn.current?.focus({ preventScroll: true }), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      returnFocus.current?.focus?.({ preventScroll: true });
    };
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
  const primaryCode = suggested ?? LOCALES[0].code;

  return (
    // Centred in the viewport. The backdrop is light — enough to say "answer
    // this first", not a blackout — and clicking it counts as "not now".
    <div
      className="pub-lang-wrap"
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Side gutter on every screen, and the safe areas of notched phones.
        padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
        background: "rgba(8, 14, 28, 0.32)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pub-lang-title"
        className="pub-lang-bar"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          background: t.cardBg,
          color: t.text,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 20,
          boxShadow: t.cardShadowLg,
          padding: "18px 18px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <span
            id="pub-lang-title"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", lineHeight: 1.3 }}
          >
            {headingFor[shown]}
          </span>
          <button
            onClick={dismiss}
            aria-label={dismissLabelFor[shown]}
            className="pub-focus"
            style={{
              flex: "none",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              background: "transparent",
              border: "none",
              color: t.muted,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div className="pub-lang-grid">
          {LOCALES.map((l) => {
            const isPrimary = l.code === primaryCode;
            return (
              <button
                key={l.code}
                ref={isPrimary ? primaryBtn : undefined}
                onClick={() => choose(l.code)}
                className="pub-press pub-focus"
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  // The detected language is the primary action — one click and
                  // the visitor is reading the site in their own language.
                  background: isPrimary && suggested ? t.ctaBg : "transparent",
                  color: isPrimary && suggested ? t.ctaText : t.text,
                  border: `1px solid ${isPrimary && suggested ? t.ctaBg : t.cardBorder}`,
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
