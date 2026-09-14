import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { getTheme } from "@/components/site/theme";

/**
 * The site's faces, loaded the Remotion way (the app loads them with next/font,
 * which does not exist here) and published under the same custom properties
 * app/layout.tsx sets, so every `var(--font-display)` in the shots resolves.
 */
const display = loadSpaceGrotesk("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;
const body = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
const serif = loadInstrumentSerif("italic", { weights: ["400"], subsets: ["latin"] }).fontFamily;

export const FONT_VARS = `:root{--font-space-grotesk:${display};--font-inter:${body};--font-instrument-serif:${serif};--font-plex:${body};--font-caveat:${serif};}`;

export const FONTS = { display, body, serif };

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
