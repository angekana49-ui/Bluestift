"use client";

import { clearNetCaches } from "./client-fetch";
import { clearOutbox } from "./outbox";
import { clearBlobs } from "./blob-store";

/**
 * Wipe every locally retained piece of USER DATA (cached API responses,
 * queued chat text, retained voice/file blobs). MUST be called on sign-out:
 * Bluestift runs on shared school machines, and a queued message or a voice
 * note must never survive into the next student's session. Preferences
 * (theme, locale, consent) are deliberately untouched.
 */
export async function clearLocalData(): Promise<void> {
  clearNetCaches();
  clearOutbox();
  try {
    await clearBlobs();
  } catch {
    // best-effort
  }
}
