"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useTranslate } from "@/components/ui/locale";
import { IconAttach } from "@/components/ui/icons";

/**
 * A file input that looks like the rest of the product.
 *
 * `<input type="file">` renders a browser-drawn "Choose file" control that no
 * stylesheet can reach: it ignores font, colour, radius and border, so it lands
 * as raw OS chrome in the middle of a designed panel — and it looks different on
 * every browser, which makes it the one control that visibly announces the page
 * was not finished.
 *
 * The fix is the standard one: hide the input, drive it from something we draw.
 * The part that usually gets fumbled is which element does the driving. A
 * `<label>` wrapping a hidden input is clickable but NOT focusable, so styling
 * it as a button quietly removes the control from the keyboard — the native
 * widget it replaced was reachable by Tab and fired on Enter/Space. A real
 * `<button>` calling `input.click()` keeps all of that for free, which is why
 * this is a button and not a label.
 *
 * The native control also states its own selection ("no file chosen"), so
 * replacing it silently loses that feedback. Callers that already render their
 * own picked-file chips (rooms-list, room-files) pass nothing; callers that
 * showed nothing pass `fileName` and get the line back.
 */
export function FilePicker({
  onPick,
  accept,
  multiple = false,
  disabled = false,
  label,
  fileName,
  buttonStyle,
  hintStyle,
  wrapperStyle,
  icon = <IconAttach size={14} />,
  ariaLabel,
  /**
   * Clear the input's own value after a pick. Set it when the caller may want
   * the SAME file picked twice in a row (upload, retry): the input fires no
   * change event when its value has not changed, so the second pick would be
   * silently swallowed.
   */
  resetAfterPick = false,
}: {
  onPick: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Defaults to the translated "Choose file" / "Choose files". Pass "" for an
   *  icon-only button — and then pass `ariaLabel`, or it has no accessible name. */
  label?: string;
  /** Current selection, shown next to the button. Omit when the caller renders
   *  its own chips. */
  fileName?: string | null;
  buttonStyle?: CSSProperties;
  hintStyle?: CSSProperties;
  /** For the inline-flex wrapper — e.g. `flex: "none"` inside a flex row. */
  wrapperStyle?: CSSProperties;
  /** Pass null to drop the paperclip. */
  icon?: ReactNode;
  /** Accessible name + tooltip. Required in practice when `label` is "". */
  ariaLabel?: string;
  resetAfterPick?: boolean;
}) {
  const tr = useTranslate();
  const ref = useRef<HTMLInputElement>(null);

  const text = label ?? (multiple ? tr("file.chooseMulti") : tr("file.choose"));

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        minWidth: 0,
        ...wrapperStyle,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => ref.current?.click()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontFamily: "inherit",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.55 : 1,
          ...buttonStyle,
        }}
      >
        {icon}
        {text}
      </button>

      {/* undefined = the caller shows its own chips, so draw nothing at all;
          null = it wants the line and has no file yet. */}
      {fileName !== undefined && (
        <span
          style={{
            fontSize: 13,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 260,
            ...hintStyle,
          }}
          title={fileName ?? undefined}
        >
          {fileName ?? tr("file.none")}
        </span>
      )}

      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        // `hidden` rather than display:none — same result, and it cannot be
        // overridden by an inherited display rule.
        hidden
        onChange={(e) => {
          onPick(e.target.files);
          if (resetAfterPick) e.target.value = "";
        }}
      />
    </span>
  );
}
