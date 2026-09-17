import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { getTheme } from "@/components/site/theme";
import { FONT_CSS, FONT_FAMILIES } from "./generated/fonts";

/**
 * The site's faces, published under the same custom properties app/layout.tsx
 * sets, so every `var(--font-display)` in the shots resolves.
 *
 * They are compiled into the bundle (scripts/fonts.mjs) rather than fetched
 * from Google's CDN: a render is thousands of frames across several browser
 * tabs, and each one asking the network for a font is a render that ends the
 * moment the line blinks — which is how the first two attempts at the final
 * render died.
 */
const { display, body, serif, mono } = FONT_FAMILIES;

export const FONT_VARS =
  FONT_CSS +
  `:root{--font-space-grotesk:"${display}";--font-inter:"${body}";--font-instrument-serif:"${serif}";--font-plex:"${body}";--font-caveat:"${serif}";}` +
  // The diagrams ask for `ui-monospace, SFMono-Regular, Menlo, monospace`: a
  // Mac finds SF Mono, the render's Chrome finds Courier. A real face stands in.
  `[font-family*="monospace"],[style*="monospace"]{font-family:"${mono}",monospace!important}`;

export const FONTS = { display, body, serif, mono };

/**
 * Holds the frame until the faces are usable, then draws it again.
 *
 * Both halves matter: the delay is what stops a frame being captured in a
 * fallback face, and the redraw is what makes anything measured against a face
 * (the title cards that land on a screen's own rail) measure the real one.
 */
export function useFontsReady() {
  const [handle] = useState(() => delayRender("fonts"));
  const [, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      setReady(true);
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [handle]);
}

/** The light theme: the landing's default, and the clearer one on a video. */
export const theme = getTheme(false);

export const INK = {
  navy: "#0b1220",
  text: "#0f172a",
  muted: "#475569",
  blue: "#2f7fe0",
  indigo: "#4f46e5",
  sky: "#e8f1fd",
};
