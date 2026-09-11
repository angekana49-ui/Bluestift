import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Sans, Caveat, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import { THEME_COLOR_LIGHT } from "@/lib/theme-color";
import { startupImages } from "@/lib/launch-screens";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";
// KaTeX's own stylesheet — loaded once, globally, for every generated document
// that renders a formula (components/ui/document.tsx). Next only allows a
// plain third-party CSS import from the root layout; anywhere else it errors
// at build time.
import "katex/dist/katex.min.css";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { UpgradeModal } from "@/components/upgrade/UpgradeModal";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { LocaleRootProvider } from "@/components/ui/LocaleRootProvider";

/**
 * Every page is server-rendered on request, and that is now a rule rather than
 * an accident.
 *
 * The CSP carries a per-request nonce (see proxy.ts), and Next can only put a
 * nonce on a page it renders while a request exists. A statically prerendered
 * page has no nonce in its HTML, so the browser refuses ITS OWN scripts and the
 * page arrives dead — visible, but with nothing working and no error anyone
 * would connect to a build-time decision.
 *
 * The build already rendered all but two of 116 entries on demand, so this
 * costs essentially nothing today. What it buys is that the next page someone
 * adds cannot quietly become the exception.
 */
export const dynamic = "force-dynamic";

/*
 * One source of truth for the product typeface (roles live in globals.css
 * `:root` and components/ui/tokens.ts).
 *
 * TWO faces, which is Resend's own arrangement read off their live CSS rather
 * than guessed at: `html` resolves to --font-sans -> Inter, and only
 * `.font-display` resolves to --font-display -> ABC Favorit. So body text is
 * Inter — the same characters we already shipped — and the titles are a
 * different face entirely. That split is the whole of the difference, and
 * setting Inter tighter was never going to close it: same shapes, same look.
 *
 * Inter therefore keeps the body, and Space Grotesk takes the titles. ABC
 * Favorit is Dinamo's retail face and stays named-but-never-shipped (see
 * globals.css); Space Grotesk is the free grotesque that gets closest to its
 * squared-off, slightly odd character, and unlike Inter it is visibly NOT the
 * body face — which is the point of a display face.
 */
const inter = Inter({
  subsets: ["latin"],
  // 800 stays loaded: the marketing site still sets its hero type there, and
  // dropping the weight would not make those lighter — it would hand them to
  // the browser to fake, which is worse than either.
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
/*
 * IBM Plex Sans is no longer the display face. It has one consumer left — the
 * billing cards, held back on it deliberately so the screen that asks someone
 * for money does not change face in the same release as everything else.
 *
 * Which is exactly why it stops being preloaded. Preloading puts a font in the
 * critical path of EVERY page whether that page uses it or not; a face that now
 * appears on two cards has no business in the critical path of the tutor. Same
 * reasoning as Caveat and Instrument Serif below.
 */
/*
 * The display face: titles, nav, page headings — everything `displayType()`
 * touches. Preloaded, unlike the three accent faces below, because the app
 * chrome shows it on first paint of every single page.
 *
 * Three weights, no more. 500 is the resting weight (Resend sets display type
 * at 500), 600 the default `displayType` hands out, 700 for a heading that has
 * to out-rank another heading. Space Grotesk has no 800 and wants none — the
 * old 800-everywhere setting is exactly what we left behind.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
  preload: false,
});
/**
 * NOT preloaded, and it is the largest face we ship — 73 KB, more than Inter
 * and Plex together. Preloading puts a font in the critical path of EVERY page
 * whether or not that page uses it, and Caveat writes one greeting. It now
 * loads when something actually asks for it; `display: swap` means the greeting
 * appears immediately in the fallback and changes hand a moment later, which is
 * the correct trade for decoration.
 */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});
// Instrument Serif (italic) — the accent face used by the public marketing site.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-instrument-serif",
  display: "swap",
  // Same reasoning as Caveat: an accent face for the marketing site has no
  // business in the critical path of the tutor.
  preload: false,
});

export const metadata: Metadata = {
  // `metadataBase` is what turns every relative URL used elsewhere in this
  // object (and in a page's own `openGraph.images`, `alternates.canonical`,
  // ...) into an absolute one — without it, a shared link's og:image resolves
  // against whatever host actually served the request, which is wrong the
  // moment that host isn't the canonical apex (a preview deploy, a
  // not-yet-migrated product subdomain — see next.config.ts's productRedirects).
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    // Applied to any page that sets its own `title` as a plain string rather
    // than a full override — "Pricing" becomes "Pricing · Bluestift" for
    // free, everywhere, without every page having to say so.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    // No `images` here — the opengraph-image.tsx file convention (app/) adds
    // it automatically, sized and typed, and does so per route segment; an
    // explicit URL here would take precedence and defeat that.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
    startupImage: startupImages,
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts mints a fresh CSP nonce per request and hands it down via this
  // header (see lib/security/csp.ts) — Next applies it to its own scripts
  // automatically, but a script WE write, like the JSON-LD below, has to
  // carry it explicitly or `script-src`'s nonce allow-list rejects it.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = JSON.stringify([organizationJsonLd(), websiteJsonLd()]);

  return (
    <html
      lang="en"
      data-theme="day"
      className={`${inter.variable} ${spaceGrotesk.variable} ${plex.variable} ${caveat.variable} ${instrumentSerif.variable}`}
    >
      <body>
        {/* Organization + WebSite JSON-LD: who's behind this site and what
            it's called, in the structured form both classic rich-result
            search and AI answer engines parse before they ever read prose. */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
        <PostHogProvider>
          <LocaleRootProvider>{children}</LocaleRootProvider>
        </PostHogProvider>
        <UpgradeModal />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
