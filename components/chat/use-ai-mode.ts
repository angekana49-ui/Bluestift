"use client";

import { useEffect, useState } from "react";
import { readPref, writePref } from "@/lib/shared-pref";
import { getClientEntitlements } from "@/lib/entitlements-client";
import { AI_MODES, DEFAULT_AI_MODE, isAiMode, type AiMode } from "@/lib/raya/modes";

/**
 * Cross-origin (Raya/Schools split) preference key — see lib/shared-pref.ts.
 * Exported so use-chat-engine.ts can read the same value when it builds a
 * send request, without importing this whole hook into a non-component file.
 */
export const AI_MODE_PREF_KEY = "bs_ai_mode";

/**
 * The composer's persona picker: the learner's last choice (persisted via
 * shared-pref, so it survives a reload and follows them across origins the
 * same way the theme/locale do) plus whether their plan actually unlocks
 * anything besides the default.
 *
 * `enabled` is `config.aiModeSwitcher` — pass `false` for a surface that has
 * no persona concept (Raya-for-Schools) and every hook below becomes a no-op,
 * so mounting it unconditionally in ChatComposer costs nothing there.
 *
 * `unlocked` defaults to `true` (fail-open, same contract as
 * getClientEntitlements itself) so a slow or failed entitlements fetch never
 * locks a paying user out of their own picker; the real gate is server-side
 * (app/api/raya/chat/route.ts clamps a disallowed mode back to the default
 * regardless of what this hook believes).
 */
export function useAiMode(enabled: boolean) {
  const [mode, setModeState] = useState<AiMode>(DEFAULT_AI_MODE);
  const [unlocked, setUnlocked] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const stored = readPref(AI_MODE_PREF_KEY);
    if (isAiMode(stored)) setModeState(stored);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void getClientEntitlements().then((e) => {
      if (!alive || !e) return; // fetch failed — stay fail-open
      setUnlocked(e.ent.aiModes);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  function setMode(next: AiMode) {
    setModeState(next);
    writePref(AI_MODE_PREF_KEY, next);
  }

  return { mode: unlocked ? mode : DEFAULT_AI_MODE, setMode, unlocked, modes: AI_MODES };
}
