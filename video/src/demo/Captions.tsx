import { phraseAt, type Phrase } from "./transcript";
import { FONTS } from "../brand";
import { PAL } from "../film/kit";
import { span } from "../motion";

/**
 * The captions: a bottom-center pill, Inter semibold 42 px, at most two
 * lines. Words light up as they are said; each phrase's one keyword is set
 * in amber. The text comes from the transcript (ElevenLabs tags were never
 * in it), never from the cues file.
 */

function splitLines(p: Phrase): { word: string; at: number }[][] {
  const words = p.words;
  if (words.length <= 6) return [words];
  const total = words.reduce((a, w) => a + w.word.length, 0);
  let acc = 0;
  let cut = Math.ceil(words.length / 2);
  let best = Infinity;
  for (let i = 2; i < words.length - 1; i++) {
    acc += words[i - 1].word.length;
    const score = Math.abs(acc - total / 2) - (/[,:;.!?…]$/.test(words[i - 1].word) ? 4 : 0);
    if (score < best) {
      best = score;
      cut = i;
    }
  }
  return [words.slice(0, cut), words.slice(cut)];
}

export function DemoCaptions({ t }: { t: number }) {
  const p = phraseAt(t);
  if (!p) return null;
  const fadeIn = span(t, p.start, p.start + 0.18);
  const fadeOut = 1 - span(t, p.end + 0.1, p.end + 0.35);
  const opacity = Math.min(fadeIn, fadeOut);
  if (opacity <= 0.01) return null;

  const lines = splitLines(p);
  // Same rule as wordAt: edge punctuation stripped, inner dots kept, so a
  // trailing "thebluestift.com." still matches its keyword.
  const clean = (w: string) => w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, "");
  const keyword = p.keyword.toLowerCase();
  let current = -1;
  p.words.forEach((w, i) => {
    if (t >= w.at - 0.02) current = i;
  });

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center", opacity, pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1520,
          background: "rgba(5,9,19,0.74)",
          border: "1px solid rgba(159,214,255,0.16)",
          borderRadius: 22,
          padding: "16px 36px 20px",
          textAlign: "center",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        }}
      >
        {lines.map((line, li) => (
          <div key={li} style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: 42, lineHeight: 1.32, letterSpacing: "-0.01em" }}>
            {line.map((w, i) => {
              const global = p.words.indexOf(w);
              const spoken = global <= current;
              const isCurrent = global === current;
              const isKeyword = clean(w.word) === keyword || (keyword.includes(" ") && clean(w.word) === keyword.split(" ")[0]);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    color: isKeyword ? PAL.amber : spoken ? PAL.ice : "rgba(238,246,255,0.42)",
                    background: isCurrent ? "rgba(75,155,255,0.32)" : "transparent",
                    borderRadius: 10,
                    padding: "0 8px",
                    margin: "0 1px",
                    fontWeight: isKeyword || isCurrent ? 700 : 600,
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
