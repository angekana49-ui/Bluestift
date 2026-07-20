'use client';

import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'bluestift-dark';

/**
 * SSR-safe dark/light mode hook.
 *
 * IMPORTANT: always render `false` (light) on the very first render so the
 * server-rendered HTML and the client's first paint match exactly. We only
 * read localStorage inside useEffect (after mount, client-only) and flip
 * state then. Reading localStorage during render (or in useState's
 * initializer) is what causes Next.js hydration mismatches — which is the
 * usual reason this gets "fixed" by deleting persistence entirely. Don't.
 */
export function useThemeMode() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setIsDark(localStorage.getItem(THEME_KEY) === '1');
    } catch {
      // localStorage unavailable (SSR / privacy mode) — keep light default
    }
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  }, []);

  return { isDark, toggle, mounted };
}
