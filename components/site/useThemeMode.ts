"use client";

import { useCallback, useEffect, useState } from "react";
import { SITE_THEME_COLORS, syncThemeColor } from "@/lib/theme-color";

const THEME_KEY = "bluestift-dark";

/**
 * SSR-safe dark/light mode hook for the public marketing site.
 *
 * Always renders `false` (light) on the very first render so the server HTML
 * and the client's first paint match. localStorage is only read inside
 * useEffect (after mount) to avoid a Next.js hydration mismatch. Shares the
 * `bluestift-dark` key with the connected app so a returning signed-in user's
 * preference carries over.
 */
export function useThemeMode() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setIsDark(localStorage.getItem(THEME_KEY) === "1");
    } catch {
      // localStorage unavailable (privacy mode) — keep the light default.
    }
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
      try {
        localStorage.setItem(THEME_KEY, next ? "1" : "0");
      } catch {
        // ignore write failures
      }
      return next;
    });
  }, []);

  return { isDark, toggle, mounted };
}
