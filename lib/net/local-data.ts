"use client";

import { clearNetCaches } from "./client-fetch";
import { clearOutbox } from "./outbox";
import { clearBlobs } from "./blob-store";

/** Kept literal here, not imported: this module must not pull a page component in. */
const MATH_STUDIO_KEY = "bs_math_studio";

/**
 * Wipe every locally retained piece of USER DATA (cached API responses,
 * queued chat text, retained voice/file blobs, the maths workbench). MUST be called on sign-out:
 * Bluestift runs on shared school machines, and a queued message or a voice
 * note must never survive into the next student's session. Preferences
 * (theme, locale, consent) are deliberately untouched.
 */
export async function clearLocalData(): Promise<void> {
  clearNetCaches();
  clearOutbox();
  try {
    // The Tools page's maths workbench (components/math-studio.tsx).
    localStorage.removeItem(MATH_STUDIO_KEY);
  } catch {
    // best-effort
  }
  try {
    await clearBlobs();
  } catch {
    // best-effort
  }
}
