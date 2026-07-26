"use client";

import { useAppTheme } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";
import { useLocale } from "@/lib/use-locale";
import { LOCALES, translate, normalizeLocale, type Dict } from "@/lib/locale";

/**
 * Settings "Language" card — picks the app's INTERFACE language (English default,
 * plus Français / Español / Deutsch). Shared by the three settings screens
 * (Raya /account, the school admin dashboard, the teacher dashboard). The choice
 * is persisted via `useLocale`; the card localizes its own labels so switching
 * visibly does something. It does NOT change the language Raya replies in — the
 * tutor still answers in the student's own language.
 */
const STRINGS: Dict = {
  en: { title: "Language", desc: "Choose the language of the app interface" },
  fr: { title: "Langue", desc: "Choisissez la langue de l’interface" },
  es: { title: "Idioma", desc: "Elige el idioma de la interfaz" },
  de: { title: "Sprache", desc: "Wählen Sie die Sprache der Oberfläche" },
};

export function SettingsLanguageCard() {
  const { theme: t } = useAppTheme();
  const { locale, setLocale } = useLocale();
  return (
    <SettingsCard theme={t}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{translate(STRINGS, locale, "title")}</div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{translate(STRINGS, locale, "desc")}</div>
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
