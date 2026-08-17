import type { MetadataRoute } from "next";
import { THEME_COLOR_LIGHT } from "./theme-color";

/**
 * Shared shape for the two web app manifests.
 *
 * There are two because an installed app has exactly one identity — one icon,
 * one name, one launch screen — and Raya and Bluestift are two products, not one
 * with two faces. A student installs Raya; a school installs Bluestift. iOS also
 * forces the issue: it picks a launch image by device geometry alone, never by
 * route, so a single manifest could only ever have a single launch screen.
 *
 * Everything that is a decision about the product family rather than about one
 * app lives here, so the two cannot drift:
 *
 *  - `display: standalone` is the entire point — browser chrome is what
 *    installing removes.
 *  - `background_color` is the light page colour, which is also the top of the
 *    gradient the launch screens open on, so the two agree. It cannot follow the
 *    dark toggle: a manifest colour is static, and both dark hooks render light
 *    on first pass anyway (see lib/theme-color.ts).
 *  - `id` is pinned per app so it keeps its identity if `start_url` ever moves;
 *    a browser falling back to start_url would otherwise treat the change as a
 *    different app and strand the installed copy.
 */
export function buildManifest(app: {
  /** Stable identity. Never change it for an app that is already installed. */
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Where the icon lands someone. See each call site for why. */
  startUrl: string;
  /** Basename of the icon set in /public, e.g. "icon" or "icon-raya". */
  icons: string;
}): MetadataRoute.Manifest {
  return {
    id: app.id,
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    // Matches <html lang> in app/layout.tsx. The in-product language is a
    // per-user setting (lib/locale.ts) and cannot be expressed here.
    lang: "en",
    start_url: app.startUrl,
    // A single URL prefix is all `scope` can be, and the products have no common
    // one — /chat, /school, /rooms and /tools share nothing but "/". Narrowing it
    // would mean moving them under a shared prefix, which touches every internal
    // link. The cost of "/" is that a marketing page opened from inside the app
    // stays in the app window, which is the better behaviour anyway.
    scope: "/",
    display: "standalone",
    categories: ["education"],
    background_color: THEME_COLOR_LIGHT,
    theme_color: THEME_COLOR_LIGHT,
    icons: [
      { src: `/${app.icons}-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/${app.icons}-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      // Without a maskable icon Android draws our square inside its own white
      // circle, which is the "looks unfinished" outcome the manifest fixes.
      {
        src: `/${app.icons}-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
