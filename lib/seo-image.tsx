import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared render for app/opengraph-image.tsx and app/twitter-image.tsx.
 * Nothing in the file-convention docs says a twitter-image falls back to
 * opengraph-image's output, so both exist — same artwork, generated once.
 */
export const OG_IMAGE_ALT =
  "Bluestift — a Socratic AI tutor, and the dashboard that explains it to teachers";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

// Short on purpose — this renders at a fixed size with no text-fit logic, so
// it needs a line proven to wrap safely rather than the full meta description
// (lib/seo.ts's SITE_DESCRIPTION, used for <meta name="description"> instead,
// where a browser/crawler wraps it for free). Lifted from README.md's own
// one-line pitch.
const TAGLINE = "An AI tutor that refuses to do the homework, and a dashboard that tells teachers why.";

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
        <img src={mark} width={140} height={140} style={{ marginBottom: 40 }} alt="" />
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: "#ffffff", letterSpacing: -2 }}>
          Bluestift
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 30,
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
