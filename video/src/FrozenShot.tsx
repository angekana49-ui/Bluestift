import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Plays a landing-page product shot on the video's clock instead of the page's.
 *
 * The shots in components/site animate with CSS keyframes that start when the
 * shot scrolls into view (`pub-shot-anim` + `is-live`, set by useShotSequence)
 * and loop on their own timer. A video renders frames one at a time, in any
 * order, possibly across several browser tabs, so neither the scroll trigger
 * nor wall-clock time exists here. On every frame, before it is captured, this:
 *
 *  1. restarts every shot inside it in its playing state, without the loop
 *     (`is-cycling`) — the scene decides when a shot replays;
 *  2. seeks every animation in the subtree to `timeMs` (the CSS delays, `--d`,
 *     are part of each animation's timing, so the choreography is exact);
 *  3. writes that state into the elements' inline styles and removes the
 *     animation.
 *
 * Step 3 is the one that is not obvious, and the first version did without it.
 * Seeking a paused animation updated the computed style — every progress read
 * back correct — but the headless browser's compositor kept painting opacity and
 * transform from the animation's old position, so the chat shot rendered the
 * same half-played frame at every point of its scene. Committed inline styles
 * are painted like any other style, whatever the compositor thinks it is doing.
 *
 * The two count-up numbers run on requestAnimationFrame and simply show their
 * final value, which is what the site shows under reduced motion too.
 */
export function FrozenShot({ timeMs, style, children }: { timeMs: number; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const shots = Array.from(host.querySelectorAll<HTMLElement>(".pub-shot, .pub-diagram"));

    // The shots load the app's marks by root-relative path (`/raya-mark.png`),
    // which only the Next app serves. Point them at this package's public/
    // (scripts/sync-css.mjs copies the files) and hold the frame until they load.
    for (const img of host.querySelectorAll<HTMLImageElement>("img[src^='/']:not([data-video-src])")) {
      const path = img.getAttribute("src")!.slice(1);
      img.dataset.videoSrc = path;
      const handle = delayRender(`shot image ${path}`);
      const done = () => continueRender(handle);
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      img.src = staticFile(path);
    }

    // Recreate the CSS animations: the previous frame cancelled them.
    for (const el of shots) {
      el.classList.add("pub-shot-anim");
      el.classList.remove("is-live", "is-idle", "is-cycling");
    }
    void host.offsetWidth;
    for (const el of shots) el.classList.add("is-live");

    for (const animation of host.getAnimations({ subtree: true })) {
      animation.pause();
      animation.currentTime = Math.max(0, timeMs);
      try {
        animation.commitStyles();
      } catch {
        // An element that is not rendered cannot hold committed styles, and is
        // not visible in this frame either.
      }
      animation.cancel();
    }
  });

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}
