import { AbsoluteFill, Html5Audio, staticFile } from "remotion";
import { FONT_VARS, FONTS, useFontsReady } from "./brand";
import { VIDEO_CSS } from "./Plate";
import { Lens, Sky } from "./Sky";
import { Bluestift } from "./scenes/Bluestift";
import { Control } from "./scenes/Control";
import { Intro } from "./scenes/Intro";
import { Kernel } from "./scenes/Kernel";
import { Outro } from "./scenes/Outro";
import { Raya } from "./scenes/Raya";
import { Schools } from "./scenes/Schools";
import "./generated/site.css";

/** The orbit's labels, a size up: on the landing they are read up close. */
const FILM_CSS = `
.vid-plate .pub-orbit-name{font-size:13.5px}
.vid-plate .pub-orbit-sub{font-size:11px}
`;

export function HowItWorks() {
  useFontsReady();
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <style>{FONT_VARS + VIDEO_CSS + FILM_CSS}</style>
      <Sky />
      <Intro />
      <Bluestift />
      <Raya />
      <Schools />
      <Kernel />
      <Control />
      <Outro />
      <Lens />
      <Html5Audio src={staticFile("audio/soundtrack.wav")} />
    </AbsoluteFill>
  );
}
