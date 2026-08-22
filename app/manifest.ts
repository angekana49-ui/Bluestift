import type { MetadataRoute } from "next";
import { buildManifest } from "@/lib/manifest";

/**
 * The Bluestift app — Schools, Rooms, Tools, and anything that is not Raya.
 * Raya installs separately; see app/raya-manifest/route.ts.
 *
 * Until this file existed there was no manifest at all, so "Add to Home Screen"
 * produced a generic icon and a launch into a browser tab with the URL bar still
 * showing — on a product whose whole offline story (public/sw.js,
 * lib/net/outbox.ts) is built for students on metered 2G/3G connections.
 * next.config.ts already allowed `manifest-src 'self'` in the CSP; only the file
 * was missing.
 *
 * `start_url` is /login on purpose, and it is the repo's own idea rather than a
 * new entry point: app/login/page.tsx calls itself "the ALWAYS-REACHABLE door"
 * and forwards a finished account to resolveHome() — Raya or Schools depending
 * on their memberships — while leaving a half-finished one on the door with a way
 * out. So the installed icon lands each person on their own home in one hop. "/"
 * would open the marketing site, which is not what installing an app to a home
 * screen means.
 */
export default function manifest(): MetadataRoute.Manifest {
  return buildManifest({
    id: "/",
    name: "Bluestift",
    shortName: "Bluestift",
    description: "Bluestift — AI-powered diagnostic engine for schools.",
    startUrl: "/login",
    icons: "icon",
  });
}
