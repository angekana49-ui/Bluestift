import { describe, it, expect } from "vitest";

import { railStep } from "@/components/site/RailAutoScroll";

/**
 * The phone rail walks back at either end (ping-pong). It used to rewind: at
 * the last card one smooth scroll carried it across the whole rail to the
 * first, which reads as a glitch. A turn leaves from where the rail is, so no
 * two consecutive positions are ever more than one pitch apart.
 */
describe("rail ping-pong", () => {
  it("walks forward mid-rail", () => {
    expect(railStep(100, 500, 1, 120)).toEqual({ left: 220, dir: 1 });
  });

  it("walks back mid-rail once turned", () => {
    expect(railStep(300, 500, -1, 120)).toEqual({ left: 180, dir: -1 });
  });

  it("turns at the end instead of jumping to the start", () => {
    // Exactly at the end, and within the snap-point slack: in both cases the
    // step leaves backwards from here rather than targeting 0.
    expect(railStep(500, 500, 1, 120)).toEqual({ left: 380, dir: -1 });
    expect(railStep(497, 500, 1, 120)).toEqual({ left: 377, dir: -1 });
  });

  it("turns at the start instead of running past it", () => {
    expect(railStep(0, 500, -1, 120)).toEqual({ left: 120, dir: 1 });
    expect(railStep(2, 500, -1, 120)).toEqual({ left: 122, dir: 1 });
  });

  it("never jumps: a full walk stays within one pitch per step", () => {
    // A pitch that doesn't divide the rail, the way a measured one won't.
    const max = 500;
    const pitch = 180;
    // The browser clamps a target past an edge; the turn is exact because of
    // it, so the simulation clamps the same way.
    const clamp = (n: number) => Math.min(max, Math.max(0, n));
    let pos = 0;
    let dir: 1 | -1 = 1;
    let turnedBack = 0;
    let turnedForward = 0;
    for (let i = 0; i < 14; i++) {
      const next = railStep(pos, max, dir, pitch);
      if (dir === 1 && next.dir === -1) turnedBack++;
      if (dir === -1 && next.dir === 1) turnedForward++;
      dir = next.dir;
      const clamped = clamp(next.left);
      expect(Math.abs(clamped - pos)).toBeLessThanOrEqual(pitch);
      pos = clamped;
    }
    // Both ends were reached and turned around more than once — the rail
    // paces the whole row rather than shuttling between two cards.
    expect(turnedBack).toBeGreaterThanOrEqual(2);
    expect(turnedForward).toBeGreaterThanOrEqual(2);
  });
});
