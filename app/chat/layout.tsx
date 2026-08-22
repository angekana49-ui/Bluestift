import type { Metadata } from "next";
import { rayaStartupImages } from "@/lib/launch-screens";

/**
 * Raya's install identity, layered over the root layout's.
 *
 * Metadata merges shallowly and the deepest segment replaces a whole field, so
 * naming `manifest`, `icons` and `appleWebApp` here swaps all three for this
 * route — Raya's manifest, Raya's home-screen icon, Raya's launch screens.
 * Anything not named (description, viewport, theme-color) still comes from the
 * root.
 *
 * This layout exists only to carry that metadata; it renders its children
 * untouched. The chat surface owns its own chrome.
 */
export const metadata: Metadata = {
  title: "Raya",
  manifest: "/raya-manifest",
  icons: {
    icon: [
      { url: "/icon-raya-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-raya-512.png", sizes: "512x512", type: "image/png" },
    ],
    // Safari does not read the manifest's icons for the home screen, so without
    // this an installed Raya would wear the Bluestift bird.
    apple: [{ url: "/apple-touch-icon-raya.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Raya",
    statusBarStyle: "default",
    startupImage: rayaStartupImages,
  },
};

export default function RayaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
