import { AbsoluteFill } from "remotion";
import { ConceptGraphShot, KernelLoopShot } from "@/components/site/KernelDiagrams";
import { KernelShot } from "@/components/site/ProductShots";
import { EASE, envelope, handheld, keys, keysOf, span, steady, useTime, warp } from "../motion";
import { Halo, Plate, spot, World, type Pose } from "../Plate";
import { line, MUSIC, phrase, wordAt } from "../timeline";

/**
 * The Kernel, at night: the part of the product nobody sees.
 *
 * It opens on the learner at the centre of the orbit and pulls back until
 * the ring around them is the Kernel. The camera then goes round that ring,
 * one of its four numbers per phrase — what you know, how fast you're
 * moving, what really sticks, your mindset. On the breakdown, the concept
 * graph: a physics mistake walked back, bond by bond, to the maths gap it
 * came from, the diagram's own tour pinned to the words. The profile's bars
 * grow on "grows with you"; and the last line comes back to the learner, whose
 * light becomes the morning the next section opens in.
 */

const LOOP = { w: 1700, h: 920 };
const discs = {
  learner: [849, 440],
  k: [457, 194],
  v: [1241, 194],
  p: [1241, 682],
  m: [457, 682],
  chip: [849, 94],
  homework: [849, 600],
} as const;

const TEAL = "52,211,153";

/**
 * The concept graph as a picture only. On the landing the reading underneath,
 * the legend and the counts explain the walk; here the voice does, so they go,
 * and the subject named out loud moves to the bottom-left corner — top-right,
 * it landed on the concept labels the tour was zooming into.
 */
const GRAPH_CSS = `
.vid-graph .pub-graph-strip,.vid-graph .pub-graph-legend,.vid-graph .pub-graph-count{display:none!important}
.vid-graph .pub-graph-subject{left:26px!important;right:auto!important;top:auto!important;bottom:22px!important;text-align:left!important;background:rgba(10,16,32,0.72);border-radius:16px;padding:12px 20px 14px}

`;

export function Kernel() {
  const t = useTime();
  const from = line("kernel-0").start - 0.6;
  const to = MUSIC.full + 0.2;
  if (t < from || t > to) return null;

  const layer = line("kernel-0").start;
  const theKernel = phrase("kernel-0", 2).start;
  const attempt = line("kernel-1").start;
  const know = phrase("kernel-1", 1).start;
  const fast = phrase("kernel-1", 2).start;
  const sticks = phrase("kernel-1", 3).start;
  const mindset = phrase("kernel-1", 4).start;
  const guides = line("kernel-2").start;
  const found = wordAt("kernel-2", "found");
  const generic = line("kernel-3").start;
  const guess = phrase("kernel-3", 1).start;
  const like = line("kernel-4").start;
  const physics = wordAt("kernel-4", "physics");
  const comes = wordAt("kernel-4", "comes");
  const maths = wordAt("kernel-4", "maths");
  const best = line("kernel-5").start;
  const grows = phrase("kernel-5", 1).start;
  const assumes = line("kernel-6").start;
  const student = wordAt("kernel-6", "student");
  const grade = wordAt("kernel-6", "grade");

  const loopAt = (k: keyof typeof discs) => spot({ s: 1 }, LOOP.w, LOOP.h, discs[k][0], discs[k][1], false);

  /* ── the orbit, first time ── */
  const loopA: Pose = keysOf(t, [
    [from, { s: 1, o: 0, focus: 0.3 }],
    [layer - 0.1, { s: 1, o: 1, focus: 1 }],
    [MUSIC.breakdown - 0.3, { s: 1, o: 1, focus: 1 }],
    [MUSIC.breakdown + 0.5, { s: 1.04, o: 0, focus: 0.2 }],
  ]);
  /* ── the graph ── */
  const graph: Pose = keysOf(t, [
    [MUSIC.breakdown - 0.2, { y: 30, s: 0.94, o: 0, focus: 0.2 }],
    [MUSIC.breakdown + 0.7, { y: 0, s: 0.98, o: 1, focus: 1 }],
    [best - 0.2, { y: 0, s: 1.0, o: 1, focus: 1 }],
    [best + 0.6, { y: -30, s: 0.98, o: 0, focus: 0.2 }],
  ]);
  const graphMs = warp(t, [
    [MUSIC.breakdown, 0],
    [found, 4400],
    [generic + 0.1, 6200],
    [guess + 0.1, 9600],
    [like, 12600],
    [physics, 14300],
    [comes, 16600],
    [maths, 18700],
    [best, 20000],
  ]);
  /* ── the profile, growing ── */
  const profile: Pose = keysOf(t, [
    [best - 0.2, { y: 60, s: 1.18, o: 0, focus: 0.2 }],
    [best + 0.6, { y: 20, s: 1.22, o: 1, focus: 1 }],
    [assumes - 0.2, { y: -20, s: 1.32, o: 1, focus: 1 }],
    [assumes + 0.5, { y: -40, s: 1.3, o: 0, focus: 0.2 }],
  ]);
  /* ── the orbit, last time ── */
  const loopB: Pose = keysOf(t, [
    [assumes - 0.3, { s: 1, o: 0, focus: 0.3 }],
    [assumes + 0.5, { s: 1, o: 1, focus: 1 }],
    [MUSIC.full, { s: 1, o: 1, focus: 1 }],
  ]);

  const c = (p: { x: number; y: number }, zoom: number, dy = 0) => ({ x: p.x, y: p.y + dy, zoom });
  const drift = handheld(t);
  const cam = steady(t, (u) => keysOf(u, [
    [from, c(loopAt("learner"), 2.6)],
    [layer, c(loopAt("learner"), 2.4)],
    [theKernel + 0.4, { x: 0, y: -20, zoom: 1.0 }],
    [attempt + 0.2, { x: 0, y: -20, zoom: 1.0 }],
    [know - 0.2, c(loopAt("learner"), 1.35, -60)],
    [know + 0.5, c(loopAt("k"), 2.0, 30)],
    [fast + 0.5, c(loopAt("v"), 2.0, 30)],
    [sticks + 0.5, c(loopAt("p"), 2.0, 30)],
    [mindset + 0.5, c(loopAt("m"), 2.0, 30)],
    [MUSIC.breakdown - 0.1, { x: 0, y: 0, zoom: 1.0 }],
    [like, { x: 0, y: 0, zoom: 1.03 }],
    [maths + 0.6, { x: 0, y: 0, zoom: 1.1 }],
    [best - 0.2, { x: 0, y: 0, zoom: 1.11 }],
    [best + 0.6, { x: 0, y: 0, zoom: 1.0 }],
    [assumes - 0.2, { x: 0, y: -40, zoom: 1.06 }],
    [assumes + 0.5, c(loopAt("learner"), 2.2)],
    [grade, c(loopAt("learner"), 2.9)],
    [MUSIC.full, c(loopAt("learner"), 3.4)],
  ]));
  const camera = { x: cam.x + drift.x, y: cam.y + drift.y, zoom: cam.zoom, roll: drift.r };

  const ring = (at: number, until: number) => envelope(t, at - 0.1, at + 0.3, until - 0.2, until + 0.2);
  const learnerGlow = Math.max(envelope(t, from, layer, layer + 0.5, theKernel), span(t, student - 0.3, grade, EASE.soft));
  // The learner's light, opening into the morning of the next section.
  const dawn = span(t, MUSIC.full - 1.8, MUSIC.full + 0.1, EASE.leave);

  return (
    <AbsoluteFill>
      <style>{GRAPH_CSS}</style>
      <World camera={camera}>
        {t < MUSIC.breakdown + 0.6 && (
          <Plate dark bare width={LOOP.w} pose={loopA} ms={warp(t, [[from, 0], [theKernel + 0.6, 2600]])}>
            {(th) => <KernelLoopShot theme={th} />}
          </Plate>
        )}
        {t < MUSIC.breakdown + 0.6 && (
          <>
            <Halo {...loopAt("chip")} w={300} h={40} radius={20} strength={ring(theKernel, attempt + 0.6) * (loopA.o ?? 1)} color={TEAL} />
            <Halo {...loopAt("k")} w={120} h={120} radius={60} strength={ring(know + 0.3, fast + 0.3)} color={TEAL} />
            <Halo {...loopAt("v")} w={120} h={120} radius={60} strength={ring(fast + 0.3, sticks + 0.3)} color={TEAL} />
            <Halo {...loopAt("p")} w={120} h={120} radius={60} strength={ring(sticks + 0.3, mindset + 0.3)} color={TEAL} />
            <Halo {...loopAt("m")} w={120} h={120} radius={60} strength={ring(mindset + 0.3, MUSIC.breakdown - 0.2)} color={TEAL} />
          </>
        )}

        {t > MUSIC.breakdown - 0.3 && t < best + 0.7 && (
          <Plate dark bare className="vid-graph" width={1500} pose={graph} ms={graphMs}>
            {(th) => <ConceptGraphShot theme={th} />}
          </Plate>
        )}

        {t > best - 0.3 && t < assumes + 0.6 && (
          <Plate dark width={1000} url="raya.thebluestift.com/kernel" pose={profile} crop={{ top: 0, height: 502 }} ms={warp(t, [[best + 0.2, 0], [grows + 1.2, 1590]])}>
            {(th) => <KernelShot theme={th} />}
          </Plate>
        )}

        {t > assumes - 0.4 && (
          <Plate dark bare width={LOOP.w} pose={loopB} ms={warp(t, [[assumes - 0.4, 9000], [MUSIC.full, 15500]])}>
            {(th) => <KernelLoopShot theme={th} />}
          </Plate>
        )}

        {learnerGlow > 0.001 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 420,
              height: 420,
              borderRadius: "50%",
              transform: `translate(-50%, -50%) translate(${loopAt("learner").x}px, ${loopAt("learner").y}px)`,
              background: "radial-gradient(circle, rgba(196,181,253,0.55) 0%, rgba(167,139,250,0.22) 35%, transparent 70%)",
              opacity: learnerGlow,
            }}
          />
        )}
      </World>

      {dawn > 0.001 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${dawn.toFixed(3)}) ${(dawn * 60).toFixed(1)}%, rgba(238,244,253,${(dawn * 0.9).toFixed(3)}) ${(20 + dawn * 80).toFixed(1)}%, rgba(238,244,253,${(dawn * dawn).toFixed(3)}) 100%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
}
