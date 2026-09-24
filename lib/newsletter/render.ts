import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

/**
 * Newsletter issue → email HTML + plain text. PREPARED, NOT WIRED.
 *
 * Pure, so it can be previewed and tested without Resend. The body is written
 * in the same Markdown dialect Raya uses (lib/markdown.ts — no HTML
 * passthrough), so an issue cannot carry markup of its own: every character of
 * author text is escaped here, and a link is kept only when it is http(s) or
 * mailto. Styles are inline because most mail clients drop <style>.
 *
 * Maths renders as code: KaTeX needs a stylesheet no mail client loads.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

const INK = "#0b1220";
const BODY = "#334155";
const MUTED = "#94a3b8";
const LINK = "#2f7fe0";

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
          return esc(n.v);
        case "strong":
          return `<strong>${inlineHtml(n.c)}</strong>`;
        case "em":
          return `<em>${inlineHtml(n.c)}</em>`;
        case "del":
          return `<del>${inlineHtml(n.c)}</del>`;
        case "code":
        case "math":
          return `<code style="font-family:Menlo,Consolas,monospace;font-size:13px;background:#f1f5f9;padding:1px 4px;border-radius:4px;">${esc(n.v)}</code>`;
        case "link": {
          const href = safeHref(n.href);
          const label = inlineHtml(n.c);
          return href ? `<a href="${esc(href)}" style="color:${LINK};">${label}</a>` : label;
        }
      }
    })
    .join("");
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
        case "code":
        case "math":
          return n.v;
        case "link": {
          const label = inlineText(n.c);
          const href = safeHref(n.href);
          return href && href !== label ? `${label} (${href})` : label;
        }
        default:
          return inlineText(n.c);
      }
    })
    .join("");
}

const P = `margin:0 0 14px;font-size:15px;line-height:1.6;color:${BODY};`;

function blockHtml(b: Block): string {
  switch (b.t) {
    case "h": {
      const size = b.level === 1 ? 20 : b.level === 2 ? 17 : 15;
      return `<h${b.level + 1} style="margin:22px 0 10px;font-size:${size}px;font-weight:700;color:${INK};">${inlineHtml(b.c)}</h${b.level + 1}>`;
    }
    case "p":
      return `<p style="${P}">${inlineHtml(b.c)}</p>`;
    case "quote":
      return `<blockquote style="margin:0 0 14px;padding:2px 0 2px 14px;border-left:3px solid #cbd5e1;color:${BODY};font-size:15px;line-height:1.6;">${inlineHtml(b.c)}</blockquote>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : "";
      const items = b.items.map((it) => `<li style="margin:0 0 6px;">${inlineHtml(it)}</li>`).join("");
      return `<${tag}${start} style="margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;color:${BODY};">${items}</${tag}>`;
    }
    case "code":
    case "mathBlock":
      return `<pre style="margin:0 0 14px;padding:12px;background:#f1f5f9;border-radius:8px;font-family:Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap;color:${INK};">${esc(b.v)}</pre>`;
    case "hr":
      return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:22px 0;" />`;
    case "table": {
      const cell = (tag: "th" | "td", c: Inline[], i: number) =>
        `<${tag} style="border:1px solid #e2e8f0;padding:6px 8px;text-align:${b.align[i] ?? "left"};">${inlineHtml(c)}</${tag}>`;
      const head = `<tr>${b.head.map((c, i) => cell("th", c, i)).join("")}</tr>`;
      const rows = b.rows.map((r) => `<tr>${r.map((c, i) => cell("td", c, i)).join("")}</tr>`).join("");
      return `<table style="border-collapse:collapse;margin:0 0 14px;font-size:14px;color:${BODY};">${head}${rows}</table>`;
    }
  }
}

function blockText(b: Block): string {
  switch (b.t) {
    case "h":
      return inlineText(b.c).toUpperCase();
    case "p":
      return inlineText(b.c);
    case "quote":
      return `> ${inlineText(b.c)}`;
    case "list":
      return b.items.map((it, i) => `${b.ordered ? `${b.start + i}.` : "-"} ${inlineText(it)}`).join("\n");
    case "code":
    case "mathBlock":
      return b.v;
    case "hr":
      return "---";
    case "table":
      return [b.head, ...b.rows].map((r) => r.map(inlineText).join(" | ")).join("\n");
  }
}

export type IssueEmailInput = {
  title: string;
  issueNumber: string;
  bodyMd: string;
  /** This recipient's one-click unsubscribe URL. */
  unsubscribeUrl: string;
  /** Where the issue can be read on the web, when it has a page. */
  webUrl?: string | null;
};

export function renderIssueEmail(input: IssueEmailInput): { subject: string; html: string; text: string } {
  const blocks = parseMarkdown(input.bodyMd);
  const subject = `${input.title} — Bluestift Research #${input.issueNumber}`;
  const web = input.webUrl ? safeHref(input.webUrl) : null;
  const unsub = safeHref(input.unsubscribeUrl);
  if (!unsub) throw new Error("renderIssueEmail: unsubscribe URL must be http(s)");

  const html = `<div style="max-width:560px;margin:0 auto;padding:28px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="margin-bottom:6px;"><span style="font-size:20px;font-weight:800;color:${INK};">Bluestift</span><span style="font-size:13px;font-weight:600;color:${LINK};margin-left:8px;">Research #${esc(input.issueNumber)}</span></div>
  <h1 style="font-size:22px;font-weight:700;color:${INK};margin:10px 0 18px;">${esc(input.title)}</h1>
  ${blocks.map(blockHtml).join("\n  ")}
  <p style="margin:28px 0 0;font-size:11.5px;line-height:1.6;color:${MUTED};">You're receiving this because you subscribed to Bluestift Research.${web ? ` <a href="${esc(web)}" style="color:${MUTED};">Read it on the web</a> ·` : ""} <a href="${esc(unsub)}" style="color:${MUTED};">Unsubscribe</a></p>
</div>`;

  const text = [
    `Bluestift Research #${input.issueNumber}`,
    input.title,
    "",
    ...blocks.map(blockText).flatMap((t) => [t, ""]),
    web ? `Read it on the web: ${web}` : "",
    `Unsubscribe: ${unsub}`,
  ]
    .filter((l, i, all) => !(l === "" && all[i - 1] === ""))
    .join("\n")
    .trim();

  return { subject, html, text };
}

/** RFC 2369 + RFC 8058 headers: the mail client's own one-click button. */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Split a list into consecutive chunks of at most `size` (Resend batch = 100). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The double opt-in mail: one button, nothing else to act on. */
export function renderConfirmEmail(confirmUrl: string): { subject: string; html: string; text: string } {
  const url = safeHref(confirmUrl);
  if (!url) throw new Error("renderConfirmEmail: confirm URL must be http(s)");
  const subject = "Confirm your Bluestift Research subscription";
  const html = `<div style="max-width:520px;margin:0 auto;padding:28px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="margin-bottom:18px;"><span style="font-size:20px;font-weight:800;color:${INK};">Bluestift</span><span style="font-size:13px;font-weight:600;color:${LINK};margin-left:8px;">Research</span></div>
  <h1 style="font-size:18px;font-weight:700;color:${INK};margin:0 0 16px;">One click to confirm</h1>
  <p style="${P}">Someone — hopefully you — asked to receive the Bluestift Research newsletter at this address. Nothing will be sent until you confirm.</p>
  <p style="margin:22px 0 0;"><a href="${esc(url)}" style="display:inline-block;background:${LINK};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">Confirm my subscription</a></p>
  <p style="margin:28px 0 0;font-size:11.5px;color:${MUTED};">Didn't ask for this? Ignore this email and you won't hear from us. The link expires in 7 days.</p>
</div>`;
  const text = [
    "One click to confirm",
    "",
    "Someone — hopefully you — asked to receive the Bluestift Research newsletter at this address. Nothing will be sent until you confirm.",
    "",
    `Confirm my subscription: ${url}`,
    "",
    "Didn't ask for this? Ignore this email and you won't hear from us. The link expires in 7 days.",
  ].join("\n");
  return { subject, html, text };
}
