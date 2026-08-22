/**
 * The iOS launch screens — one image per iPhone geometry, per installable app.
 *
 * Android needs none of this: Chrome composes a launch screen from the
 * manifest's name, background_color and 512 icon. Safari composes nothing, so
 * without these an app opened from the home screen sits on blank white while it
 * loads — on the platform where it is most likely to be installed.
 *
 * iOS matches an image by EXACT device metrics. A geometry missing from this
 * list gets no image rather than the nearest one, which is why the list is long
 * and why it is checked rather than trusted: scripts/render-launch-screens.mjs
 * renders the files from its own copy of these numbers, and
 * test/pwa-manifest.test.ts asserts the two agree in both directions.
 *
 * There are two sets because there are two installable apps, and iOS picks a
 * launch image by device geometry alone — never by route. A single app could
 * therefore only ever have one launch screen. Raya gets its own because it is
 * its own app (app/raya-manifest, start_url /chat); everything else installs as
 * Bluestift (app/manifest.ts, start_url /login).
 *
 * Portrait only. A phone is launched upright from a home screen, and covering
 * landscape would double twenty-two files for a case that barely arises. iPads
 * fall back to the manifest's background_color, which is the colour these
 * images open on anyway.
 *
 * This lives here rather than in app/layout.tsx so a test can import it: the
 * layout pulls in next/font/google, which needs Next's build-time transform and
 * throws under vitest.
 */

/** [css width, css height, device pixel ratio]. */
const LAUNCH_DEVICES: [number, number, number][] = [
  [375, 667, 2], // SE 2/3, 8
  [414, 736, 3], // 8 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 12 Pro, 13, 13 Pro, 14
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro
  [440, 956, 3], // 16 Pro Max
];

function startupImagesFor(prefix: string) {
  return LAUNCH_DEVICES.map(([w, h, ratio]) => ({
    url: `/${prefix}-${w * ratio}x${h * ratio}.png`,
    media:
      `(device-width: ${w}px) and (device-height: ${h}px) ` +
      `and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
  }));
}

/** Bluestift — the bird over the wordmark. Schools, Rooms, Tools, everything else. */
export const startupImages = startupImagesFor("launch");
/** Raya — its own mark, no word. */
export const rayaStartupImages = startupImagesFor("launch-raya");
