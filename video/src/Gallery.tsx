import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import BrowserFrame from "@/components/site/DeviceFrame";
import DashboardMockup from "@/components/site/DashboardMockup";
import { ConceptGraphShot, KernelLoopShot } from "@/components/site/KernelDiagrams";
import {
  FocusShot,
  GuidedShot,
  KernelShot,
  ReturnShot,
  RoomShot,
  RungShot,
  SocraticShot,
  ToolsShot,
} from "@/components/site/ProductShots";
import { getTheme, type Theme } from "@/components/site/theme";
import { FrozenShot } from "./FrozenShot";
import { FONT_VARS } from "./brand";
import "./generated/site.css";

/** Every site drawing the video can use, by name. Dev-only contact sheet. */
export const SHOTS: Record<string, (t: Theme) => ReactNode> = {
  socratic: (t) => <SocraticShot theme={t} />,
  room: (t) => <RoomShot theme={t} />,
  tools: (t) => <ToolsShot theme={t} />,
  kernel: (t) => <KernelShot theme={t} />,
  focus: (t) => <FocusShot theme={t} />,
  guided: (t) => <GuidedShot theme={t} />,
  return: (t) => <ReturnShot theme={t} />,
  rung: (t) => <RungShot theme={t} rung={3} />,
  dashboard: (t) => <DashboardMockup theme={t} />,
  loop: (t) => <KernelLoopShot theme={t} />,
  graph: (t) => <ConceptGraphShot theme={t} />,
};

export type GalleryProps = { shot: string; dark: boolean; ms: number; width: number; still?: boolean; measure?: string[] };

const VIDEO_CSS = `
.vid-plate .pub-shot > [aria-hidden]:first-child{display:none!important}
.pub-hero-tile,.pub-hero-fill,.pub-hero-gauge,.pub-hero-rise{animation:none!important}
`;

export function Gallery({ shot, dark, ms, width, still, measure }: GalleryProps) {
  const t = getTheme(dark);
  const ref = useRef<HTMLDivElement>(null);

  // Where named things sit inside the shot, in pixels from the screen's
  // top-left at this width — for pointing the film's camera at them.
  useLayoutEffect(() => {
    if (!measure?.length || !ref.current) return;
    const handle = delayRender("measure");
    requestAnimationFrame(() => {
      const host = ref.current!;
      const screen = host.querySelector<HTMLElement>(".pub-shot, .pub-diagram") ?? host;
      const origin = screen.getBoundingClientRect();
      for (const text of measure) {
        const all = Array.from(screen.querySelectorAll<HTMLElement | SVGElement>("*")).filter((el) => el.textContent?.trim().startsWith(text));
        // The innermost element whose text starts with it.
        const hit = all.filter((el) => !all.some((o) => o !== el && el.contains(o)))[0];
        if (!hit) {
          console.log(`[measure] ${text}: not found`);
          continue;
        }
        const r = hit.getBoundingClientRect();
        console.log(
          `[measure] ${text}: x=${Math.round(r.left - origin.left)} y=${Math.round(r.top - origin.top)} w=${Math.round(r.width)} h=${Math.round(r.height)} cx=${Math.round(r.left - origin.left + r.width / 2)} cy=${Math.round(r.top - origin.top + r.height / 2)}`,
        );
      }
      console.log(`[measure] screen: w=${Math.round(origin.width)} h=${Math.round(origin.height)}`);
      continueRender(handle);
    });
  }, [measure]);

  return (
    <AbsoluteFill style={{ background: dark ? "#070b14" : "#dfe9f8", alignItems: "center", justifyContent: "center" }}>
      <style>{FONT_VARS + VIDEO_CSS}</style>
      <div ref={ref} className="vid-plate" style={{ width, color: t.text }}>
        <BrowserFrame theme={t} url="raya.thebluestift.com">
          {still ? SHOTS[shot](t) : <FrozenShot timeMs={ms}>{SHOTS[shot](t)}</FrozenShot>}
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
}
