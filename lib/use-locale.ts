"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_KEY, normalizeLocale, type Locale } from "@/lib/locale";

export type LocaleValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

/**
 * App-language state, persisted to localStorage under the shared `bluestift-locale`
 * key (Raya + Schools stay in sync). Mirrors `useDarkMode`: the first render is
 * always the English default so SSR and the initial client render agree, then an
 * effect swaps in the stored preference and subscribes to cross-tab changes.
 */
export function useLocale(): LocaleValue {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_KEY);
      if (stored) setLocaleState(normalizeLocale(stored));
    } catch {
      /* localStorage unavailable — stay on the default */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCALE_KEY) setLocaleState(normalizeLocale(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* best-effort — the choice still applies this session */
    }
  }, []);

  return { locale, setLocale };
}
