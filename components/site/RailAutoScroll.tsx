"use client";

import { useEffect, type RefObject } from "react";

/**
 * The phone rail, driven.
 *
 * A rail that only moves when it is pushed is a rail most visitors never find:
 * on a 390px screen the third card is off-screen with no affordance saying so,
 * and the section reads as two cards rather than three. So the rail advances
 * on its own, one card every few seconds — enough to prove there is more
 * without turning a comparison into a carousel.
 *
 * It is never in charge, though. The moment a finger touches it the timer is
 * dropped, and it only takes the wheel back a few seconds AFTER the finger
 * leaves, so a visitor reading card two is not fought for the position. At
 * either end it turns around and walks back (ping-pong) rather than jumping to
 * the other end: a rewind from the last card to the first is one long smooth
 * scroll across the whole rail, which reads as a glitch, where a turn reads as
 * the rail still browsing.
 *
 * Phone-only by measurement and not by class: above 600px this is a plain
 * grid with nothing to scroll, and `prefers-reduced-motion` opts out entirely
 * — an auto-advancing surface is exactly what that setting is asking us not
 * to do.
 */

/** How long a card is left on screen before the rail moves to the next. */
const STEP_MS = 3600;
/** Grace after the finger leaves, so the rail does not snatch the scroll back. */
const RESUME_MS = 4000;
/** Slack for the end test — snap points rarely land on an exact pixel. */
const END_SLACK = 4;

/**
 * One ping-pong step, as a pure function.
 *
 * Kept outside the hook so the direction logic is unit-testable without a DOM
 * (vitest runs in node): `scrollLeft` is where the rail is, `maxScroll` is
 * `scrollWidth - clientWidth`, `dir` the current walking direction. At either
 * end the direction flips and the step leaves from where the rail actually is —
 * never a jump to the opposite end. The browser clamps a target past an edge,
 * which is what makes the turn exact even when the pitch doesn't divide the
 * rail evenly.
 */
export function railStep(
  scrollLeft: number,
  maxScroll: number,
  dir: 1 | -1,
  pitch: number,
): { left: number; dir: 1 | -1 } {
  let d = dir;
  if (scrollLeft >= maxScroll - END_SLACK) d = -1;
  else if (scrollLeft <= END_SLACK) d = 1;
  return { left: scrollLeft + d * pitch, dir: d };
}

export function useRailAutoScroll(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;

    const phone = window.matchMedia?.("(max-width: 600px)");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!phone?.matches || still?.matches) return;

    /** One card's pitch, measured from the layout rather than assumed from the
     *  CSS — `grid-auto-columns` is a percentage of the rail, and the gap is
     *  part of the step. Falls back to the rail's own width if the rail has
     *  fewer than two children to measure against. */
    const pitch = () => {
      const a = rail.children[0] as HTMLElement | undefined;
      const b = rail.children[1] as HTMLElement | undefined;
      if (a && b) return Math.max(1, b.offsetLeft - a.offsetLeft);
      return Math.max(1, Math.round(rail.clientWidth * 0.8));
    };

    let held = false;
    let stopped = false;
    let dir: 1 | -1 = 1;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resume: ReturnType<typeof setTimeout> | undefined;

    const step = () => {
      if (stopped) return;
      // `held` can only be true between a pointerdown and its release, and the
      // release restarts this timer — so this is belt and braces, not the
      // mechanism.
      if (!held) {
        const next = railStep(rail.scrollLeft, rail.scrollWidth - rail.clientWidth, dir, pitch());
        dir = next.dir;
        rail.scrollTo({ left: next.left, behavior: "smooth" });
      }
      timer = setTimeout(step, STEP_MS);
    };

    const hold = () => {
      held = true;
      if (resume) clearTimeout(resume);
      resume = undefined;
    };

    const release = () => {
      if (!held) return;
      held = false;
      if (timer) clearTimeout(timer);
      // Restarted from scratch, not resumed: the pause should outlast the
      // finger by a fixed beat regardless of where the old cycle had got to.
      timer = setTimeout(step, RESUME_MS);
    };

    rail.addEventListener("pointerdown", hold);
    rail.addEventListener("pointerup", release);
    rail.addEventListener("pointercancel", release);
    // A drag that leaves the rail without a pointerup (the finger slid onto the
    // page) still has to give the wheel back.
    window.addEventListener("pointerup", release);

    if (rail.scrollWidth > rail.clientWidth) timer = setTimeout(step, STEP_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (resume) clearTimeout(resume);
      rail.removeEventListener("pointerdown", hold);
      rail.removeEventListener("pointerup", release);
      rail.removeEventListener("pointercancel", release);
      window.removeEventListener("pointerup", release);
    };
  }, [ref]);
}
