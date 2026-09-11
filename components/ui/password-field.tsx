"use client";

import { useId, useState } from "react";
import { fieldInput, fieldLabel } from "@/components/ui/auth-chrome";
import { useTranslate } from "@/components/ui/locale";
import type { AppTheme } from "@/components/ui/tokens";

/**
 * A password box with a reveal toggle, shared by every surface that asks for
 * one: /login, onboarding, /reset and the Settings card.
 *
 * The toggle is not a nicety. Typing a password you cannot see, on a phone
 * keyboard, is the single biggest source of "wrong password" on a form whose
 * only other route in is an email that takes a minute to arrive — and this
 * product's users are often children on borrowed hardware. It starts hidden,
 * because the other half of that story is a classroom with someone behind you.
 *
 * Light by default (the auth surfaces are light-only, see ui/auth-chrome);
 * pass `theme` inside the app shell so it matches the page behind it.
 */
export function PasswordField({
  value,
  onChange,
  label,
  placeholder,
  autoComplete,
  hint,
  problem,
  disabled = false,
  theme,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  /** "current-password" signing in, "new-password" everywhere else — it decides
   *  whether a password manager offers to fill or to save. */
  autoComplete: "current-password" | "new-password";
  hint?: string;
  /** Why this password isn't acceptable yet. Shown instead of the hint. */
  problem?: string | null;
  disabled?: boolean;
  theme?: AppTheme;
  onEnter?: () => void;
}) {
  const tr = useTranslate();
  const id = useId();
  const [shown, setShown] = useState(false);

  const input = theme
    ? {
        ...fieldInput,
        background: theme.inputBg,
        color: theme.text,
        border: `1.5px solid ${theme.inputBorder}`,
      }
    : fieldInput;
  const labelStyle = theme ? { ...fieldLabel, color: theme.text } : fieldLabel;
  const muted = theme?.muted ?? "#64748b";

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          // Room on the right for the toggle, which sits INSIDE the box so the
          // field keeps the same width as the email input above it.
          style={{ ...input, marginBottom: 0, width: "100%", paddingRight: 76 }}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          // The value is already on screen when shown; announcing the toggle's
          // action is what a screen reader needs, not the state.
          aria-label={shown ? tr("pw.hide") : tr("pw.show")}
          style={{
            position: "absolute",
            top: "50%",
            right: 10,
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            padding: "4px 6px",
            fontSize: 14,
            fontWeight: 600,
            color: muted,
            cursor: "pointer",
          }}
        >
          {shown ? tr("pw.hide") : tr("pw.show")}
        </button>
      </div>
      {(problem || hint) && (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 14,
            lineHeight: 1.5,
            color: problem ? "#b91c1c" : muted,
          }}
        >
          {problem || hint}
        </p>
      )}
    </div>
  );
}
