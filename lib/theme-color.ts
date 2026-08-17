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
 * The light value is also what app/layout.tsx declares statically. That is not a
 * duplicate but the correct first paint: both hooks render light on first pass
 * so the server HTML and the client agree, then read the stored preference in an
 * effect. This function is that effect's other half.
 *
 * The two colours are the top of each page background — the status bar sits
 * against the top of the page, so that is the edge it has to match.
 */

/** components/site/theme.ts — light `pageBg`, first stop. */
export const THEME_COLOR_LIGHT = "#eef3f9";
/** components/site/theme.ts — dark `pageBg`, first stop. */
export const THEME_COLOR_DARK = "#0a0f1e";

export function syncThemeColor(dark: boolean) {
  if (typeof document === "undefined") return;
  const tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  // No tag means the document was rendered without the viewport export that
  // declares it. Creating one here would paper over that; leaving it alone keeps
  // the missing declaration visible.
  if (!tag) return;
  tag.content = dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
}
