"use client";

import { useEffect, useRef, useState } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { ShareLinkButton } from "@/components/study/share-button";
import { useAppTheme } from "@/components/ui/theme";
import { IconGlobe } from "@/components/site/icons";
import { radius, text as textScale, type AppTheme } from "@/components/ui/tokens";
import { LOCALES, type Locale } from "@/lib/locale";
import { useAppLocale, useTranslate } from "@/components/ui/locale";

/**
 * The export row: a language, then TXT / PDF / Share.
 *
 * Every generated document in the product — summaries, quizzes, class reports,
 * simulations, room reports, progress — was produced in whatever language its
 * generation happened to run in, and downloaded in that language, full stop. A
 * francophone teacher exporting a report for a francophone parent had no route
 * to a French copy except regenerating the whole thing and hoping.
 *
 * The picker is the landing page's, in app tokens: same shape, same behaviour,
 * so the gesture is one a user has already learned. What sits behind it is
 * different — the public site's switcher changes the interface language, this
 * one changes the language of ONE document and touches nothing else.
 *
 * ONE GENERATION, FOUR LANGUAGES. Translating the finished document rather than
 * regenerating it per language is what makes this cheap enough to offer, and it
 * is also the only way the four copies say the same thing: three of them are
 * derived from the first rather than independently reasoned. The result is
 * cached on the document's content, so a class summarising the same lesson pays
 * for one translation between them (lib/documents/translate.ts).
 */

/**
 * TEMPORARILY OFF. The per-document LLM translation (lib/documents/translate.ts,
 * `/api/documents/translate`) tested inconsistent on generated artifacts, so the
 * language picker is hidden and `resolve()` below skips the call entirely —
 * TXT/PDF/share always hand back the document exactly as generated, in
 * whatever language that was. The LLM call itself and the i18n catalogue are
 * both untouched; this is a UI-only switch. Revisit — fix the translation
 * quality, then flip this back on — in a future update.
 */
const TRANSLATION_ENABLED = false;

export function DocumentActions({
  doc,
  compact = false,
  shareable = true,
  personal = false,
}: {
  /** Built by the caller, exactly as before — this component owns only the language. */
  doc: BrandedDoc;
  /** Denser buttons, for a row inside a card rather than under a heading. */
  compact?: boolean;
  shareable?: boolean;
  /**
   * The document is about identifiable people (a class report, one learner's
   * results). Translations of it are never stored in the shared cache — see
   * lib/documents/translate.ts. Lesson material (summaries, quizzes) is not.
   */
  personal?: boolean;
}) {
  const { theme: t } = useAppTheme();
  const { locale: uiLocale } = useAppLocale();
  const tr = useTranslate();

  // Defaults to the interface language, which is the right guess often enough
  // to save most people the click, and is never applied without being shown.
  const [lang, setLang] = useState<Locale>(uiLocale);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Translations already fetched, for this component's lifetime.
   *
   * The server cache spans users and survives reloads; this one saves the round
   * trip when someone downloads TXT and then PDF of the same thing, which is a
   * common pair and would otherwise be two identical requests.
   */
  const cacheRef = useRef(new Map<string, BrandedDoc>());

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

  // A new document invalidates everything: the cache is keyed on the language,
  // and the body under it has changed.
  useEffect(() => {
    cacheRef.current.clear();
    setNote(null);
  }, [doc.title, doc.body]);

  /**
   * The document to hand the exporter.
   *
   * Falls back to the SOURCE on any failure rather than refusing to download.
   * Someone who wanted a French copy and gets the English one has lost a
   * convenience; someone who gets an error instead of a file has lost the report
   * they came for.
   */
  async function resolve(): Promise<BrandedDoc> {
    // See TRANSLATION_ENABLED above — the picker that would set `lang` away
    // from the source is hidden while this is off, but resolve() stays the
    // one place that decides what actually gets downloaded, so it's the gate
    // too: no network call, no LLM call, the document as generated.
    if (!TRANSLATION_ENABLED) return doc;

    const hit = cacheRef.current.get(lang);
    if (hit) return hit;

    setBusy(true);
    setNote(null);
    try {
      // Model-backed (and cached server-side on repeat content) — a big
      // document's first translation can take a while, so this needs real
      // headroom rather than the 10s default.
      const res = await netFetch(
        "/api/documents/translate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: doc.title, meta: doc.meta ?? null, body: doc.body, locale: lang, personal }),
        },
        { timeoutMs: 65_000 },
      );
      const data = (await res.json().catch(() => null)) as
        | { title?: string; meta?: string | null; body?: string; translated?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.body || !data.title) {
        setNote(data?.error ?? tr("docActions.translateFailed"));
        return doc;
      }
      const translated: BrandedDoc = {
        ...doc,
        title: data.title,
        meta: data.meta ?? undefined,
        body: data.body,
      };
      if (data.translated) cacheRef.current.set(lang, translated);
      else setNote(tr("docActions.alreadyThatLanguage"));
      return translated;
    } catch {
      setNote(tr("docActions.translateFailed"));
      return doc;
    } finally {
      setBusy(false);
    }
  }

  async function save(kind: "txt" | "pdf") {
    const out = await resolve();
    if (kind === "txt") downloadBrandedText(out);
    else downloadBrandedPdf(out);
  }

  const current = LOCALES.find((l) => l.code === lang) ?? LOCALES[0];
  const btn = pill(t, compact);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {TRANSLATION_ENABLED && (
      <div ref={rootRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={tr("docActions.languageLabel")}
          title={tr("docActions.languageTitle")}
          style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <IconGlobe size={14} strokeWidth={1.8} />
          {current.code.toUpperCase()}
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={tr("docActions.languageLabel")}
            style={{
              position: "absolute",
              left: 0,
              top: "calc(100% + 6px)",
              zIndex: 60,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: radius.panel,
              padding: 6,
              minWidth: 170,
            }}
          >
            {LOCALES.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                    setNote(null);
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
                    fontSize: textScale.sm,
                    fontWeight: active ? 700 : 500,
                    color: active ? t.text : t.muted,
                    background: active ? t.rowActiveBg : "transparent",
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
      </div>
      )}

      <button type="button" style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={() => void save("txt")} disabled={busy}>
        {busy ? "…" : "TXT"}
      </button>
      <button type="button" style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={() => void save("pdf")} disabled={busy}>
        {busy ? "…" : "PDF"}
      </button>
      {shareable && <ShareLinkButton theme={t} doc={doc} />}

      {note && (
        <span style={{ fontSize: textScale.xs, color: t.mutedLight, flexBasis: "100%" }}>{note}</span>
      )}
    </div>
  );
}

function pill(t: AppTheme, compact: boolean): React.CSSProperties {
  return {
    background: t.cardBg,
    color: t.text,
    border: `1px solid ${t.controlBorder}`,
    borderRadius: radius.pill,
    padding: compact ? "5px 12px" : "6px 14px",
    fontSize: compact ? textScale.xs : textScale.sm,
    fontWeight: 650,
    fontFamily: "inherit",
    lineHeight: 1.2,
    cursor: "pointer",
  };
}
