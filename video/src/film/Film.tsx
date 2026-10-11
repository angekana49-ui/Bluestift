import { AbsoluteFill, Html5Audio, staticFile } from "remotion";
import { FONT_VARS, FONTS, useFontsReady } from "../brand";
import { useTime } from "../motion";
import { FilmIntro } from "./Intro";
import { FilmBluestift } from "./Bluestift";
import { FilmRaya } from "./Raya";
import { FilmSchools } from "./Schools";
import { FilmKernel } from "./Kernel";
import { FilmControl } from "./Control";
import { FilmOutro } from "./Outro";
import { Grain, Vignette } from "./kit";

/**
 * "Welcome to Bluestift", the drawn cut: the owner's narration and music,
 * unchanged, under a film made of motion design rather than flying
 * screenshots. Scenes are stacked in story order; each one opens over the one
 * before it on a change of the music, and returns nothing outside its time.
 */
export function Film() {
  useFontsReady();
  const t = useTime();
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body, background: "#050913" }}>
      <style>{FONT_VARS}</style>
      <FilmIntro />
      <FilmBluestift />
      <FilmRaya />
      <FilmSchools />
      <FilmKernel />
      <FilmControl />
      <FilmOutro />
      <Vignette strength={0.38} />
      <Grain t={t} opacity={0.055} />
      <Html5Audio src={staticFile("audio/soundtrack.wav")} />
    </AbsoluteFill>
  );
}
