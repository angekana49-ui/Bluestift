"use client";

import { readPref, writePref } from "@/lib/shared-pref";

/**
 * Light / Dark / System, over the one storage key both surfaces already share.
 *
 * The app and the marketing site each had their own dark hook, and each did the
 * same two things inline: `readPref(THEME_KEY) === "1"`. That worked while the
 * setting was a boolean. A third state cannot be bolted onto a boolean in two
 * places independently — the moment one of them writes "system" the other reads
 * `!== "1"` and renders light, which is wrong exactly when the OS is dark. So
 * the resolution lives here, once, and both hooks call it.
 *
 * BACKWARD COMPATIBLE by construction. The key keeps its "1"/"0" vocabulary for
 * the two explicit answers, so every preference stored before this module
 * existed keeps meaning what it meant. "system" is a new third word, and an
 * ABSENT key now means system rather than light.
 *
 * That last part is a deliberate change of default. "No answer" is not "light" —
 * it is "nobody has said", and the honest reading of that is to follow the
 * device. A person who never opened Settings and runs a dark phone was being
 * handed a white screen on the grounds that they had not asked for anything.
 */

export const THEME_KEY = "bluestift-dark";

export type ThemeMode = "light" | "dark" | "system";

/** The stored answer. Never throws; "system" on the server and when unset. */
export function readThemeMode(): ThemeMode {
  const raw = readPref(THEME_KEY);
  if (raw === "1") return "dark";
  if (raw === "0") return "light";
  if (raw === "system") return "system";
  return "system";
}

/** Persist an answer, in the vocabulary the old readers already understand. */
export function writeThemeMode(mode: ThemeMode): void {
  writePref(THEME_KEY, mode === "dark" ? "1" : mode === "light" ? "0" : "system");
}

/** Parse a raw stored value — for the `storage` event, which hands one over. */
export function parseThemeMode(raw: string | null): ThemeMode {
  if (raw === "1") return "dark";
  if (raw === "0") return "light";
  return "system";
}

/**
 * What the DEVICE says. False on the server and wherever `matchMedia` is
 * missing, which resolves "system" to light — the same value both hooks render
 * on their first pass, so a missing API degrades to the existing behaviour
 * rather than to a hydration mismatch.
 */
export function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** The mode plus the device, resolved to the one boolean the themes take. */
export function resolveDark(mode: ThemeMode, systemDark: boolean): boolean {
  return mode === "system" ? systemDark : mode === "dark";
}

/**
 * Subscribe to the device preference. Returns an unsubscribe, and a no-op when
 * `matchMedia` is unavailable — so a caller never has to check.
 *
 * Live rather than read-once: on "system" the app has to follow the OS as it
 * changes, including the automatic sunset switch, which happens while the tab
 * is open and would otherwise leave the page on yesterday's answer.
 */
export function watchSystemTheme(onChange: (dark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => onChange(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  } catch {
    return () => {};
  }
}
