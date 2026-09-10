// Branded downloads for generated documents (Schools reports/insights, and later
// Raya outputs). Replaces the raw black-on-white text dump: every export carries
// the brand logo, the document title, and a footer attribution + site link.
// PDF via jsPDF (dynamically imported so a missing package never breaks the build).

import { DOC_BRANDS, footerLine, parseDoc, stripInline, mapInlineMath, latexToUnicode, type DocBrand } from "@/lib/doc-format";
import { getClientEntitlements } from "@/lib/entitlements-client";

/**
 * The two export decisions, derived from the user's entitlements. Fail-open and
 * monitor-mode-safe: while enforcement is off (or entitlements can't be read)
 * everything is allowed and the attribution footer stays on for everyone — i.e.
 * no visible change until launch. Once enforcing: Free can't export PDF, and
 * paid tiers (removeWatermark) drop the footer attribution.
 */
async function exportGate(): Promise<{ pdfAllowed: boolean; watermark: boolean }> {
  const e = await getClientEntitlements();
  if (!e || !e.enforce) return { pdfAllowed: true, watermark: true };
  return { pdfAllowed: e.ent.pdfExport, watermark: !e.ent.removeWatermark };
}

export type BrandedDoc = {
  brand: DocBrand;
  /** Document title, shown in the header and used as the file name. */
  title: string;
  /** Optional line under the title (e.g. "Whole school · 2025–2026"). */
  meta?: string;
  /** Who the document was generated for — fills "…for <audience>" in the footer. */
  audience?: string;
  /** Body as Markdown (headings/lists/paragraphs). */
  body: string;
};

function fileBase(title: string): string {
  return (title || "document").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "document";
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Branded plain-text export: a titled header, the (de-marked) body, and the footer. */
export async function downloadBrandedText(doc: BrandedDoc) {
  const { watermark } = await exportGate();
  const b = DOC_BRANDS[doc.brand];
  const lines = [
    doc.title,
    doc.meta ? doc.meta : null,
    "",
    stripInline(doc.body).trim(),
    ...(watermark ? ["", "—", `${footerLine(doc.brand, doc.audience)} · ${b.url}`] : []),
  ].filter((l) => l !== null);
  triggerDownload(
    new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    `${fileBase(doc.title)}.txt`,
  );
}

// ---- PDF -------------------------------------------------------------------

type RGB = [number, number, number];
function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFontSize: (n: number) => void;
  setFont: (family: string, style?: string) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setLineWidth: (n: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (t: string | string[], x: number, y: number) => void;
  textWithLink: (t: string, x: number, y: number, opts: { url: string }) => void;
  getTextWidth: (t: string) => number;
  splitTextToSize: (t: string, w: number) => string[];
  addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void;
  addPage: () => void;
  setPage: (n: number) => void;
  getNumberOfPages: () => number;
  save: (name: string) => void;
};
type JsPdfCtor = new (opts?: { unit?: string; format?: string }) => JsPdfDoc;

/** Load a /public PNG into a data URL + intrinsic size (for header logo). Best-effort. */
async function loadLogo(src: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null; // logo is decorative — a failed load must not block the export
  }
}

/** A prose block's text, PDF-ready: bold markers dropped (as before), and any
 *  inline `$…$` formula approximated to Unicode (lib/doc-format.ts's
 *  `latexToUnicode`) rather than left as raw LaTeX source. jsPDF draws plain
 *  text runs — it has no notion of a formula embedded mid-sentence the way a
 *  DISPLAY equation gets one below (its own rasterized, actually-typeset
 *  image, since that one already sits on its own line with no wrapping to
 *  fight). */
function proseForPdf(text: string): string {
  return stripInline(mapInlineMath(text, latexToUnicode));
}

/** 1 CSS px, at the 96-DPI the browser and html2canvas both assume, in the pt unit jsPDF is configured with (72 pt/in ÷ 96 px/in). */
const PX_TO_PT = 0.75;
/** Rasterization scale for the hidden math node — sharper than 1:1 so the embedded PDF image doesn't look soft. */
const MATH_RASTER_SCALE = 3;

/**
 * Render one LaTeX formula off-screen with KaTeX, then rasterize it with
 * html2canvas — the practical way to get an actually-typeset formula (proper
 * stacked fractions, raised exponents, root radicals) into a PDF that jsPDF
 * draws with plain text calls. Both libraries are dynamically imported so a
 * document with no math never pays for either, and a document WITH math still
 * exports if the rasterizer throws for any reason (a font not finishing its
 * load, a canvas-tainting quirk) — this returns null rather than the caller
 * failing the whole PDF over one formula.
 */
async function rasterizeMath(tex: string, displayMode: boolean): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (typeof window === "undefined") return null;
  try {
    const [{ renderMathHtml }, html2canvasMod] = await Promise.all([
      import("@/lib/katex-render"),
      import("html2canvas"),
    ]);
    const html2canvas = html2canvasMod.default;
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0";
    host.style.background = "#ffffff";
    host.style.color = "#18202e";
    host.style.padding = "2px 4px";
    host.style.fontSize = "22px";
    host.innerHTML = renderMathHtml(tex, displayMode);
    document.body.appendChild(host);
    try {
      // Best-effort: the KaTeX faces are usually already warm (the document was
      // almost certainly viewed on screen — where the same formula already
      // rendered — before anyone clicked Download), but a font that finishes
      // loading mid-rasterization would bake in the fallback glyphs.
      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // Unsupported or rejected — rasterize with whatever's loaded.
        }
      }
      const canvas = await html2canvas(host, { backgroundColor: "#ffffff", scale: MATH_RASTER_SCALE });
      return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width / MATH_RASTER_SCALE, h: canvas.height / MATH_RASTER_SCALE };
    } finally {
      document.body.removeChild(host);
    }
  } catch {
    return null;
  }
}

/**
 * Branded PDF export: brand logo + title header, a themed body rendered from the
 * document's Markdown (headings/lists/paragraphs), and a footer on every page
 * reading "Generated by <brand> for <audience> · © <year> Bluestift · <site>",
 * with the site as a clickable link.
 */
export async function downloadBrandedPdf(doc: BrandedDoc) {
  const { pdfAllowed, watermark } = await exportGate();
  if (!pdfAllowed) {
    if (typeof window !== "undefined") {
      window.alert(
        "Branded PDF export is a Plus feature. You can still export as TXT — or upgrade at /pricing to unlock PDF.",
      );
    }
    return;
  }
  const brand = DOC_BRANDS[doc.brand];
  const accent = hexToRgb(brand.accent);
  const ink: RGB = [24, 32, 46];
  const muted: RGB = [120, 132, 148];

  const spec = "jspdf";
  const mod = (await import(spec)) as { jsPDF: JsPdfCtor };
  const pdf = new mod.jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const width = pageW - margin * 2;
  const footerY = pageH - 34;
  const bottom = footerY - 18;
  let y = margin;

  // ── Header: logo + brand name, title, meta, accent rule ──
  const logo = await loadLogo(brand.logo);
  if (logo) {
    const h = 26;
    const w = (logo.w / logo.h) * h;
    pdf.addImage(logo.dataUrl, "PNG", margin, y, w, h);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...accent);
    pdf.text(brand.name, margin + w + 10, y + 17);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...accent);
    pdf.text(brand.name, margin, y + 16);
  }
  y += 44;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...ink);
  for (const line of pdf.splitTextToSize(doc.title, width)) {
    pdf.text(line, margin, y);
    y += 23;
  }
  if (doc.meta) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...muted);
    pdf.text(doc.meta, margin, y);
    y += 16;
  }
  y += 6;
  pdf.setDrawColor(...accent);
  pdf.setLineWidth(1.5);
  pdf.line(margin, y, margin + 40, y);
  y += 20;

  // ── Body: styled blocks from Markdown ──
  const block = (fontSize: number, style: string, color: RGB, gapBefore: number, gapAfter: number) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);
    return { gapBefore, gapAfter, lh: fontSize + 4 };
  };
  const ensureRoom = (need: number) => {
    if (y + need > bottom) {
      pdf.addPage();
      y = margin;
    }
  };

  for (const b of parseDoc(doc.body)) {
    if (b.type === "math") {
      const raster = await rasterizeMath(b.text, true);
      y += 10;
      if (raster && raster.w > 0) {
        // Scale to fit the content width — a formula wider than the page
        // shrinks to fit rather than running off the margin; one that's
        // already narrower is drawn at its natural (sharp) size.
        const scale = Math.min(1, width / (raster.w * PX_TO_PT));
        const wPt = raster.w * PX_TO_PT * scale;
        const hPt = raster.h * PX_TO_PT * scale;
        ensureRoom(hPt);
        pdf.addImage(raster.dataUrl, "PNG", margin + (width - wPt) / 2, y, wPt, hPt);
        y += hPt + 10;
      } else {
        // Rasterizing failed — fall back to the same Unicode approximation an
        // inline formula gets, centred, rather than losing the formula outright.
        block(11, "italic", ink, 0, 4);
        const approx = latexToUnicode(b.text);
        const lines = pdf.splitTextToSize(approx, width);
        for (const line of lines) {
          ensureRoom(15);
          pdf.text(line, margin + (width - pdf.getTextWidth(line)) / 2, y);
          y += 15;
        }
        y += 4;
      }
      continue;
    }

    const text = proseForPdf(b.text);
    const cfg =
      b.type === "h1"
        ? block(15, "bold", ink, 12, 6)
        : b.type === "h2"
          ? block(13, "bold", accent, 12, 4)
          : b.type === "h3"
            ? block(11.5, "bold", ink, 8, 3)
            : b.type === "li"
              ? block(11, "normal", ink, 1, 1)
              : block(11, "normal", ink, 2, 4);

    const indent = b.type === "li" ? 16 : 0;
    const lines = pdf.splitTextToSize(text, width - indent);
    y += cfg.gapBefore;
    if (b.type === "li") {
      ensureRoom(cfg.lh);
      pdf.setTextColor(...accent);
      pdf.text("•", margin, y);
      pdf.setTextColor(...ink);
    }
    for (const line of lines) {
      ensureRoom(cfg.lh);
      pdf.text(line, margin + indent, y);
      y += cfg.lh;
    }
    y += cfg.gapAfter;
  }

  // ── Footer on every page ── (attribution only when watermarked; paid tiers
  // drop it. Page numbers stay regardless — they're navigation, not branding.)
  const foot = footerLine(doc.brand, doc.audience);
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    if (watermark) {
      pdf.setDrawColor(230, 234, 240);
      pdf.setLineWidth(0.75);
      pdf.line(margin, footerY - 10, pageW - margin, footerY - 10);
      const prefix = `${foot} · `;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...muted);
      pdf.text(prefix, margin, footerY);
      // The site URL, drawn right after the attribution text, as a real link.
      const prefixW = pdf.getTextWidth(prefix);
      pdf.setTextColor(...accent);
      pdf.textWithLink(brand.url, margin + prefixW, footerY, { url: `https://${brand.url}` });
    }
    // Page number, right-aligned, on multi-page documents.
    if (pages > 1) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...muted);
      pdf.text(`${p} / ${pages}`, pageW - margin - 24, footerY);
    }
  }

  pdf.save(`${fileBase(doc.title)}.pdf`);
}
