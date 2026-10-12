import { Composition } from "remotion";
import { Film } from "./film/Film";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export function Root() {
  return <Composition id="Film" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />;
}
