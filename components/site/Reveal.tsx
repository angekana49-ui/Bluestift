"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll reveal: content eases up into place the first time it enters view.
 *
 * The hiding is done imperatively, after mount, and only to elements still
 * below the fold. That ordering is the whole point:
 *
 *  - the server-rendered markup is fully visible, so a crawler or a visitor
 *    with JS off reads a normal page rather than a blank one;
 *  - an element already on screen at mount is left alone, so nothing flashes
 *    hidden-then-shown on first paint;
 *  - `prefers-reduced-motion` and browsers without IntersectionObserver simply
 *    never get the class, which is the correct no-op.
 *
 * One-shot on purpose (`io.disconnect()` on first intersection): re-animating
 * on every scroll-by is the thing that makes these effects feel cheap.
 */

export default function Reveal({
  children,
  delay = 0,
  style,
  className,
}: {
  children: ReactNode;
  /** Stagger, in ms — use small steps (60–90) across a row of cards. */
  delay?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Already visible at mount — animating now would be a flash, not a reveal.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    el.classList.add("pub-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        el.classList.add("pub-reveal-in");
        io.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}
