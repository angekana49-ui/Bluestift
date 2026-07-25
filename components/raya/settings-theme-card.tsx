"use client";

import { useAppTheme, ThemeToggle } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";

/** Settings "Theme" card — the Day/Night switch, driving the shell's theme. */
export function SettingsThemeCard() {
  const { dark, theme: t, toggle } = useAppTheme();
  return (
    <SettingsCard theme={t}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Theme</div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>Switch between light and dark mode</div>
        </div>
        <ThemeToggle dark={dark} theme={t} onToggle={toggle} />
      </div>
    </SettingsCard>
  );
}
