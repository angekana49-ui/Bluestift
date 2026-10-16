"use client";

import type { ReactNode } from "react";
import { useTranslate } from "@/components/ui/locale";
import type { Theme } from "./theme";

/**
 * Body copy that reads as a normal paragraph on desktop, and collapses behind
 * a "Learn more" disclosure on phones — so the drawing next to it can own the
 * screen instead of competing with three lines of caption.
 *
 * Native `<details>`, same reason FaqSection uses it: the copy stays in the
 * HTML for crawlers and for anyone with JavaScript off. Desktop CSS forces the
 * body open and hides the summary, so the disclosure chrome never appears
 * above 720px.
 */
export default function LearnMore({
  theme: t,
  children,
  style,
}: {
  theme: Theme;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const tr = useTranslate();
  return (
    <details className="pub-more" style={style}>
      <summary className="pub-more-sum" style={{ color: t.link }}>
        {tr("site.more")}
      </summary>
      <div className="pub-more-body">{children}</div>
    </details>
  );
}
