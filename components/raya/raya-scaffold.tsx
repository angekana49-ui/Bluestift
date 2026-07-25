"use client";

import { type ReactNode } from "react";
import { useDarkMode, AppThemeProvider } from "@/components/ui/theme";
import { RayaShell, type RayaNav } from "@/components/raya/raya-shell";

/**
 * Client wrapper a server page can drop around any Raya student route. Owns the
 * single `useDarkMode` instance, publishes it via `AppThemeProvider` (so the
 * inner screens read the same theme with `useAppTheme()`), and renders the
 * `RayaShell` chrome with the right `active` nav item. `rightPanel` is optional.
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
  return (
    <AppThemeProvider value={value}>
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
    </AppThemeProvider>
  );
}
