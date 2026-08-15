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

/**
 * First-visit language prompt for the public site.
 *
 * Why a prompt rather than a picker in the nav: the nav has no room for a fifth
 * control, and a visitor who reads French shouldn't have to hunt for a menu to
 * discover the site speaks it.
 *
 * It is deliberately NOT a hard gate — an interstitial in front of the content
 * costs bounce rate, so:
 *  - the browser's own language is detected and pre-selected, making this a
 *    one-click confirmation instead of a question;
 *  - Escape and a backdrop click dismiss it, and dismissal is remembered;
 *  - it never shows twice, and never shows at all to someone who already has a
 *    language (e.g. set inside the app — `LOCALE_KEY` is shared).
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
    let alreadyAnswered = true;
    try {
      alreadyAnswered = Boolean(
        localStorage.getItem(LOCALE_KEY) || localStorage.getItem(LOCALE_ASKED_KEY),
      );
    } catch {
      /* no localStorage (private mode, embedded webview) — don't nag */
    }
    if (alreadyAnswered) return;
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
  const markAsked = useCallback(() => {
    try {
      localStorage.setItem(LOCALE_ASKED_KEY, "1");
    } catch {
      /* best-effort */
    }
  }, []);

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
    firstBtn.current?.focus();
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
  const changeHintFor: Record<Locale, string> = {
    en: "You can change this later in the app.",
    fr: "Vous pourrez changer plus tard dans l’application.",
    es: "Puedes cambiarlo después en la aplicación.",
    de: "Du kannst das später in der App ändern.",
  };
  const shown = suggested ?? normalizeLocale(locale);

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(8,12,24,0.5)",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headingFor[shown]}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: t.cardBg,
          color: t.text,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 22,
          boxShadow: t.cardShadowLg,
          padding: 26,
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bluestift-mark.png"
          alt=""
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", margin: "0 auto 14px", display: "block" }}
        />
        <div style={{ fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: "-0.01em" }}>
          {headingFor[shown]}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
          {LOCALES.map((l, i) => {
            const isSuggested = l.code === suggested;
            return (
              <button
                key={l.code}
                ref={i === 0 ? firstBtn : undefined}
                onClick={() => choose(l.code)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "left",
                  // The detected language is the primary action — one click and
                  // the visitor is reading the site in their own language.
                  background: isSuggested ? t.ctaBg : "transparent",
                  color: isSuggested ? t.ctaText : t.text,
                  border: `1px solid ${isSuggested ? t.ctaBg : t.cardBorder}`,
                }}
              >
                <span>{l.label}</span>
                {isSuggested && <span aria-hidden style={{ fontSize: 13, opacity: 0.8 }}>✓</span>}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, fontSize: 13, color: t.muted }}>{changeHintFor[shown]}</div>
      </div>
    </div>
  );
}
