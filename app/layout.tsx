import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans, Caveat, Instrument_Serif } from "next/font/google";
import { THEME_COLOR_LIGHT } from "@/lib/theme-color";
import "./globals.css";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { UpgradeModal } from "@/components/upgrade/UpgradeModal";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { LocaleRootProvider } from "@/components/ui/LocaleRootProvider";

// One source of truth for the product typeface (see components/ui/tokens.ts).
// Inter = body/UI, IBM Plex Sans = headings/nav (the display face, à la PostHog),
// Caveat = handwritten greeting. Plex tops out at 700, so headings that ask for
// 800/900 render at Bold — intentional (that's the Plex look).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
  display: "swap",
});
// Instrument Serif (italic) — the accent face used by the public marketing site.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bluestift",
  description: "Bluestift — AI-powered diagnostic engine for schools.",
  // app/manifest.ts is linked automatically by Next; these are the parts iOS
  // needs and the manifest cannot give it. Safari does not read the manifest's
  // icons for the home screen — it reads apple-touch-icon — and without
  // appleWebApp an install still launches inside a browser chrome, which is the
  // exact thing installing was meant to remove.
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Bluestift",
    statusBarStyle: "default",
  },
  other: {
    // `appleWebApp.capable` renders only the standard `mobile-web-app-capable`
    // in this version of Next, which is the right modern name — Apple's
    // prefixed one is deprecated. Older iOS still reads the prefixed tag, and
    // the phone in the room is an iPhone, so both are emitted. A browser that
    // doesn't know this name ignores it; the cost is one line.
    "apple-mobile-web-app-capable": "yes",
  },
};

/**
 * `themeColor` is declared as one flat colour rather than the usual pair of
 * `prefers-color-scheme` entries, because dark mode here is a stored toggle
 * (`bluestift-dark`) that never consults the OS — a media-keyed value would be
 * wrong whenever a visitor's chosen mode differs from their system's, which is
 * the case the toggle exists for. The light value matches the first paint (both
 * dark hooks render light before reading localStorage); syncThemeColor in
 * lib/theme-color.ts updates the tag once the stored preference is known.
 */
export const viewport: Viewport = {
  themeColor: THEME_COLOR_LIGHT,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="day"
      className={`${inter.variable} ${plex.variable} ${caveat.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <PostHogProvider>
          <LocaleRootProvider>{children}</LocaleRootProvider>
        </PostHogProvider>
        <UpgradeModal />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
