import { buildManifest } from "@/lib/manifest";

/**
 * Raya's own web app manifest.
 *
 * It is a route handler rather than a second `manifest.ts` because Next's
 * manifest file convention only exists at the root of `app/` — one per
 * application. This serves the same shape under its own URL, which
 * app/chat/layout.tsx then points `<link rel="manifest">` at, so installing from
 * Raya installs Raya: its own name on the home screen, its own mark, its own
 * launch screen.
 *
 * `start_url` is /chat rather than /login. The Bluestift app deliberately opens
 * the always-reachable door and lets resolveHome() decide between Raya and
 * Schools; this one has already answered that question — someone who installed
 * the tutor wants the tutor. /chat enforces login and onboarding on its own, so
 * a signed-out tap still lands somewhere sensible.
 *
 * Served as application/manifest+json, which is what a browser expects and what
 * the CSP's `manifest-src 'self'` permits.
 */
export function GET() {
  return Response.json(
    buildManifest({
      id: "/chat",
      name: "Raya",
      shortName: "Raya",
      description: "Raya — the tutor that knows where you are stuck, and why.",
      startUrl: "/chat",
      icons: "icon-raya",
    }),
    { headers: { "content-type": "application/manifest+json" } },
  );
}
