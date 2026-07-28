"use client";

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";
import { parseLatex, latexToText, type MathNode } from "@/lib/latex";
import { type AppTheme } from "@/components/ui/tokens";

/**
 * Renders a Raya reply: Markdown structure (headings, emphasis, lists, tables,
 * code) and maths. Before this, replies were dumped as pre-wrapped plain text,
 * so a formula, a comparison table or a worked list all arrived as an
 * undifferentiated wall — the exact content where structure carries meaning.
 *
 * Two constraints shape it:
 *  - it re-renders on every streamed chunk, so parsing is memoised on the raw
 *    string and the parser is lenient about half-written markup;
 *  - it never renders HTML from the model — only this fixed set of elements —
 *    so a reply cannot inject markup into the page.
 */

// ── Maths ─────────────────────────────────────────────────────────────────

function MathNodes({ nodes }: { nodes: MathNode[] }): ReactNode {
  return (
    <>
      {nodes.map((n, i) => (
        <Fragment key={i}>{renderMathNode(n)}</Fragment>
      ))}
    </>
  );
}

function renderMathNode(n: MathNode): ReactNode {
  switch (n.t) {
    case "sym":
      return n.v;
    case "sup":
      return (
        <sup style={{ fontSize: "0.75em", lineHeight: 0 }}>
          <MathNodes nodes={n.c} />
        </sup>
      );
    case "sub":
      return (
        <sub style={{ fontSize: "0.75em", lineHeight: 0 }}>
          <MathNodes nodes={n.c} />
        </sub>
      );
    case "row":
      return <MathNodes nodes={n.c} />;
    case "sqrt":
      // √ plus an overline over the radicand — the standard way to show a root
      // without a maths font.
      return (
        <span style={{ whiteSpace: "nowrap" }}>
          √
          <span style={{ borderTop: "1px solid currentColor", padding: "0 0.15em" }}>
            <MathNodes nodes={n.c} />
          </span>
        </span>
      );
    case "frac":
      // A real stacked fraction: numerator over a rule over the denominator.
      return (
        <span
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            verticalAlign: "-0.55em",
            margin: "0 0.15em",
            fontSize: "0.95em",
            lineHeight: 1.15,
          }}
        >
          <span style={{ padding: "0 0.25em" }}>
            <MathNodes nodes={n.num} />
          </span>
          <span
            style={{
              width: "100%",
              borderTop: "1px solid currentColor",
              margin: "0.08em 0",
            }}
          />
          <span style={{ padding: "0 0.25em" }}>
            <MathNodes nodes={n.den} />
          </span>
        </span>
      );
  }
}

function Math({ src, block }: { src: string; block?: boolean }) {
  const nodes = useMemo(() => parseLatex(src), [src]);
  const style: CSSProperties = {
    fontFamily: "'Cambria Math', 'Latin Modern Math', Georgia, serif",
    fontStyle: "italic",
    whiteSpace: "nowrap",
  };
  if (block) {
    return (
      <div
        role="math"
        aria-label={latexToText(nodes)}
        style={{
          ...style,
          display: "block",
          textAlign: "center",
          fontSize: "1.1em",
          margin: "0.7em 0",
          overflowX: "auto",
        }}
      >
        <MathNodes nodes={nodes} />
      </div>
    );
  }
  return (
    <span role="math" aria-label={latexToText(nodes)} style={style}>
      <MathNodes nodes={nodes} />
    </span>
  );
}

// ── Inline ────────────────────────────────────────────────────────────────

function Inlines({ nodes, t }: { nodes: Inline[]; t: AppTheme }): ReactNode {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{n.v}</Fragment>;
          case "strong":
            return (
              <strong key={i} style={{ fontWeight: 700 }}>
                <Inlines nodes={n.c} t={t} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={n.c} t={t} />
              </em>
            );
          case "del":
            return (
              <span key={i} style={{ textDecoration: "line-through", opacity: 0.7 }}>
                <Inlines nodes={n.c} t={t} />
              </span>
            );
          case "code":
            return (
              <code
                key={i}
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: "0.9em",
                  background: t.dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
                  borderRadius: 5,
                  padding: "0.12em 0.35em",
                }}
              >
                {n.v}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                <Inlines nodes={n.c} t={t} />
              </a>
            );
          case "math":
            return <Math key={i} src={n.v} />;
        }
      })}
    </>
  );
}

// ── Blocks ────────────────────────────────────────────────────────────────

function BlockView({ b, t, first }: { b: Block; t: AppTheme; first: boolean }) {
  const gap = first ? 0 : "0.7em";
  switch (b.t) {
    case "p":
      return (
        <p style={{ margin: `${gap} 0 0` }}>
          <Inlines nodes={b.c} t={t} />
        </p>
      );
    case "h": {
      const size = b.level === 1 ? "1.25em" : b.level === 2 ? "1.12em" : "1.02em";
      return (
        <div
          style={{
            margin: `${first ? 0 : "0.9em"} 0 0`,
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          <Inlines nodes={b.c} t={t} />
        </div>
      );
    }
    case "list":
      return (
        <ul
          style={{
            margin: `${gap} 0 0`,
            paddingLeft: "1.35em",
            listStyle: b.ordered ? "decimal" : "disc",
          }}
          {...(b.ordered ? { start: b.start } : {})}
        >
          {b.items.map((item, i) => (
            <li key={i} style={{ margin: "0.2em 0" }}>
              <Inlines nodes={item} t={t} />
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre
          style={{
            margin: `${gap} 0 0`,
            padding: "10px 12px",
            borderRadius: 10,
            background: t.dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.05)",
            overflowX: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: "0.86em",
            lineHeight: 1.5,
            whiteSpace: "pre",
          }}
        >
          <code>{b.v}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote
          style={{
            margin: `${gap} 0 0`,
            paddingLeft: "0.8em",
            borderLeft: `3px solid ${t.dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)"}`,
            opacity: 0.9,
          }}
        >
          <Inlines nodes={b.c} t={t} />
        </blockquote>
      );
    case "table": {
      const border = t.dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
      const cell = (align: string): CSSProperties => ({
        border: `1px solid ${border}`,
        padding: "6px 10px",
        textAlign: align as CSSProperties["textAlign"],
        verticalAlign: "top",
      });
      return (
        // Wide tables scroll inside the bubble instead of stretching it.
        <div style={{ margin: `${gap} 0 0`, overflowX: "auto", maxWidth: "100%" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.92em" }}>
            <thead>
              <tr>
                {b.head.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      ...cell(b.align[i] ?? "left"),
                      fontWeight: 700,
                      background: t.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Inlines nodes={h} t={t} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i} style={cell(b.align[i] ?? "left")}>
                      <Inlines nodes={c} t={t} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "mathBlock":
      return <Math src={b.v} block />;
    case "hr":
      return (
        <hr
          style={{
            margin: "0.9em 0 0",
            border: 0,
            borderTop: `1px solid ${t.dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
          }}
        />
      );
  }
}

/**
 * A message body. `content` is raw Markdown, possibly mid-stream.
 * Whitespace inside a paragraph is normalised by the parser, so the container
 * must NOT use pre-wrap — line breaks come from the block structure.
 */
export function RichText({ content, theme }: { content: string; theme: AppTheme }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  // Type size and colour are inherited from the bubble, so the same component
  // sits correctly in the solo thread and in a room's group bubble.
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} t={theme} first={i === 0} />
      ))}
    </>
  );
}
