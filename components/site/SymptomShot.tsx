"use client";

import type { Theme } from "./theme";
import { useTranslate } from "@/components/ui/locale";
import { eyebrow } from "./layout";

/**
 * The symptom, staged as two homework copies answering the same exercise.
 *
 * This replaced a time-axis diagram arguing "the layer between the two you
 * already buy" — LMS instants vs tutor instants vs a continuous state, with a
 * live gauge and a counterfactual branch. It was written under time pressure
 * and it showed: an 18-second cycle nobody watches to the end, arguing a
 * position the project no longer holds.
 *
 * The line now is the dissociation thesis (see the hero and the connection
 * band), and this section is its entry point: AI laundered the homework, so
 * the teacher's last signal channel is gone. That claim needs no chart. One
 * attempt with a visible error next to one perfect, silent copy makes it in a
 * glance — wrong-and-readable vs right-and-mute.
 *
 * The two hands are deliberate: the attempt is set in Caveat, a human writing;
 * what came back is set in monospace, a machine printing. The red wobble is
 * the whole diagnosis — distributivity slipping on the first line. The verdict
 * under the right answer is set in muted on purpose: the copy that says
 * nothing literally fades.
 *
 * Static, with no loop. A still that reads in three seconds is the fix for a
 * drawing that needed eighteen; the scroll reveal on the cards is all the
 * motion it gets.
 */

const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
const HAND = "var(--font-caveat),'Caveat',cursive";

/** Both copies answer this. Maths is locale-independent, so it stays literal. */
const EXERCISE = "2(x − 3) = 8";

export function SymptomAttempt({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  // Same error red the Kernel graph uses for a failed concept.
  const err = t.dark ? "#f87171" : "#dc2626";
  return (
    <Paper
      theme={t}
      kicker={tr("site.pos.card.attempt")}
      exercise={tr("site.pos.exercise")}
      verdict={tr("site.pos.verdict.attempt")}
      verdictColor={t.text}
      hand
    >
      {/* 2(x−3) expanded to 2x−3: the ×2 never reached the 3, and everything
          after it is correct arithmetic on a broken first line. */}
      <div>
        2x{" "}
        <span style={{ textDecoration: "underline wavy", textDecorationColor: err, textUnderlineOffset: 5, textDecorationThickness: 2 }}>
          − 3
        </span>{" "}
        = 8
      </div>
      <div>2x = 11</div>
      <div>x = 5.5</div>
    </Paper>
  );
}

export function SymptomReturned({ theme: t }: { theme: Theme }) {
  const tr = useTranslate();
  return (
    <Paper
      theme={t}
      kicker={tr("site.pos.card.returned")}
      exercise={tr("site.pos.exercise")}
      verdict={tr("site.pos.verdict.returned")}
      verdictColor={t.muted}
    >
      <div>{EXERCISE}</div>
      <div>x − 3 = 4</div>
      <div>
        x = 7{" "}
        <span style={{ color: t.diffStrong, fontWeight: 700 }}>✓</span>
      </div>
    </Paper>
  );
}

function Paper({
  theme: t,
  kicker,
  exercise,
  verdict,
  verdictColor,
  hand,
  children,
}: {
  theme: Theme;
  kicker: string;
  exercise: string;
  verdict: string;
  verdictColor: string;
  hand?: boolean;
  children: React.ReactNode;
}) {
  const margin = t.dark ? "rgba(248,113,113,0.45)" : "rgba(220,38,38,0.3)";
  return (
    <div
      className="pub-lift"
      style={{
        height: "100%",
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 20,
        boxShadow: t.cardShadow,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={eyebrow(t)}>{kicker}</div>
      <div style={{ fontSize: 13.5, color: t.muted }}>{exercise}</div>
      {/* A notebook page: tinted block with a red margin rule. The rule is a
          single vertical line rather than horizontal ruling because ruling has
          to match the text rhythm to the pixel or it reads as broken — and the
          two hands here don't share a rhythm. */}
      <div
        style={{
          background: t.inputFieldBg,
          backgroundImage: `linear-gradient(90deg, transparent 0 30px, ${margin} 30px 32px, transparent 32px)`,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: 14,
          padding: hand ? "12px 18px 12px 48px" : "14px 18px 14px 48px",
          fontFamily: hand ? HAND : MONO,
          fontSize: hand ? 25 : 15.5,
          lineHeight: hand ? 1.75 : 2,
          color: t.text,
        }}
      >
        {children}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.5, color: verdictColor }}>{verdict}</div>
    </div>
  );
}
