"use client";

import { useEffect, useRef, useState } from "react";
import { IconGlobe } from "@/components/ui/icons";
import { text, type AppTheme } from "@/components/ui/tokens";
import { LANGUAGES, type LangCode } from "@/lib/languages";

/**
 * The reply-language picker shown in every chat composer: a compact globe + 2-
 * letter chip that opens a small popover of the four supported languages. The
 * popover opens upward (the composer sits at the bottom edge) and closes on an
 * outside click. Purely controlled — the value + persistence live in the caller
 * (see useReplyLanguage), so every surface stays in sync.
 */
export function LanguageMenu({
  theme: t,
  value,
  onChange,
  disabled = false,
}: {
  theme: AppTheme;
  value: LangCode;
  onChange: (l: LangCode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={`Reply language — ${current.label}`}
        style={{
          height: 38,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "0 11px",
          borderRadius: 999,
          border: `1px solid ${t.cardBorder}`,
          background: open ? t.sidebarActiveBg : t.cardBg2,
          color: t.mutedLight,
          fontSize: text.xs,
          fontWeight: 700,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <IconGlobe size={15} />
        {current.short}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            zIndex: 20,
            minWidth: 168,
            background: t.cardBg2,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 12,
            boxShadow: t.cardShadow,
            padding: 6,
          }}
        >
          <div style={{ fontSize: text.xs, fontWeight: 700, color: t.mutedLight, padding: "4px 8px 6px" }}>
            Reply language
          </div>
          {LANGUAGES.map((l) => {
            const active = l.code === value;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  onChange(l.code);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: active ? t.sidebarActiveBg : "transparent",
                  color: t.text,
                  fontSize: text.sm,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ width: 22, flex: "none", fontSize: text.xs, fontWeight: 700, color: t.mutedLight }}>
                  {l.short}
                </span>
                <span style={{ flex: 1 }}>{l.label}</span>
                {active && <span style={{ color: t.mutedLight }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
