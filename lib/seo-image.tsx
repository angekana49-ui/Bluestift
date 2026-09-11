import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared render for app/opengraph-image.tsx and app/twitter-image.tsx.
 * Nothing in the file-convention docs says a twitter-image falls back to
 * opengraph-image's output, so both exist — same artwork, generated once.
 */
export const OG_IMAGE_ALT = "Bluestift — the collaborative AI for education";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * ONE claim, and it is the hero's own chip (`site.hero.eyebrow`).
 *
 * This card, the tab title (app/page.tsx), the install prompt
 * (app/manifest.ts) and this file's alt text had drifted into four different
 * descriptions of the product — one of them ("AI-powered diagnostic engine for
 * schools") being copy the site itself had already retired. A share card is
 * the one surface a stranger meets first, so it was showing the oldest pitch
 * to exactly the people with no other context.
 *
 * Short on purpose either way: this renders at a fixed size with no text-fit
 * logic, so it needs a line proven to wrap safely. The longer elaboration
 * lives in SITE_DESCRIPTION (lib/seo.ts), where a crawler wraps it for free.
 */
const TAGLINE = "The collaborative AI for education";

// Satori (what ImageResponse renders with) needs an actual image source, not
// a filesystem path — base64-embedding public/'s own mark keeps this in sync
// with scripts/render-brand-icons.mjs without a second copy of the artwork.
async function markDataUri() {
  const bytes = await readFile(join(process.cwd(), "public", "bluestift-mark.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export async function buildBrandOgImage() {
  const mark = await markDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "linear-gradient(135deg, #0b1220 0%, #10213f 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (Satori) needs a plain <img>, not next/image */}
        <img src={mark} width={156} height={156} style={{ marginBottom: 36 }} alt="" />
        {/*
         * The wordmark is TWO-COLOUR here, like it is everywhere else in the
         * product (components/site/Navbar.tsx, Footer.tsx, ui/auth-chrome.tsx).
         * It rendered flat white on this card alone — which is the one surface
         * a stranger meets before they have ever seen the real one, so the
         * inconsistency landed exactly where it could not be corrected by
         * context. Colours are the DARK theme's pair (components/site/theme.ts),
         * because this card is always on the dark gradient.
         */}
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>
          <div style={{ display: "flex", color: "#8fb8f0" }}>Blue</div>
          <div style={{ display: "flex", color: "#4e9bf5" }}>Stift</div>
        </div>
        {/* The accent rule the generated documents already use in their own
            header (components/ui/document.tsx) — same motif, same proportions. */}
        <div style={{ display: "flex", width: 72, height: 5, borderRadius: 3, background: "#4e9bf5", marginTop: 28 }} />
        {/* 34 rather than 30: the tagline used to be a full sentence that
            needed to wrap small. It is one short line now, so it can carry
            its own weight under the wordmark instead of reading as a caption. */}
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 34,
            lineHeight: 1.4,
            color: "#a9bdd9",
            maxWidth: 820,
          }}
        >
          {TAGLINE}
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
