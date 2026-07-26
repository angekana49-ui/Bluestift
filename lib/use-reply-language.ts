"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LANG, normalizeLang, type LangCode } from "@/lib/languages";

const KEY = "bluestift.replyLang";

/**
 * One reply-language preference shared by every chat surface (solo Raya, Schools,
 * rooms). Backed by localStorage so a pick sticks across sessions and tabs. SSR
 * and the first client render both use the English default, so there's no
 * hydration mismatch; the stored choice is applied in an effect right after.
 */
export function useReplyLanguage(): [LangCode, (l: LangCode) => void] {
  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setLang(normalizeLang(stored));
    } catch {
      // no localStorage (private mode / SSR) → keep the default
    }
  }, []);

  const update = (l: LangCode) => {
    setLang(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // best-effort — the choice still applies for this session
    }
  };

  return [lang, update];
}
