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
import PricingSection from "./PricingSection";
import FinalCtaSection from "./FinalCtaSection";
import Footer from "./Footer";
import { LanguagePrompt } from "./LanguagePrompt";

// NOTE: SiteConfig/defaultConfig below are retained only for the (now unused)
// InboxSection component. The live landing hardcodes its copy per the design
// handoff (design_handoff_bluestift_landing); it no longer reads a config.
export interface SiteConfig {
  brand: {
    name: string;
    tagline: string;
    description: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  features: {
    sectionHeadline: string;
    sectionSub: string;
    items: {
      icon: string;
      title: string;
      description: string;
      stats?: { label: string; value: string; color: string }[];
    }[];
  };
  differentiators: {
    sectionHeadline: string;
    sectionSub: string;
    items: { label: string; verdict: string; bad: boolean }[];
  };
  inbox: {
    headline: string;
    highlightedWord: string;
    description: string;
    bullets: { title: string; description: string }[];
    threads: {
      initials: string;
      name: string;
      preview: string;
      status?: string;
      statusColor?: "blue" | "gray" | "orange" | "yellow" | "";
    }[];
  };
  pricing: {
    headline: string;
    highlightedWord: string;
    subheadline: string;
    plans: {
      name: string;
      price?: string;
      period?: string;
      description: string;
      features: string[];
      cta: string;
      recommended?: boolean;
      custom?: boolean;
    }[];
  };
  stats: {
    sessionsToday: string;
    sessionsTrend: string;
    studentsBlocked: string;
    blockedTrend: string;
    avgMastery: string;
    masteryTrend: string;
    activeStudents: string;
    activeTrend: string;
  };
}

export const defaultConfig: SiteConfig = {
  brand: {
    name: "BlueStift",
    tagline: "Raya · K-12 AI tutor",
    description:
      "BlueStift builds Raya, the AI tutor that remembers every student — for classrooms from Cameroon to the United States.",
  },
  hero: {
    headline: "The AI tutor that remembers every student.",
    subheadline:
      "Raya adapts every session to each student's real cognitive profile — solo, in groups, in real time. Not a chatbot. A tutor.",
    ctaPrimary: "Try it free",
    ctaSecondary: "See how it works",
  },
  features: {
    sectionHeadline: "Built for students who need more than a chatbot.",
    sectionSub:
      "Three surfaces that work together. None needs managing. The platform is the absence of a dashboard to watch.",
    items: [
      {
        icon: "K",
        title: "Cognitive Kernel",
        description:
          "Mastery is measured concept by concept, not by an overall grade. Each student's profile evolves silently after every session.",
        stats: [
          { label: "Math", value: "78%", color: "#22c55e" },
          { label: "French", value: "64%", color: "#4f46e5" },
          { label: "Science", value: "91%", color: "#22c55e" },
        ],
      },
      {
        icon: "S",
        title: "Study Rooms",
        description:
          "Students and Raya in real time, to revise together or unblock a problem as a group.",
        stats: [
          { label: "Active rooms", value: "12", color: "#4f46e5" },
          { label: "Students", value: "340", color: "#4f46e5" },
          { label: "This week", value: "+18%", color: "#22c55e" },
        ],
      },
      {
        icon: "T",
        title: "Tools Studio",
        description: "Quizzes, summaries and flashcards generated from a single file or lesson.",
        stats: [
          { label: "Quizzes created", value: "1,204", color: "#173d8a" },
          { label: "Summaries", value: "860", color: "#173d8a" },
          { label: "Flashcards", value: "3,400", color: "#173d8a" },
        ],
      },
    ],
  },
  differentiators: {
    sectionHeadline: "Why not the others?",
    sectionSub: "The difference isn't the AI. It's the memory.",
    items: [
      { label: "ChatGPT / Claude", verdict: "Answers but doesn't remember. Starts from scratch every session.", bad: true },
      { label: "Khan Academy", verdict: "Fixed path. Step off the script and you're on your own.", bad: true },
      { label: "NotebookLM", verdict: "Analyzes documents but doesn't challenge you, doesn't measure.", bad: true },
      { label: "Raya", verdict: "Remembers. Adapts. Measures. And learns from you.", bad: false },
    ],
  },
  inbox: {
    headline: "Raya never starts from",
    highlightedWord: "scratch.",
    description:
      "Every session enriches the student's cognitive profile. The next day, Raya knows exactly where to pick up — and the teacher sees everything, without entering a thing.",
    bullets: [
      {
        title: "It asks questions, not answers",
        description: "The Socratic method guides the student and detects blocks in real time.",
      },
      {
        title: "The Kernel learns continuously",
        description: "After every session, per-concept mastery is recalculated silently.",
      },
      {
        title: "The teacher sees everything the next morning",
        description: "Who's stuck, on what, for how long — with no manual entry.",
      },
    ],
    threads: [
      { initials: "MR", name: "Maya · 9th grade", preview: "Unblocked fractions after 3 Kernel-guided sessions.", status: "Mastered", statusColor: "blue" },
      { initials: "JT", name: "Jonas · 12th grade", preview: "Still stuck on function limits, 4th session on the topic.", status: "Watch", statusColor: "orange" },
      { initials: "AO", name: "Aiko · 7th grade", preview: "Study Room session finished with two classmates.", status: "", statusColor: "" },
      { initials: "RC", name: "Refik · 8th grade", preview: "Quiz auto-generated from his biology lesson.", status: "Done", statusColor: "gray" },
      { initials: "EC", name: "Elena · 10th grade", preview: "Raya spotted a drop-off on trigonometry this morning.", status: "New", statusColor: "yellow" },
    ],
  },
  pricing: {
    headline: "Pricing that",
    highlightedWord: "stays simple.",
    subheadline: "One plan per team size. The trial is genuinely free — fourteen days, no card.",
    plans: [
      {
        name: "Student",
        price: "Free",
        period: "forever",
        description: "To get started solo with Raya.",
        features: ["Solo sessions with Raya", "Study Rooms", "Tools (quizzes, summaries, flashcards)", "Personal cognitive profile", "Email support"],
        cta: "Create an account",
      },
      {
        name: "Class",
        price: "$29",
        period: "/month",
        description: "For a teacher and their students.",
        features: [
          "Full teacher dashboard",
          "Unlimited rooms",
          "Priority alerts",
          "All Tools formats",
          "Google Classroom sync",
          "Weekly reports",
        ],
        cta: "Start the trial",
        recommended: true,
      },
      {
        name: "School",
        description: "For an entire school.",
        features: [
          "Multi-class, multi-teacher",
          "Per-class insights and simulations",
          "Full LMS integration",
          "Raya for Schools",
          "Reports by subject, class, school",
          "Dedicated support",
        ],
        cta: "Talk to the team",
        custom: true,
      },
    ],
  },
  stats: {
    sessionsToday: "482",
    sessionsTrend: "+21% vs last month",
    studentsBlocked: "6",
    blockedTrend: "-2 since this morning",
    avgMastery: "83%",
    masteryTrend: "+12 points this month",
    activeStudents: "1,204",
    activeTrend: "+340 this week",
  },
};

export default function LandingPage({
  signedIn,
  homeHref,
  soloPrices,
  schoolPrices,
}: {
  signedIn?: boolean;
  homeHref?: string;
  /** Price lines resolved server-side from the plan catalogue; null when unreadable. */
  soloPrices?: string | null;
  schoolPrices?: string | null;
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
      {/* Objection handling: the five that come back from every school. The
          sixth — "is any of this real yet?" — used to be answered here by the
          roadmap; it now lives at /research?tab=progress, linked from the
          footer, because it is a changelog and not part of the argument. */}
      <FaqSection theme={t} />
      <PricingSection theme={t} soloPrices={soloPrices} schoolPrices={schoolPrices} />
      <FinalCtaSection theme={t} signedIn={signedIn} homeHref={homeHref} />
      <Footer theme={t} variant="full" />
      {/* First visit only: asks the language instead of hiding a picker in the
          nav. Renders nothing once answered, and nothing at all server-side. */}
      <LanguagePrompt theme={t} />
    </div>
  );
}
