import type { MetadataRoute } from "next";
import { THEME_COLOR_LIGHT } from "@/lib/theme-color";

/**
 * The web app manifest — what a phone reads when someone installs Bluestift.
 *
 * Until now there wasn't one, so "Add to Home Screen" produced a generic icon
 * and a launch into a browser tab with the URL bar still showing, on a product
 * whose whole offline story (public/sw.js, lib/net/outbox.ts) is built for
 * students on metered 2G/3G connections. next.config.ts already allowed
 * `manifest-src 'self'` in the CSP; only the file was missing.
 *
 * `start_url` is /login on purpose, and it is the repo's own idea rather than a
 * new entry point: app/login/page.tsx calls itself "the ALWAYS-REACHABLE door"
 * and forwards a finished account to resolveHome() — Raya or Schools depending
 * on their memberships — while leaving a half-finished one on the door with a
 * way out. So the installed icon lands each person on their own home in one
 * hop. "/" would open the marketing site, which is not what installing an app
 * to a home screen means.
 *
 * `id` is pinned separately so the app keeps its identity if `start_url` ever
 * moves; a browser that falls back to start_url would otherwise treat the change
 * as a different app and strand the installed copy.
 *
 * Icons come from scripts/process-logos.py, which frames the same artwork three
 * ways because three different things crop it — see the note there. The maskable
 * one is what stops Android drawing our square inside its own white circle.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bluestift",
    short_name: "Bluestift",
    description: "Bluestift — AI-powered diagnostic engine for schools.",
    // Matches <html lang> in app/layout.tsx. The in-product language is a
    // per-user setting (lib/locale.ts) and cannot be expressed here.
    lang: "en",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    categories: ["education"],
    // The splash screen, so it has to be the page's light background: both dark
    // hooks render light first, and a manifest colour cannot follow a toggle.
    background_color: THEME_COLOR_LIGHT,
    theme_color: THEME_COLOR_LIGHT,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
