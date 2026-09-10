import katex from "katex";

/**
 * LaTeX → KaTeX HTML, for both the on-screen document view (components/ui/document.tsx)
 * and, off-screen, the rasterized PDF image (lib/document.ts). Never throws —
 * malformed LaTeX from a model's generation degrades to the raw source shown as
 * plain text rather than breaking the surrounding document.
 *
 * `strict: "ignore"` because a model writes ordinary Markdown conventions
 * (`%`, `_` in a word) inside the SAME body this math lives in — KaTeX's
 * default strict mode warns/throws on those even outside math it didn't
 * expect them in, which is noise this app has no use for.
 */
export function renderMathHtml(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, strict: "ignore" });
  } catch {
    const esc = tex.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return displayMode ? `<div>${esc}</div>` : `<span>${esc}</span>`;
  }
}
