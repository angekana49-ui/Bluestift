import LandingPage, { defaultConfig } from "@/components/LandingPage";

// ─────────────────────────────────────────────────────────────
//  To customise the template: edit the config object below,
//  or pass your own SiteConfig from a CMS / data layer.
// ─────────────────────────────────────────────────────────────

export default function Home() {
  return <LandingPage config={defaultConfig} />;
}
