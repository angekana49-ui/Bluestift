"use client";

import { useAppTheme } from "@/components/ui/theme";
import { display, type AppTheme } from "@/components/ui/tokens";
import {
  DOC_BRANDS,
  footerLine,
  parseDoc,
  splitInline,
  type DocBlock,
  type DocBrand,
} from "@/lib/doc-format";

/**
 * The shared on-screen document châssis: a branded card (logo + title + meta
 * header, an accent rule, a typographed Markdown body, and a footer attribution)
 * with TXT/PDF/close actions. Every generated document — Schools reports and
 * insights today, Raya outputs next — renders through this so the app and the
 * downloaded file read the same. Downloads are wired by the caller (via
 * `lib/document.ts`) so this component stays presentational.
 */
export function DocumentView({
  brand,
  title,
  meta,
  audience,
  body,
  onTxt,
  onPdf,
  onClose,
  maxWidth = 900,
}: {
  brand: DocBrand;
  title: string;
  meta?: string;
  audience?: string;
  /** Document body as Markdown (same field as `BrandedDoc.body`, so a doc object spreads cleanly). */
  body: string;
  onTxt?: () => void;
  onPdf?: () => void;
  onClose?: () => void;
  maxWidth?: number;
}) {
  const { theme: t } = useAppTheme();
  const b = DOC_BRANDS[brand];
  const blocks = parseDoc(body);

  return (
    <div
      style={{
        maxWidth,
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Header: logo + brand, actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          borderBottom: `1px solid ${t.cardBorder}`,
          background: t.cardBg2,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.logo} alt="" style={{ height: 22, width: "auto", flex: "none" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: b.accent, letterSpacing: "0.01em" }}>{b.name}</span>
        <span style={{ flex: 1 }} />
        {onTxt && <DocButton t={t} onClick={onTxt} label="TXT" />}
        {onPdf && <DocButton t={t} onClick={onPdf} label="PDF" />}
        {onClose && <DocButton t={t} onClick={onClose} label="✕" title="Close" />}
      </div>

      {/* Title + meta + accent rule */}
      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: display, color: t.text, lineHeight: 1.25 }}>
          {title}
        </div>
        {meta && <div style={{ fontSize: 14, color: t.muted, marginTop: 3 }}>{meta}</div>}
        <div style={{ width: 40, height: 3, borderRadius: 2, background: b.accent, margin: "12px 0 4px" }} />
      </div>

      {/* Body */}
      <div style={{ padding: "6px 22px 4px" }}>
        {blocks.map((blk, i) => (
          <Block key={i} block={blk} t={t} accent={b.accent} />
        ))}
      </div>

      {/* Footer attribution */}
      <div
        style={{
          padding: "12px 22px 16px",
          marginTop: 8,
          borderTop: `1px solid ${t.cardBorder}`,
          fontSize: 13,
          color: t.mutedLight,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span>{footerLine(brand, audience)} ·</span>
        <a href={`https://${b.url}`} target="_blank" rel="noopener noreferrer" style={{ color: b.accent, textDecoration: "none" }}>
          {b.url}
        </a>
      </div>
    </div>
  );
}

function Block({ block, t, accent }: { block: DocBlock; t: AppTheme; accent: string }) {
  const spans = splitInline(block.text);
  const content = spans.map((s, i) =>
    s.bold ? (
      <strong key={i} style={{ fontWeight: 700 }}>
        {s.text}
      </strong>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );

  if (block.type === "h1")
    return <div style={{ fontSize: 18, fontWeight: 800, color: t.text, margin: "16px 0 6px", fontFamily: display }}>{content}</div>;
  if (block.type === "h2")
    return <div style={{ fontSize: 16, fontWeight: 700, color: accent, margin: "16px 0 5px" }}>{content}</div>;
  if (block.type === "h3")
    return <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "12px 0 4px" }}>{content}</div>;
  if (block.type === "li")
    return (
      <div style={{ display: "flex", gap: 8, margin: "3px 0", fontSize: 15, color: t.text, lineHeight: 1.55 }}>
        <span style={{ color: accent, flex: "none" }}>•</span>
        <span>{content}</span>
      </div>
    );
  return <p style={{ fontSize: 15, color: t.text, lineHeight: 1.6, margin: "6px 0" }}>{content}</p>;
}

function DocButton({ t, onClick, label, title }: { t: AppTheme; onClick: () => void; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: t.cardBg,
        color: t.mutedLight,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 99,
        padding: "5px 12px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
