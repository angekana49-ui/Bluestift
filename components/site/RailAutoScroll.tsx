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
 * leaves, so a visitor reading card two is not fought for the position. At the
 * last card it rewinds to the first rather than dead-ending.
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

    const atEnd = () =>
      rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - END_SLACK;

    let held = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resume: ReturnType<typeof setTimeout> | undefined;

    const step = () => {
      if (stopped) return;
      // `held` can only be true between a pointerdown and its release, and the
      // release restarts this timer — so this is belt and braces, not the
      // mechanism.
      if (!held) {
        rail.scrollTo({ left: atEnd() ? 0 : rail.scrollLeft + pitch(), behavior: "smooth" });
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
