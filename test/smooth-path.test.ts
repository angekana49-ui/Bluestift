import { describe, expect, it } from "vitest";
import { monotonePath, type PathPoint } from "@/lib/smooth-path";

/**
 * The progress curve must not draw a score nobody got.
 *
 * This is the entire reason lib/smooth-path.ts implements Fritsch–Carlson
 * rather than the four-line Catmull-Rom every "smooth svg line" answer online
 * hands you. A cardinal spline through 40% then 95% overshoots on its way in,
 * peaking somewhere above 95 before it settles — and on a chart whose y axis
 * stops at 100%, that invented mastery is drawn in the same ink as the
 * measured kind, or clipped by the axis so nobody can even see it happened.
 *
 * "It looks smoother" is not a defence for a chart that lies, so the property
 * is asserted rather than trusted.
 */

/** Pull the cubic segments back out of the `d` string. */
function segments(d: string, first: PathPoint) {
  const out: Array<{ p0: PathPoint; c1: PathPoint; c2: PathPoint; p1: PathPoint }> = [];
  let current = first;
  for (const chunk of d.split("C").slice(1)) {
    const n = chunk.trim().split(/[\s,]+/).map(Number);
    expect(n).toHaveLength(6);
    const seg = {
      p0: current,
      c1: { px: n[0], py: n[1] },
      c2: { px: n[2], py: n[3] },
      p1: { px: n[4], py: n[5] },
    };
    out.push(seg);
    current = seg.p1;
  }
  return out;
}

/** Evaluate a cubic Bézier's y at parameter t. */
const bezierY = (s: { p0: PathPoint; c1: PathPoint; c2: PathPoint; p1: PathPoint }, t: number) => {
  const u = 1 - t;
  return (
    u * u * u * s.p0.py +
    3 * u * u * t * s.c1.py +
    3 * u * t * t * s.c2.py +
    t * t * t * s.p1.py
  );
};

/** The highest and lowest the drawn curve actually goes, sampled densely. */
function drawnRange(points: PathPoint[]) {
  const segs = segments(monotonePath(points), points[0]);
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of segs) {
    for (let i = 0; i <= 100; i++) {
      const v = bezierY(s, i / 100);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  return { lo, hi };
}

const at = (...ys: number[]): PathPoint[] => ys.map((py, i) => ({ px: i * 100, py }));

describe("the curve stays inside its own data", () => {
  it("does not overshoot a sharp rise", () => {
    // SVG y is inverted — a HIGH score is a LOW y — so a score overshoot shows
    // up as the curve going below the smallest py. These are 40%, 95%, 92%.
    const pts = at(150, 20, 30);
    const { lo, hi } = drawnRange(pts);
    const ys = pts.map((p) => p.py);
    expect(lo).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6);
    expect(hi).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
  });

  it("does not dip below a flat run", () => {
    // Three identical scores must draw a flat line, not a gentle sag between
    // them — a sag here reads as "you got worse, then recovered", twice.
    const { lo, hi } = drawnRange(at(80, 80, 80, 80));
    expect(hi - lo).toBeLessThan(1e-6);
  });

  it("keeps a peak at the point where it was measured", () => {
    const pts = at(200, 100, 40, 100, 200);
    const { lo, hi } = drawnRange(pts);
    expect(lo).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(hi).toBeLessThanOrEqual(200 + 1e-6);
  });

  it("holds for a long noisy series, not just the tidy cases", () => {
    // Deterministic pseudo-noise — a real profile is not monotone and not
    // evenly spaced, and the guarantee has to survive both.
    const pts: PathPoint[] = [];
    let seed = 7;
    for (let i = 0; i < 40; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      pts.push({ px: i * 17 + (seed % 5), py: 20 + (seed % 190) });
    }
    pts.sort((a, b) => a.px - b.px);
    const { lo, hi } = drawnRange(pts);
    const ys = pts.map((p) => p.py);
    expect(lo).toBeGreaterThanOrEqual(Math.min(...ys) - 1e-6);
    expect(hi).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
  });
});

describe("the curve passes through every measurement", () => {
  it("starts and ends on the real endpoints", () => {
    const pts = at(120, 60, 90);
    const segs = segments(monotonePath(pts), pts[0]);
    expect(segs[0].p0).toEqual(pts[0]);
    expect(segs[segs.length - 1].p1.py).toBeCloseTo(pts[pts.length - 1].py, 1);
  });

  it("has one segment per interval — no points skipped or doubled", () => {
    const pts = at(10, 20, 30, 40, 50, 60);
    expect(segments(monotonePath(pts), pts[0])).toHaveLength(pts.length - 1);
  });
});

describe("the degenerate inputs a chart actually hands it", () => {
  it("returns nothing for no points", () => {
    expect(monotonePath([])).toBe("");
  });

  it("returns a bare move for one assessment", () => {
    // The profile page renders a single point as soon as someone finishes one
    // quiz, so this is a real state, not a theoretical one.
    expect(monotonePath([{ px: 5, py: 6 }])).toBe("M 5.00 6.00");
  });

  it("draws two points as the straight line they are", () => {
    expect(monotonePath(at(10, 20))).toBe("M 0.00 10.00 L 100.00 20.00");
  });

  it("survives two assessments recorded at the same instant", () => {
    // Same x, so the secant slope would divide by zero.
    const d = monotonePath([
      { px: 0, py: 10 },
      { px: 50, py: 40 },
      { px: 50, py: 60 },
      { px: 100, py: 20 },
    ]);
    expect(d).not.toMatch(/NaN|Infinity/);
  });
});
