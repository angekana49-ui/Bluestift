import { Composition } from "remotion";
import { Gallery, type GalleryProps } from "./Gallery";
import { HowItWorks } from "./HowItWorks";
import { TEXTURES, TextureFrame, textureSize } from "./Texture";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export function Root() {
  return (
    <>
      <Composition
        id="HowItWorks"
        component={HowItWorks}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Dev: a contact sheet of the site's shots (scripts/gallery.mjs, scripts/measure.mjs). */}
      <Composition
        id="Gallery"
        component={Gallery}
        durationInFrames={1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ shot: "kernel", dark: false, ms: 60000, width: 1500 } satisfies GalleryProps}
      />
      {/* The finished screens the wide shots use as pictures (scripts/textures.mjs). */}
      <Composition
        id="Texture"
        component={TextureFrame}
        durationInFrames={1}
        fps={FPS}
        width={1500}
        height={700}
        defaultProps={{ name: TEXTURES[0].name }}
        calculateMetadata={({ props }) => textureSize(TEXTURES.find((s) => s.name === props.name)!)}
      />
    </>
  );
}
