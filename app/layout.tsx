import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans, Caveat, Instrument_Serif } from "next/font/google";
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
  description: "Bluestift — Raya, the AI tutor students and teachers share.",
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
