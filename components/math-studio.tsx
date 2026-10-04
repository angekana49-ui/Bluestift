"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { useTranslate } from "@/components/ui/locale";
import { MathBench } from "@/components/chat/math-tools";
import type { MathBlockLang } from "@/lib/math-blocks";
import type { MessageKey } from "@/lib/i18n";

/**
 * The graph or the calculator in the Maths panel (components/raya/maths-dock.tsx),
 * on the right of every Raya screen. The same tools Raya puts in a reply,
 * opened directly, with no conversation needed.
 *
 * What the learner last wrote is kept on THIS device so a reload does not lose
 * it, and wiped on sign-out with the rest of the retained data
 * (lib/net/local-data.ts) — school machines are shared.
 */

export const MATH_STUDIO_KEY = "bs_math_studio";

/**
 * What a first visit opens on: written the way a student writes, so the
 * example IS the instructions. The words ("dérivée", "résoudre") are in the
 * reader's language; the tool reads them in any of the four.
 */
function examples(tr: (k: MessageKey) => string): Record<MathBlockLang, string> {
  return {
    graph: ["f(x) = x² − 3", "g(x) = a·x + 1", "x: -5..5"].join("\n"),
    calc: ["3,5 × 4", "√(3² + 4²)", "2x + 3 = 7", "x² − 5x + 6 = 0", `${tr("math.word.derivative")} x³ + 2x`].join("\n"),
  };
}

type Saved = Partial<Record<MathBlockLang, string>>;

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(MATH_STUDIO_KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

/** Put content into a tool for the panel to open on — a graph Raya drew, say. */
export function saveMathTool(lang: MathBlockLang, src: string) {
  writeSaved({ ...readSaved(), [lang]: src });
}

function writeSaved(next: Saved) {
  try {
    localStorage.setItem(MATH_STUDIO_KEY, JSON.stringify(next));
  } catch {
    // private window or full storage: the tool still works, it just won't remember
  }
}

export function MathPanel({ lang }: { lang: MathBlockLang }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  // Read after mount, not during render: the server has no storage, and a first
  // render that differed from its HTML would be a hydration mismatch. The tool
  // waits for it, so it starts from the saved text rather than jumping to it.
  const [saved, setSaved] = useState<Saved | null>(null);
  useEffect(() => {
    setSaved(readSaved());
  }, []);
  if (!saved) return null;

  const example = examples(tr)[lang];
  return (
    <div style={{ fontSize: 15 }}>
      <MathBench
        // Keyed by tool so switching starts that tool from ITS saved state.
        key={lang}
        lang={lang}
        example={example}
        theme={t}
        bench={{
          start: saved[lang] ?? example,
          note: tr("tools.math.saved"),
          onChange: (src) => {
            const next = { ...readSaved(), [lang]: src };
            setSaved(next);
            writeSaved(next);
          },
        }}
      />
    </div>
  );
}
