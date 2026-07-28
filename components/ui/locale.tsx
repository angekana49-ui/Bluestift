"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocale, type LocaleValue } from "@/lib/use-locale";
import { lookup, type MessageKey } from "@/lib/i18n";

/**
 * App-language context — the locale twin of `AppThemeProvider`.
 *
 * Why it exists: `useLocale()` is localStorage-backed state, so every component
 * calling it held its OWN copy. Switching language in Settings updated the
 * Settings card and nothing else — the nav around it kept its old strings until
 * a reload. One instance at the scaffold root, published here, makes a switch
 * re-render the whole tree at once.
 *
 * `useTranslate` deliberately works with OR without the provider (same trick as
 * `useResolvedTheme`), because some surfaces — login, onboarding, the public
 * site — render outside any scaffold. Both hooks are called unconditionally, so
 * the rules of hooks hold; the standalone value is simply ignored when a
 * provider is present.
 */

const LocaleCtx = createContext<LocaleValue | null>(null);

export function LocaleProvider({ value, children }: { value: LocaleValue; children: ReactNode }) {
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

/** The current locale + setter, from context when inside a scaffold. */
export function useAppLocale(): LocaleValue {
  const ctx = useContext(LocaleCtx);
  const standalone = useLocale();
  return ctx ?? standalone;
}

/**
 * `const tr = useTranslate()` → `tr("nav.chat")`.
 *
 * Named `tr`, not `t`, by convention across this codebase: `t` is already the
 * theme in essentially every component, and shadowing it would be a trap.
 */
export function useTranslate(): (key: MessageKey) => string {
  const { locale } = useAppLocale();
  return useMemo(() => (key: MessageKey) => lookup(locale, key), [locale]);
}
