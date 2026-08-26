"use client";

import { useThemeMode } from "./useThemeMode";
import { getTheme } from "./theme";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import ConnectionSection from "./ConnectionSection";
import FeaturesSection from "./FeaturesSection";
import LadderSection from "./LadderSection";
import KernelSection from "./KernelSection";
import DifferentiatorsSection from "./DifferentiatorsSection";
import FaqSection from "./FaqSection";
import PricingSection, { type EntryPrice } from "./PricingSection";
import FinalCtaSection from "./FinalCtaSection";
import Footer from "./Footer";
import { LanguagePrompt } from "./LanguagePrompt";

export default function LandingPage({
  signedIn,
  homeHref,
  soloPrice,
  schoolPrice,
}: {
  signedIn?: boolean;
  homeHref?: string;
  /** Entry prices resolved server-side from the plan catalogue; null when unreadable. */
  soloPrice?: EntryPrice | null;
  schoolPrice?: EntryPrice | null;
}) {
  const { isDark, toggle } = useThemeMode();
  const t = getTheme(isDark);

  return (
    <div
      style={
        {
          fontFamily: "var(--font-inter),'Inter',sans-serif",
          color: t.text,
          minHeight: "100vh",
          background: t.pageBg,
          transition: "background 0.4s ease, color 0.4s ease",
          // Hover elevation for `.pub-lift` cards. It has to reach CSS as a
          // custom property because the hover state can only live in the
          // stylesheet while the theme itself lives in React state.
          "--pub-lift-shadow": t.liftShadow,
        } as React.CSSProperties
      }
    >
      <Navbar theme={t} isDark={isDark} onToggleTheme={toggle} active="Product" signedIn={signedIn} homeHref={homeHref} />
      <HeroSection theme={t} />
      {/* Order is the argument: state the gap (hero), show the loop that closes
          it (connection), then the surfaces that run on it (features). */}
      <ConnectionSection theme={t} />
      <FeaturesSection theme={t} />
      {/* Claim, then proof. Ladder and Kernel are the two places the page stops
          describing the product and shows the actual mechanism — the tutor's
          escalation policy and the fields the Kernel really stores. They sit
          right after the surfaces so a sceptical teacher hits them before the
          comparison, not after it. */}
      <LadderSection theme={t} />
      <KernelSection theme={t} />
      {/* Was the ✕/✓ comparison; it states the product's position now. Same
          component, so the order and the tone sequence are unchanged. */}
      <DifferentiatorsSection theme={t} />
      {/* Objection handling: the six that come back from every school. The one
          that isn't here — "is any of this real yet?" — used to be answered by
          the roadmap; it now lives at /research?tab=progress, linked from the
          footer, because it is a changelog and not part of the argument. */}
      <FaqSection theme={t} />
      <PricingSection theme={t} soloPrice={soloPrice} schoolPrice={schoolPrice} />
      <FinalCtaSection theme={t} signedIn={signedIn} homeHref={homeHref} />
      <Footer theme={t} variant="full" />
      {/* First visit only: asks the language instead of hiding a picker in the
          nav. Renders nothing once answered, and nothing at all server-side. */}
      <LanguagePrompt theme={t} />
    </div>
  );
}
