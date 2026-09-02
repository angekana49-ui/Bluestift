"use client";

import { useCallback, useEffect, useState } from "react";
import { SITE_THEME_COLORS, syncThemeColor } from "@/lib/theme-color";
import {
  prefersDark,
  readThemeMode,
  resolveDark,
  watchSystemTheme,
  writeThemeMode,
  type ThemeMode,
} from "@/lib/theme-mode";

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
  const [mode, setMode] = useState<ThemeMode>("light");
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isDark = resolveDark(mode, systemDark);

  useEffect(() => {
    setMode(readThemeMode());
    setSystemDark(prefersDark());
    setMounted(true);
    // On `system` the OS decides, and it changes while the tab is open.
    return watchSystemTheme(setSystemDark);
  }, []);

  // The browser's own chrome follows the toggle. Keyed on `isDark` rather than
  // done inside `toggle`, so the stored preference read above also lands.
  useEffect(() => {
    syncThemeColor(isDark, SITE_THEME_COLORS);
  }, [isDark]);

  // The site offers a two-state switch, so using it is picking a side: it
  // commits to light or dark and leaves `system` rather than staying subscribed
  // to a device preference the visitor has just overridden.
  const toggle = useCallback(() => {
    const next: ThemeMode = isDark ? "light" : "dark";
    setMode(next);
    writeThemeMode(next);
  }, [isDark]);

  return { isDark, toggle, mounted };
}
