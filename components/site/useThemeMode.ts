"use client";

import { useCallback, useEffect, useState } from "react";
import { SITE_THEME_COLORS, syncThemeColor } from "@/lib/theme-color";
import { readPref, writePref } from "@/lib/shared-pref";

const THEME_KEY = "bluestift-dark";

/**
 * SSR-safe dark/light mode hook for the public marketing site.
 *
 * Always renders `false` (light) on the very first render so the server HTML
 * and the client's first paint match. The stored preference is only read inside
 * useEffect (after mount) to avoid a Next.js hydration mismatch. Shares the
 * `bluestift-dark` key with the connected app so a returning signed-in user's
 * preference carries over — and, since it is stored in a cookie as well as
 * localStorage (lib/shared-pref.ts), carries over across origins too.
 */
export function useThemeMode() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(readPref(THEME_KEY) === "1");
    setMounted(true);
  }, []);

  // The browser's own chrome follows the toggle. Keyed on `isDark` rather than
  // done inside `toggle`, so the stored preference read above also lands.
  useEffect(() => {
    syncThemeColor(isDark, SITE_THEME_COLORS);
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      writePref(THEME_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { isDark, toggle, mounted };
}
