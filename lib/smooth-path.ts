/**
 * A smooth curve through a series of points, as an SVG path.
 *
 * WHY A CURVE AT ALL
 *
 * A progress chart drawn as straight segments between dots reads as a scatter
 * plot with the dots joined up — a set of separate measurements, which is
 * literally what it is but not what it means. What it means is that someone is
 * getting better or worse at something over time, and that is a continuous
 * thing the assessments sample. Drawing it as a function says so.
 *
 * WHY MONOTONE CUBIC, AND NOT THE EASY SPLINE
 *
 * The obvious smoothing (Catmull-Rom, or a cardinal spline) OVERSHOOTS: fed a
 * 40% assessment followed by a 95% one, it bulges past 95 before settling, and
 * between two equal scores it dips below both. On this chart that bulge is a
 * mastery the student never demonstrated, drawn in the same ink as the ones
 * they did — and an axis that stops at 100% would clip it, hiding the tell.
 *
 * Fritsch–Carlson monotone cubic Hermite interpolation is the fix and is the
 * standard answer: it chooses tangents that cannot produce a local extremum
 * between two samples, so the curve stays inside the range of the data it
 * connects. Rising between two points means rising; a peak only appears where
 * one was actually measured.
 *
 * Reference: F. N. Fritsch & R. E. Carlson, "Monotone Piecewise Cubic
 * Interpolation", SIAM J. Numer. Anal. 17(2), 1980.
 */
export type PathPoint = { px: number; py: number };

/**
 * `M …  C …` through every point, in the order given.
 *
 * Points must already be sorted by `px` and expressed in the target SVG's user
 * units — this does no scaling and no sorting, on purpose: the caller owns the
 * axes, and a function that silently re-sorted its input would hide a caller
 * that forgot to.
 *
 * Returns "" for an empty input and a bare `M` for a single point, so a caller
 * can hand the result straight to `d` without a length check.
 */
export function monotonePath(points: readonly PathPoint[]): string {
  const n = points.length;
  if (n === 0) return "";
  const at = (i: number) => `${points[i].px.toFixed(2)} ${points[i].py.toFixed(2)}`;
  if (n === 1) return `M ${at(0)}`;
  // Two points have no curvature to describe. A cubic through them is a
  // straight line with extra steps, and the extra steps round differently.
  if (n === 2) return `M ${at(0)} L ${at(1)}`;

  // Secant slope of each interval.
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const run = points[i + 1].px - points[i].px;
    dx[i] = run;
    // Two samples at the same x (two assessments the same instant) would divide
    // by zero; a flat secant there keeps the curve finite and the tangent rule
    // below then treats it as the extremum it is.
    slope[i] = run === 0 ? 0 : (points[i + 1].py - points[i].py) / run;
  }

  // Tangent at each point. The interior rule is what enforces monotonicity.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      // The data turns here (or goes flat). A zero tangent pins the turn to
      // the measured point instead of letting the curve sail past it.
      m[i] = 0;
    } else {
      // Weighted harmonic mean of the two secants — the Fritsch–Carlson
      // choice. Harmonic, not arithmetic, because it is dominated by the
      // SMALLER secant, which is exactly the one that would be overshot.
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M ${at(0)}`;
  for (let i = 0; i < n - 1; i++) {
    // Hermite -> Bézier: the control points sit one third of the interval away
    // along each endpoint's tangent.
    const third = dx[i] / 3;
    const c1x = points[i].px + third;
    const c1y = points[i].py + m[i] * third;
    const c2x = points[i + 1].px - third;
    const c2y = points[i + 1].py - m[i + 1] * third;
    d +=
      ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}` +
      ` ${c2x.toFixed(2)} ${c2y.toFixed(2)}` +
      ` ${at(i + 1)}`;
  }
  return d;
}
