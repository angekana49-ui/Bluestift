import { OG_IMAGE_ALT, OG_IMAGE_SIZE, buildBrandOgImage } from "@/lib/seo-image";

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return buildBrandOgImage();
}
