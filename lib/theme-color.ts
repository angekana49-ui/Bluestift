/**
 * Keeps `<meta name="theme-color">` in step with the dark toggle.
 *
 * The tag colours the browser's own chrome — Android's status bar, Safari's top
 * area, and the title bar of an installed PWA. Get it wrong and the frame around
 * the app disagrees with the app, which is exactly the sort of seam that reads
 * as unfinished on a phone.
 *
 * It cannot be declared statically with a `prefers-color-scheme` media query,
 * which is the usual way. Both dark-mode hooks in this repo
 * (components/site/useThemeMode.ts and components/ui/theme.tsx) resolve dark
 * from localStorage under `bluestift-dark` and never consult the OS setting, so
 * a media-keyed tag would be wrong precisely as often as a visitor's chosen mode
 * differs from their system's — and the toggle exists because those differ.
 *
 * The colours are per SURFACE, not one pair for the whole origin. The marketing
 * site and the connected app keep separate palettes on purpose
 * (components/site/theme.ts vs components/ui/tokens.ts) and their page grounds
 * genuinely differ: the site opens on #eef3f9, the app on white. Sharing one
 * value put a blue-grey status bar above a white app — the seam this module is
 * supposed to remove.
 *
 * Each colour is the TOP of its surface's page background, because that is the
 * edge the status bar actually sits against.
 */

export type ThemeColors = { light: string; dark: string };

/** components/site/theme.ts — `pageBg`, first stop of each gradient. */
export const SITE_THEME_COLORS: ThemeColors = { light: "#eef3f9", dark: "#0a0f1e" };
/** components/ui/tokens.ts — `pageBase`. */
export const APP_THEME_COLORS: ThemeColors = { light: "#ffffff", dark: "#0b111f" };

/**
 * The value app/layout.tsx declares statically, and the manifests' theme_color.
 *
 * It is the site's light colour because that is what the document first paints:
 * every route is served by the root layout, both dark hooks render light on
 * first pass so server and client agree, and the marketing site is the only
 * surface a signed-out visitor can land on. `syncThemeColor` replaces it once
 * the surface and the stored preference are both known.
 */
export const THEME_COLOR_LIGHT = SITE_THEME_COLORS.light;
/** Kept exported so tests can assert the two are not the same value. */
export const THEME_COLOR_DARK = SITE_THEME_COLORS.dark;

export function syncThemeColor(dark: boolean, colors: ThemeColors) {
  if (typeof document === "undefined") return;
  const tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  // No tag means the document was rendered without the viewport export that
  // declares it. Creating one here would paper over that; leaving it alone keeps
  // the missing declaration visible.
  if (!tag) return;
  tag.content = dark ? colors.dark : colors.light;
}
