import { clamp01, EASE } from "./motion";

/**
 * The hero dashboard's entrance, on the film's clock.
 *
 * DashboardMockup animates itself once at page load (`.pub-hero-*` in
 * globals.css), which a render cannot seek: the video switches those
 * animations off and writes the same entrance here instead, as a stylesheet
 * scoped to one plate — tiles rise in, the class bars fill, the gauge sweeps
 * to the app's own reading (188 × (1 − 0.83) = 32).
 */
export function dashboardCss(scope: string, p: number) {
  const step = (from: number, to: number) => EASE.arrive(clamp01((p - from) / (to - from)));
  const rules: string[] = [];
  const tile = (selector: string, q: number) =>
    rules.push(`.${scope} ${selector}{opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * 10).toFixed(2)}px)}`);
  for (let k = 1; k <= 4; k++) {
    tile(`.dash-grid > div:first-child > div:first-child > .pub-hero-tile:nth-child(${k})`, step(0.02 + k * 0.06, 0.3 + k * 0.06));
    tile(`.dash-grid > div:first-child > div:nth-child(3) > .pub-hero-tile:nth-child(${k})`, step(0.3 + k * 0.07, 0.58 + k * 0.07));
    rules.push(
      `.${scope} .dash-grid > div:first-child > div:nth-child(3) > .pub-hero-tile:nth-child(${k}) .pub-hero-fill{transform:scaleX(${step(0.42 + k * 0.07, 0.8 + k * 0.05).toFixed(3)})}`,
    );
  }
  const gauge = step(0.35, 1);
  rules.push(`.${scope} .pub-hero-gauge{stroke-dashoffset:${(188 - (188 - 32) * gauge).toFixed(2)}}`);
  return rules.join("\n");
}
