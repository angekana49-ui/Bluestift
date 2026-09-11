"use client";

import { formatRecoveryKey, maskedRecoveryKey, RECOVERY_KEY_GROUP } from "@/lib/recovery-key";

/** The four colours this box needs, so both palettes can supply their own —
 *  onboarding is a light-only screen with literal hexes, the account page is
 *  themed. */
export type RecoveryKeyPalette = {
  bg: string;
  border: string;
  text: string;
  /** The last group's tint, where `highlightTail` is on. */
  highlight: string;
};

/**
 * The recovery key, readable in full on the narrowest screen we ship.
 *
 * It used to be one nowrap line with `overflow: hidden` and an ellipsis, in a
 * flex cell sharing its row with three buttons. On a phone that cell is about
 * 150px and the key is 19 characters, so the key was cut off — and cut off at
 * the END, which is the half that matters: onboarding asks the person to retype
 * the LAST FOUR characters as evidence they kept it. Nowrap plus hidden is also
 * unscrollable and unswipeable, so there was no way to reach them: the only way
 * through that screen was to copy the key out to some other app, read it there,
 * and come back. A confirmation step that cannot be completed inside the app is
 * not a confirmation step.
 *
 * So: the box takes a full row of its own, and the key WRAPS — a hyphen is a
 * break opportunity, so it breaks between groups and never mid-group. It stays
 * a single run of text (the tail is an inline <strong>, not a flex child), so
 * selecting the box and copying still yields exactly `XXXX-XXXX-XXXX-XXXX`.
 */
export function RecoveryKeyCode({
  code,
  shown,
  palette,
  highlightTail = false,
  emptyLabel,
}: {
  code: string | null;
  /** Revealed, or dots. The dotted form is grouped the same way, so revealing
   *  it cannot make the layout jump. */
  shown: boolean;
  palette: RecoveryKeyPalette;
  /** Tint the last group — use it where that group is what is being asked for. */
  highlightTail?: boolean;
  /** Shown in place of the key when there is none (a reload: it is issued once
   *  and never stored in the clear). */
  emptyLabel?: string;
}) {
  const full = code ? formatRecoveryKey(code) : null;
  // The dashes make the split: the last group is everything after the last one.
  const cut = full ? full.length - RECOVERY_KEY_GROUP : 0;

  return (
    <code
      style={{
        // Its own row, at every width. Sharing one with the reveal / copy /
        // download pills is what squeezed it to an ellipsis in the first place.
        flexBasis: "100%",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 16,
        lineHeight: 1.6,
        letterSpacing: shown ? "0.12em" : "0.24em",
        color: palette.text,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        // `all`: one tap selects the whole key rather than a group of it.
        userSelect: shown ? "all" : "none",
        // The point of the whole file — never a cut-off key.
        whiteSpace: "normal",
        overflowWrap: "break-word",
      }}
    >
      {full == null ? (
        emptyLabel
      ) : shown ? (
        <>
          {full.slice(0, cut)}
          <strong
            style={
              highlightTail
                ? {
                    fontWeight: 800,
                    background: palette.highlight,
                    borderRadius: 5,
                    padding: "2px 3px",
                  }
                : { fontWeight: "inherit" }
            }
          >
            {full.slice(cut)}
          </strong>
        </>
      ) : (
        maskedRecoveryKey(code)
      )}
    </code>
  );
}
