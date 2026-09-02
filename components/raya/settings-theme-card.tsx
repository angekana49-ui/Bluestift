"use client";

import { useAppTheme } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";
import { useTranslate } from "@/components/ui/locale";
import { text } from "@/components/ui/tokens";
import type { ThemeMode } from "@/lib/theme-mode";

/**
 * Settings "Appearance" card — light / dark / system.
 *
 * It was a two-state Day/Night switch, which cannot express the answer the app
 * now defaults to: follow the device. A switch has two positions and there are
 * three answers, so the switch had to go rather than gain a third meaning.
 *
 * The same three options render in the settings sheet the profile chip opens;
 * both read and write the one `mode` on the shared theme context, so changing
 * it in either place moves the other.
 */
export function SettingsThemeCard() {
  const { theme: t, mode, setMode } = useAppTheme();
  const tr = useTranslate();

  const options: { key: ThemeMode; label: string }[] = [
    { key: "light", label: tr("settings.theme.light") },
    { key: "dark", label: tr("settings.theme.dark") },
    { key: "system", label: tr("settings.theme.system") },
  ];

  return (
    <SettingsCard theme={t} id="appearance">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            {tr("settings.group.appearance")}
          </div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
            {tr("settings.theme.desc")}
          </div>
        </div>
        {/* A radio group, not three buttons: exactly one is chosen, and the
            arrow keys should move between them the way they do in any picker. */}
        <div
          role="radiogroup"
          aria-label={tr("settings.group.appearance")}
          style={{
            flex: "none",
            display: "flex",
            gap: 4,
            background: t.cardBg2,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 999,
            padding: 4,
          }}
        >
          {options.map((o) => {
            const active = mode === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(o.key)}
                style={{
                  border: "1px solid transparent",
                  borderRadius: 999,
                  padding: "7px 14px",
                  fontSize: text.xs,
                  fontWeight: active ? 700 : 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: active ? t.ctaBg : "transparent",
                  color: active ? t.ctaText : t.muted,
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </SettingsCard>
  );
}
