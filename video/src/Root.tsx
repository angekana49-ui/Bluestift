import { Composition } from "remotion";
import { HowItWorks } from "./HowItWorks";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export function Root() {
  return (
    <Composition
      id="HowItWorks"
      component={HowItWorks}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}
