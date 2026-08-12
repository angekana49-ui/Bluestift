"use client";

import { LocaleProvider } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";

export function LocaleRootProvider({ children }: { children: React.ReactNode }) {
  const localeValue = useLocale();
  return <LocaleProvider value={localeValue}>{children}</LocaleProvider>;
}
