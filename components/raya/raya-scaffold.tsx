"use client";

import { type ReactNode } from "react";
import { useDarkMode, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";
import { RayaShell, type RayaNav } from "@/components/raya/raya-shell";

/**
 * Client wrapper a server page can drop around any Raya student route. Owns the
 * single `useDarkMode` and `useLocale` instances and publishes them via
 * `AppThemeProvider` / `LocaleProvider`, so every inner screen reads the same
 * theme (`useAppTheme()`) and the same language (`useTranslate()`) — and a
 * change to either re-renders the whole surface. Renders the `RayaShell` chrome
 * with the right `active` nav item. `rightPanel` is optional.
 */
export function RayaScaffold({
  active,
  studentName,
  studentInitials,
  studentAvatarUrl,
  studentPlan,
  rightPanel,
  mainMinWidth,
  children,
}: {
  active: RayaNav;
  studentName: string;
  studentInitials: string;
  studentAvatarUrl?: string | null;
  /** The user's forfait (e.g. "User — Free"), shown under the name + used by the
   *  profile menu to decide whether to surface the upgrade incentive. */
  studentPlan?: string;
  rightPanel?: ReactNode;
  mainMinWidth?: number;
  children: ReactNode;
}) {
  const value = useDarkMode();
  const localeValue = useLocale();
  return (
    <AppThemeProvider value={value}>
      <LocaleProvider value={localeValue}>
        <RayaShell
          theme={value.theme}
          active={active}
          profileName={studentName || "My account"}
          profileInitials={studentInitials}
          profileSubtitle={studentPlan}
          profileAvatarUrl={studentAvatarUrl}
          rightPanel={rightPanel}
          mainMinWidth={mainMinWidth}
        >
          {children}
        </RayaShell>
      </LocaleProvider>
    </AppThemeProvider>
  );
}
