"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { displayType, status as statusColors } from "@/components/ui/tokens";
import { useTranslate } from "@/components/ui/locale";
import { MathBench } from "@/components/chat/math-tools";
import type { MathBlockLang } from "@/lib/math-blocks";

/**
 * The maths tools on the Tools page — the same graph and calculator Raya puts
 * in a reply, opened by the learner directly, with no conversation needed.
 *
 * What the learner last ran is kept on THIS device so a reload does not lose
 * it, and wiped on sign-out with the rest of the retained data
 * (lib/net/local-data.ts) — school machines are shared.
 */

export const MATH_STUDIO_KEY = "bs_math_studio";

const EXAMPLES: Record<MathBlockLang, string> = {
  graph: ["f(x) = x^2 - 3", "g(x) = a*x + 1", "a = 1 (-5..5)", "x: -5..5"].join("\n"),
  calc: ["a = 3", "b = 4", "sqrt(a^2 + b^2)", 'derivative("x^3 + 2x", "x")', "det([1, 2; 3, 4])"].join("\n"),
};

type Saved = Partial<Record<MathBlockLang, string>> & { last?: MathBlockLang };

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(MATH_STUDIO_KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

function writeSaved(next: Saved) {
  try {
    localStorage.setItem(MATH_STUDIO_KEY, JSON.stringify(next));
  } catch {
    // private window or full storage: the tool still works, it just won't remember
  }
}

export function MathStudio() {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const [saved, setSaved] = useState<Saved>({});
  const [lang, setLang] = useState<MathBlockLang>("graph");
  // Read after mount, not during render: the server has no storage, and a first
  // render that differed from its HTML would be a hydration mismatch. `ready`
  // holds the tool back until then, so it starts from the saved text.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const s = readSaved();
    setSaved(s);
    if (s.last) setLang(s.last);
    setReady(true);
  }, []);

  const remember = (patch: Saved) => {
    const next = { ...saved, ...patch };
    setSaved(next);
    writeSaved(next);
  };

  const tabs: { id: MathBlockLang; glyph: string; label: string }[] = [
    { id: "graph", glyph: "ƒ", label: tr("math.graph") },
    { id: "calc", glyph: "=", label: tr("math.calc") },
  ];

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ ...displayType(19), color: t.text }}>{tr("tools.math.title")}</div>
      <div style={{ fontSize: 15, color: t.muted, marginTop: 4, marginBottom: 14 }}>{tr("tools.math.subtitle")}</div>

      <div role="tablist" style={{ display: "flex", gap: 10, marginBottom: 4 }}>
        {tabs.map((x) => {
          const on = lang === x.id;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setLang(x.id);
                remember({ last: x.id });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: t.cardBg2,
                border: `1px solid ${on ? statusColors.aiIndigo : t.cardBorder}`,
                boxShadow: on ? `0 0 0 1px ${statusColors.aiIndigo}` : "none",
                borderRadius: 14,
                padding: "10px 14px",
                cursor: "pointer",
                color: t.text,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              <span
                aria-hidden
                style={{ width: 28, height: 28, borderRadius: 9, background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontStyle: "italic" }}
              >
                {x.glyph}
              </span>
              {x.label}
            </button>
          );
        })}
      </div>

      {/* Keyed by tool so switching starts that tool from ITS saved state. */}
      <div style={{ fontSize: 16 }}>
        {ready && (
          <MathBench
            key={lang}
            lang={lang}
            example={EXAMPLES[lang]}
            theme={t}
            bench={{
              start: saved[lang] ?? EXAMPLES[lang],
              hint: tr(lang === "graph" ? "tools.math.graphHint" : "tools.math.calcHint"),
              note: tr("tools.math.saved"),
              onApply: (src) => remember({ [lang]: src, last: lang }),
            }}
          />
        )}
      </div>
    </section>
  );
}
