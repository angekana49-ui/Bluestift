"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getTheme, THEME_KEY, type AppTheme } from "./tokens";
import { APP_THEME_COLORS, syncThemeColor } from "@/lib/theme-color";
import { readPref, writePref } from "@/lib/shared-pref";

export type DarkModeValue = {
  dark: boolean;
  theme: AppTheme;
  toggle: () => void;
  setDark: (v: boolean) => void;
};

/**
 * Dark-mode state under the shared `bluestift-dark` key (Raya + Schools stay in
 * sync if a user has both open, and across origins once they split — see
 * lib/shared-pref.ts). The value is read on mount only — the first render is
 * always light (matching the reference `hint-placeholder-val` default) so SSR
 * and the initial client render agree, then the effect swaps in the stored
 * preference. Returns the resolved theme.
 */
export function useDarkMode(): DarkModeValue {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    setDarkState(readPref(THEME_KEY) === "1");
    // Keep both apps in sync across tabs/windows. This is why the preference is
    // still written to localStorage and not to the cookie alone: cookies fire
    // no event, so a toggle in one tab would never reach the others.
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setDarkState(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // The browser's own chrome follows the toggle — and, via the storage listener
  // above, follows it across tabs too. Matters most here: this is the surface an
  // installed PWA actually opens into, and it uses the APP's page ground, which
  // is white in light mode where the marketing site's is #eef3f9.
  useEffect(() => {
    syncThemeColor(dark, APP_THEME_COLORS);
    // Publish the interaction tokens on the ROOT, not just on .app-shell.
    // Menus and modals render through a portal into <body>, so they are not
    // inside the shell and would otherwise fall back to the light-mode hover
    // filter — which reads as "switched off" on a dark popover.
    const root = document.documentElement.style;
    root.setProperty("--app-hover-filter", dark ? "brightness(1.18)" : "brightness(0.95)");
    root.setProperty("--app-focus", dark ? "#7ab3f7" : "#1b5fc1");
  }, [dark]);

  const setDark = useCallback((v: boolean) => {
    setDarkState(v);
    writePref(THEME_KEY, v ? "1" : "0");
  }, []);

  const toggle = useCallback(() => setDark(!dark), [dark, setDark]);

  return { dark, theme: getTheme(dark), toggle, setDark };
}

/**
 * Shared dark-mode context so a server page can wrap a client shell (which owns
 * the single `useDarkMode` instance) and the inner screens can read the same
 * theme via `useAppTheme()` — without the server page passing a function across
 * the boundary. `AppThemeProvider` lives in the client shell scaffolds.
 */
const AppThemeContext = createContext<DarkModeValue | null>(null);

export function AppThemeProvider({
  value,
  children,
}: {
  value: DarkModeValue;
  children: ReactNode;
}) {
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): DarkModeValue {
  const v = useContext(AppThemeContext);
  if (!v) {
    throw new Error("useAppTheme must be used within an AppThemeProvider (RayaScaffold/SchoolsScaffold).");
  }
  return v;
}

/**
 * For components used both inside a shell (with the provider) and standalone
 * (e.g. AuthPanel on /login vs /account): prefers the shared context so a theme
 * toggle re-themes the whole page, and falls back to a private instance when
 * there's no provider. Both hooks always run — rules-of-hooks safe.
 */
export function useResolvedTheme(): DarkModeValue {
  const ctx = useContext(AppThemeContext);
  const standalone = useDarkMode();
  return ctx ?? standalone;
}

/**
 * Day/Night pill switch — lives inside Settings (not the sidebar) in both apps.
 * 60×28 track, 20×20 knob sliding left:3px ↔ left:37px with a springy transition,
 * sun/moon glyphs swapped by conditional render.
 */
export function ThemeToggle({
  dark,
  theme: t,
  onToggle,
}: {
  dark: boolean;
  theme: AppTheme;
  onToggle: () => void;
}) {
  return (
    <span
      role="button"
      aria-label="Toggle theme"
      onClick={onToggle}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 60,
        height: 28,
        borderRadius: 99,
        boxSizing: "border-box",
        cursor: "pointer",
        border: `1px solid ${t.switchBorder}`,
        background: t.switchTrackBg,
        transition: "background .4s ease,border-color .4s ease",
        flex: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: dark ? 37 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: t.switchKnobBg,
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {dark ? (
          <svg width="10" height="10" viewBox="0 0 13 13">
            <circle cx="6.5" cy="6.5" r="5.2" fill="#bae6fd" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="3" fill="#f59e0b" />
            <path
              d="M7 1.5V3M7 11V12.5M1.5 7H3M11 7H12.5M3.1 3.1L4.1 4.1M9.9 9.9L10.9 10.9M3.1 10.9L4.1 9.9M9.9 4.1L10.9 3.1"
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    </span>
  );
}
