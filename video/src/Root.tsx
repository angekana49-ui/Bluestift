import { Composition } from "remotion";
import { Film } from "./film/Film";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";
import { DemoFilm } from "./demo/DemoFilm";
import { FPS as DEMO_FPS, HEIGHT as DEMO_HEIGHT, TOTAL_FRAMES as DEMO_FRAMES, WIDTH as DEMO_WIDTH } from "./demo/cues";

export function Root() {
  return (
    <>
      <Composition id="Film" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition
        id="BluestiftDemo"
        component={DemoFilm}
        durationInFrames={DEMO_FRAMES}
        fps={DEMO_FPS}
        width={DEMO_WIDTH}
        height={DEMO_HEIGHT}
        defaultProps={{}}
      />
    </>
  );
}
