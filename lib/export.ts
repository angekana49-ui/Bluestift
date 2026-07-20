// Client-side downloads for RAYA outputs (summaries, quizzes, Kernel analysis).
// PDF via jsPDF, dynamically imported so a missing package never breaks the
// build/type-check — only PDF export needs `jspdf` installed at runtime.

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

export function downloadText(filename: string, text: string) {
  const name = filename.endsWith(".txt") ? filename : `${filename}.txt`;
  triggerDownload(new Blob([text], { type: "text/plain;charset=utf-8" }), name);
}

type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFontSize: (n: number) => void;
  setFont: (family: string, style?: string) => void;
  text: (t: string | string[], x: number, y: number) => void;
  splitTextToSize: (t: string, w: number) => string[];
  addPage: () => void;
  save: (name: string) => void;
};
type JsPdfCtor = new (opts?: { unit?: string; format?: string }) => JsPdfDoc;

export async function downloadPdf(filename: string, title: string, body: string) {
  const spec: string = "jspdf";
  const mod = (await import(spec)) as { jsPDF: JsPdfCtor };
  const doc = new mod.jsPDF({ unit: "pt", format: "a4" });

  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  const lineHeight = 15;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  for (const line of doc.splitTextToSize(title, width)) {
    doc.text(line, margin, y);
    y += 22;
  }
  y += 6;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  for (const paragraph of body.split("\n")) {
    const lines = paragraph.length ? doc.splitTextToSize(paragraph, width) : [""];
    for (const line of lines) {
      if (y > bottom) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
