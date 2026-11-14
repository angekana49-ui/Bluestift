import type { ReactNode } from "react";
import "./generated/app.css";
import { AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider } from "@/components/ui/locale";
import { getTheme, type AppTheme } from "@/components/ui/tokens";
import { lookup, type MessageKey } from "@/lib/i18n";

/**
 * The demo's app harness: every product screen renders inside it.
 *
 * Light theme, English locale, inert actions — the same components the app
 * ships, fed demo data instead of a backend. The app's own stylesheet for
 * the semantic classes (chat-col, kpi, …) travels in generated/app.css.
 */

/** The app's light theme, as it ships. */
export const T: AppTheme = getTheme(false);

/** The app's real English strings, looked up like the app looks them up. */
export function trEn(key: MessageKey, vars?: Record<string, string | number>): string {
  return lookup("en", key, vars);
}

const noop = () => {};

export function DemoProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider value={{ locale: "en", setLocale: noop }}>
      <AppThemeProvider
        value={{ dark: false, theme: T, toggle: noop, setDark: noop, mode: "light", setMode: noop }}
      >
        {children}
      </AppThemeProvider>
    </LocaleProvider>
  );
}
