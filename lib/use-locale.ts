"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_KEY, normalizeLocale, type Locale } from "@/lib/locale";
import { readPref, writePref } from "@/lib/shared-pref";

export type LocaleValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

/**
 * App-language state under the shared `bluestift-locale` key (Raya + Schools
 * stay in sync, and so do the origins once they split — see lib/shared-pref.ts).
 * Mirrors `useDarkMode`: the first render is always the English default so SSR
 * and the initial client render agree, then an effect swaps in the stored
 * preference and subscribes to cross-tab changes.
 */
export function useLocale(): LocaleValue {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readPref(LOCALE_KEY);
    if (stored) setLocaleState(normalizeLocale(stored));
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCALE_KEY) setLocaleState(normalizeLocale(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writePref(LOCALE_KEY, l);
  }, []);

  return { locale, setLocale };
}
