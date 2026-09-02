"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { useAppTheme } from "@/components/ui/theme";
import { useAppLocale, useTranslate } from "@/components/ui/locale";
import { LOCALES, normalizeLocale } from "@/lib/locale";
import { IconChevron, IconLogout } from "@/components/ui/icons";
import { radius, text, type AppTheme } from "@/components/ui/tokens";
import { RayaText } from "@/components/ui/brand";
import type { ThemeMode } from "@/lib/theme-mode";
import type { MessageKey } from "@/lib/i18n";

/**
 * The settings sheet the sidebar profile chip opens, in both apps.
 *
 * It replaces a five-item popover that had to be a popover: it hung off the
 * chip, so it could only ever hold a handful of rows, and everything else about
 * the account lived on a page you had to navigate away to reach. Settings that
 * are one tap from anywhere is the pattern people already know from the mobile
 * app, and it is the only shape that fits the real list.
 *
 * SHARED FRAME, DIFFERENT CONTENTS. Raya and Schools answer different questions
 * — one is "my learning and my account", the other "this school and my place in
 * it" — so the groups are passed in by each shell rather than branched on here.
 * What the frame owns is what is genuinely common: who you are signed in as,
 * the interface language, the appearance, and the way out.
 *
 * Rows only exist for things that exist. Notifications, connectors and
 * permissions are on the mobile reference and are deliberately absent, because
 * this product has none of them and a row that opens nothing is worse than a
 * row that is missing.
 */

export type SettingsRow = {
  key: string;
  icon: ReactNode;
  label: string;
  /** Second line under the label — the "why", where a label is not enough. */
  sublabel?: string;
  /** Trailing muted text (a plan name, the active school). Ignored with `control`. */
  value?: string;
  /** Replaces the chevron with a control of the caller's own (a switch, a select). */
  control?: ReactNode;
  onSelect?: () => void;
  /** `accent` for an incentive, `danger` for something destructive. */
  tone?: "default" | "accent" | "danger";
};

export type SettingsGroup = {
  key: string;
  /** Small caps heading above the group. Omit for an unlabelled first group. */
  title?: string;
  rows: SettingsRow[];
};

export function SettingsSheet({
  title,
  identity,
  identitySub,
  groups,
  onSignOut,
  onClose,
}: {
  title: string;
  /** The line at the top: the email, or the name when there is no email. */
  identity: string;
  identitySub?: string;
  groups: SettingsGroup[];
  onSignOut: () => void;
  onClose: () => void;
}) {
  const { theme: t, mode, setMode } = useAppTheme();
  const tr = useTranslate();

  return (
    <Modal onClose={onClose} label={title} maxWidth={480}>
      <div
        style={{
          background: t.contentBg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: radius.card,
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            background: t.cardBg,
            borderBottom: `1px solid ${t.cardBorder}`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: text.lg, fontWeight: 750, color: t.text }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("settings.close")}
            title={tr("settings.close")}
            style={{
              flex: "none",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: `1px solid ${t.cardBorder}`,
              background: t.cardBg2,
              color: t.muted,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18, maxHeight: "70vh", overflow: "auto" }}>
          {/* Who you are signed in as. First, because every row below is scoped
              to it — and on a shared school machine it is the thing worth
              checking before you change anything. */}
          <div
            style={{
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: radius.panel,
              padding: "12px 14px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: text.sm,
                fontWeight: 650,
                color: t.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {identity}
            </div>
            {identitySub && (
              <div style={{ fontSize: text.xs, color: t.muted, marginTop: 2 }}>
                <RayaText>{identitySub}</RayaText>
              </div>
            )}
          </div>

          {groups.map((g) => (
            <Group key={g.key} theme={t} group={g} onClose={onClose} />
          ))}

          {/* Language — common to both apps, so the frame owns it. A control
              row rather than a link: there is nowhere else for it to go. */}
          <Group
            theme={t}
            onClose={onClose}
            group={{
              key: "app",
              title: tr("settings.group.app"),
              rows: [
                {
                  key: "language",
                  icon: <IconGlobe />,
                  label: tr("settings.language.title"),
                  control: <LocalePicker theme={t} />,
                },
              ],
            }}
          />

          <Appearance theme={t} mode={mode} onPick={setMode} tr={tr} />

          <button
            type="button"
            onClick={onSignOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "13px 14px",
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: radius.panel,
              color: "#dc2626",
              fontFamily: "inherit",
              fontSize: text.sm,
              fontWeight: 650,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <IconLogout />
            {tr("menu.signOut")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** One bordered group of rows, with its small-caps heading. */
function Group({
  theme: t,
  group,
  onClose,
}: {
  theme: AppTheme;
  group: SettingsGroup;
  onClose: () => void;
}) {
  if (group.rows.length === 0) return null;
  return (
    <div>
      {group.title && (
        <div
          style={{
            fontSize: text.xs,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: t.mutedLight,
            margin: "0 4px 8px",
          }}
        >
          {group.title}
        </div>
      )}
      <div
        style={{
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: radius.panel,
          overflow: "hidden",
        }}
      >
        {group.rows.map((r, i) => (
          <Row key={r.key} theme={t} row={r} first={i === 0} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

function Row({
  theme: t,
  row,
  first,
  onClose,
}: {
  theme: AppTheme;
  row: SettingsRow;
  first: boolean;
  onClose: () => void;
}) {
  const accent = row.tone === "accent";
  const danger = row.tone === "danger";
  const ink = danger ? "#dc2626" : t.text;
  const accentInk = t.dark ? "#a5b4fc" : "#4f46e5";

  const body = (
    <>
      <span style={{ flex: "none", display: "flex", color: accent ? accentInk : danger ? "#dc2626" : t.muted }}>
        {row.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: text.sm,
            fontWeight: 600,
            color: accent ? accentInk : ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <RayaText>{row.label}</RayaText>
        </span>
        {row.sublabel && (
          <span style={{ display: "block", fontSize: text.xs, color: accent ? accentInk : t.mutedLight, marginTop: 1 }}>
            <RayaText>{row.sublabel}</RayaText>
          </span>
        )}
      </span>
      {row.control ? (
        row.control
      ) : (
        <>
          {row.value && (
            <span
              style={{
                flex: "none",
                fontSize: text.xs,
                color: t.mutedLight,
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.value}
            </span>
          )}
          {row.onSelect && (
            <IconChevron
              size={12}
              style={{ flex: "none", transform: "rotate(-90deg)", color: t.mutedLight }}
            />
          )}
        </>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "13px 14px",
    background: accent ? (t.dark ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.07)") : "transparent",
    border: "none",
    borderTop: first ? "none" : `1px solid ${t.cardBorder}`,
    textAlign: "left",
    fontFamily: "inherit",
    color: ink,
  };

  // A row with a control is not itself a button — the control is. Wrapping one
  // in a <button> would nest interactive elements and swallow the inner click.
  if (row.control || !row.onSelect) {
    return <div style={style}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        row.onSelect?.();
      }}
      style={{ ...style, cursor: "pointer" }}
    >
      {body}
    </button>
  );
}

function LocalePicker({ theme: t }: { theme: AppTheme }) {
  const { locale, setLocale } = useAppLocale();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(normalizeLocale(e.target.value))}
      style={{
        flex: "none",
        background: t.inputBg,
        border: `1px solid ${t.inputBorder}`,
        borderRadius: radius.control,
        padding: "7px 10px",
        fontSize: text.xs,
        fontWeight: 650,
        fontFamily: "inherit",
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
  );
}

/**
 * Light / Dark / System, as three swatches rather than a switch.
 *
 * A two-state switch cannot say "follow my device", which is the answer most
 * people actually want and the one the app now defaults to. Three options need
 * three targets, and showing each as a miniature of the thing it produces means
 * the choice is legible before it is made.
 */
function Appearance({
  theme: t,
  mode,
  onPick,
  tr,
}: {
  theme: AppTheme;
  mode: ThemeMode;
  onPick: (m: ThemeMode) => void;
  tr: (k: MessageKey) => string;
}) {
  const options: { key: ThemeMode; label: string }[] = [
    { key: "light", label: tr("settings.theme.light") },
    { key: "dark", label: tr("settings.theme.dark") },
    { key: "system", label: tr("settings.theme.system") },
  ];
  return (
    <div>
      <div
        style={{
          fontSize: text.xs,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: t.mutedLight,
          margin: "0 4px 8px",
        }}
      >
        {tr("settings.group.appearance")}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: radius.panel,
          padding: 12,
        }}
      >
        {options.map((o) => {
          const active = mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(o.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 7,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <ThemeSwatch kind={o.key} active={active} theme={t} />
              <span
                style={{
                  fontSize: text.xs,
                  fontWeight: active ? 700 : 600,
                  color: active ? t.link : t.muted,
                }}
              >
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A miniature of the surface each option produces. `system` is split down the
 *  diagonal, which is the one drawing that says "either, depending". */
function ThemeSwatch({
  kind,
  active,
  theme: t,
}: {
  kind: ThemeMode;
  active: boolean;
  theme: AppTheme;
}) {
  const LIGHT = "#ffffff";
  const DARK = "#1c2230";
  const bg = kind === "dark" ? DARK : LIGHT;
  const line = kind === "dark" ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.32)";
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        aspectRatio: "4 / 3",
        borderRadius: 10,
        overflow: "hidden",
        background: bg,
        border: active ? `2px solid ${t.link}` : `1px solid ${t.controlBorder}`,
        boxSizing: "border-box",
      }}
    >
      {/* The dark half of the system swatch, laid over the light base. */}
      {kind === "system" && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: DARK,
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          }}
        />
      )}
      {/* Two rules and a dot — the shape of a card, at this size. */}
      <span style={{ position: "absolute", left: "16%", top: "26%", width: "48%", height: 3, borderRadius: 2, background: line }} />
      <span style={{ position: "absolute", left: "16%", top: "44%", width: "32%", height: 3, borderRadius: 2, background: line }} />
      <span
        style={{
          position: "absolute",
          right: "16%",
          bottom: "18%",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "#c2703f",
        }}
      />
    </span>
  );
}

function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  );
}
