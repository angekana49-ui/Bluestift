"use client";

import { useEffect, useState } from "react";

/**
 * Initial open state for a right panel, decided by whether the panel is INLINE
 * or an OVERLAY at the current size.
 *
 * Every screen with a right panel used to start it with `useState(true)`. On a
 * wide screen that is the intended design — the panel is a column beside the
 * content. Below the breakpoints below it is not a column at all: it is a
 * full-height overlay with a scrim, so "open by default" meant arriving on a
 * phone with the panel already covering the screen and a dimmer over everything
 * you came to read. Four screens did this independently (chat, a room, the
 * Schools shell, Raya-for-Schools), which is why this is one hook and not a
 * fifth copy of the same `useState`.
 *
 * FIRST RENDER IS ALWAYS CLOSED, on the server and on the client's first pass,
 * so the two agree and React has nothing to reconcile. The real answer lands in
 * the effect below. The cost is that a desktop visitor's panel appears a frame
 * late; the alternative — guessing the viewport during render — has no answer on
 * the server and corrects itself visibly, which is the worse of the two.
 */

/**
 * The tiers where `.app-right` stops being a column and becomes an overlay.
 *
 * MUST match the media query on `.app-right` in app/globals.css. It is repeated
 * here because there is no way to ask CSS what it decided, and the pair is
 * pinned by a test so the two cannot drift apart silently — a JS copy that
 * disagrees with the stylesheet puts the panel open underneath its own scrim.
 *
 * The coarse-pointer half is what catches tablets: 1366px of width with a finger
 * driving it is not a desktop, and a 270px column plus a content area does not
 * survive being touched.
 */
export const RIGHT_PANEL_OVERLAY_QUERY =
  "(max-width: 899px), (max-width: 1366px) and (pointer: coarse)";

/** True when the right panel would render as an overlay rather than a column. */
export function rightPanelIsOverlay(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  try {
    return window.matchMedia(RIGHT_PANEL_OVERLAY_QUERY).matches;
  } catch {
    // Unknown viewport: treat it as the overlay case. Opening a panel that
    // turns out to cover the screen is the failure worth avoiding.
    return true;
  }
}

/**
 * `[open, setOpen]`, starting closed and opening itself once on mount if the
 * panel is a column at this size. Only the FIRST resolution is automatic: once
 * a person has touched the control, the panel is theirs and a rotation or a
 * window drag must not reopen what they closed.
 */
export function useRightPanel(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!rightPanelIsOverlay()) setOpen(true);
  }, []);

  return [open, setOpen];
}
