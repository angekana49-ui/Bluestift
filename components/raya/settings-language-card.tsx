"use client";

import { useAppTheme } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";
import { useAppLocale, useTranslate } from "@/components/ui/locale";
import { LOCALES, normalizeLocale } from "@/lib/locale";

/**
 * Settings "Language" card — picks the app's INTERFACE language (English default,
 * plus Français / Español / Deutsch). Shared by the three settings screens
 * (Raya /account, the school admin dashboard, the teacher dashboard).
 *
 * It reads and writes the SHARED locale (via `useAppLocale`, backed by the
 * scaffold's `LocaleProvider`), so changing it here re-renders the nav and the
 * rest of the chrome immediately — before the provider existed, each `useLocale`
 * call was its own island and only this card updated. Its own labels come from
 * the normal catalogue now, not a private inline dictionary.
 *
 * It does NOT change the language Raya replies in — the tutor still answers in
 * the student's own language.
 */
export function SettingsLanguageCard() {
  const { theme: t } = useAppTheme();
  const { locale, setLocale } = useAppLocale();
  const tr = useTranslate();
  return (
    <SettingsCard theme={t}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{tr("settings.language.title")}</div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{tr("settings.language.desc")}</div>
        </div>
        <select
          value={locale}
          onChange={(e) => setLocale(normalizeLocale(e.target.value))}
          style={{
            flex: "none",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 15,
            fontWeight: 600,
            color: t.text,
            cursor: "pointer",
            outline: "none",
          }}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </SettingsCard>
  );
}
