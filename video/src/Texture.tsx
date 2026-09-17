import type { CSSProperties } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import BrowserFrame from "@/components/site/DeviceFrame";
import { getTheme } from "@/components/site/theme";
import { FrozenShot } from "./FrozenShot";
import { SHOTS } from "./Gallery";
import { FONT_VARS, useFontsReady } from "./brand";
import { poseStyle, VIDEO_CSS, type Pose } from "./Plate";
import "./generated/site.css";

/**
 * Finished screens as pictures, for the wide shots.
 *
 * When the camera shows the whole product at once — the ecosystem, the closing
 * mosaic — nothing on any one screen is moving or readable, and nine live
 * shots in one frame is the slowest thing this film could ask of a render.
 * scripts/textures.mjs renders each finished screen once, at twice the size,
 * and these frames use the picture.
 */

export type TextureSpec = { name: string; shot: string; dark: boolean; width: number; screenH: number; bare?: boolean };

export const TEXTURES: TextureSpec[] = [
  { name: "socratic-light", shot: "socratic", dark: false, width: 1500, screenH: 643 },
  { name: "room-light", shot: "room", dark: false, width: 1300, screenH: 975 },
  { name: "tools-dark", shot: "tools", dark: true, width: 1500, screenH: 1125 },
  { name: "kernel-dark", shot: "kernel", dark: true, width: 1000, screenH: 750 },
  { name: "focus-dark", shot: "focus", dark: true, width: 1150, screenH: 862 },
  { name: "return-light", shot: "return", dark: false, width: 1150, screenH: 862 },
  { name: "dashboard-light", shot: "dashboard", dark: false, width: 1500, screenH: 640 },
  { name: "loop-dark", shot: "loop", dark: true, width: 1700, screenH: 920, bare: true },
  { name: "guided-light", shot: "guided", dark: false, width: 1000, screenH: 750 },
];

export const textureSize = (s: TextureSpec) => ({ width: s.width, height: s.screenH + (s.bare ? 0 : 43) });

/** The composition scripts/textures.mjs renders: one screen, edge to edge, on nothing. */
export function TextureFrame({ name }: { name: string }) {
  useFontsReady();
  const spec = TEXTURES.find((s) => s.name === name)!;
  const t = getTheme(spec.dark);
  const shot = <FrozenShot timeMs={600000}>{SHOTS[spec.shot](t)}</FrozenShot>;
  return (
    <AbsoluteFill>
      <style>{FONT_VARS + VIDEO_CSS}</style>
      <div className={`vid-plate ${spec.dark ? "vid-dark" : "vid-light"}`} style={{ width: spec.width, color: t.text }}>
        {spec.bare ? (
          <div style={{ borderRadius: 18, overflow: "hidden" }}>{shot}</div>
        ) : (
          <BrowserFrame theme={t} url="raya.thebluestift.com">
            {shot}
          </BrowserFrame>
        )}
      </div>
    </AbsoluteFill>
  );
}

/** A finished screen placed in the film's space, as a picture. */
export function TexturePlate({ name, pose, style }: { name: string; pose: Pose; style?: CSSProperties }) {
  if ((pose.o ?? 1) <= 0.001) return null;
  const spec = TEXTURES.find((s) => s.name === name)!;
  const { width, height } = textureSize(spec);
  return (
    <div style={{ ...poseStyle(pose), width, height, ...style }}>
      <Img
        src={staticFile(`textures/${name}.png`)}
        style={{
          width,
          height,
          display: "block",
          borderRadius: 18,
          boxShadow: spec.dark
            ? "0 1px 2px rgba(0,0,0,0.5), 0 24px 70px rgba(0,0,0,0.45)"
            : "0 0 0 1px rgba(15,23,42,0.12), 0 14px 32px rgba(15,23,42,0.12), 0 48px 110px rgba(15,23,42,0.24)",
        }}
      />
    </div>
  );
}
