"use client";

import { useState } from "react";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { parseDoc } from "@/lib/doc-format";
import { QuizPlayer, FlashcardsPlayer, ReaderView, MindMapView } from "@/components/study/focus-player";
import { useAppTheme } from "@/components/ui/theme";
import { display, status as statusColors, type AppTheme } from "@/components/ui/tokens";
import { IconQuiz, IconFlashcards, IconSummary } from "@/components/ui/icons";

type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
};
type Flashcard = { front: string; back: string };
type MindMapBranch = { label: string; children: string[] };
type MindMap = { title: string; branches: MindMapBranch[] };
type Upload = {
  id: string;
  title: string | null;
  url: string | null;
  type: string | null;
  created_at: string;
};
type Output = {
  id: string;
  tool_type: string;
  status: string;
  output_content: unknown;
  created_at: string;
};
type SelfTest = { id: string; title: string | null; score: number | null };

/** What the full-screen focus player is currently showing. */
type ActivePlayer =
  | { kind: "summary"; title: string; text: string }
  | { kind: "quiz"; title: string; questions: QuizQuestion[] }
  | { kind: "flashcards"; title: string; cards: Flashcard[] }
  | { kind: "mind_map"; title: string; mindMap: MindMap };

const TOOLS = [
  { id: "summary", label: "Summary", ready: true },
  { id: "quiz", label: "Quiz (MCQ)", ready: true },
  { id: "flashcards", label: "Flashcards", ready: true },
  { id: "mind_map", label: "Mind map", ready: true },
  { id: "audio_summary", label: "Audio summary", ready: false },
  { id: "infographic", label: "Infographic", ready: false },
];

// Themed style helpers.
const panel = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 18,
  padding: 20,
  marginTop: 16,
});
const cta = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
const ghost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)"}`,
  borderRadius: 99,
  padding: "6px 13px",
  fontSize: 11.5,
  fontWeight: 600,
  cursor: "pointer",
});
const sectionLabel = (t: AppTheme): React.CSSProperties => ({
  fontSize: 10.5,
  color: t.mutedLight,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

// Markdown composers → the branded document body (typeset by the exporter).
function quizToMd(qs: QuizQuestion[]) {
  return qs
    .map((q, i) => {
      const opts = q.options
        .map((o, oi) => `- ${String.fromCharCode(65 + oi)}. ${o}${oi === q.correct_index ? " ✓" : ""}`)
        .join("\n");
      const ex = q.explanation ? `\nExplanation: ${q.explanation}` : "";
      return `## Question ${i + 1}\n${q.question}\n${opts}${ex}`;
    })
    .join("\n\n");
}

function flashcardsToMd(cards: Flashcard[]) {
  return cards.map((c, i) => `## Card ${i + 1}\n**${c.front}**\n- ${c.back}`).join("\n\n");
}

function mindMapToMd(m: MindMap) {
  const branches = m.branches.map((b) => `## ${b.label}\n${b.children.map((c) => `- ${c}`).join("\n")}`).join("\n\n");
  return `# ${m.title}\n\n${branches}`;
}

export function Tools({
  uploads,
  outputs,
  selfTests,
  studentName,
}: {
  uploads: Upload[];
  outputs: Output[];
  selfTests: SelfTest[];
  studentName?: string;
}) {
  const { theme: t } = useAppTheme();
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [tool, setTool] = useState("summary");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<ActivePlayer | null>(null);

  const baseName = (fileName ?? "raya").replace(/\.[^.]+$/, "");

  // Every tool export goes through the shared branded document (Raya logo, title,
  // footer attribution + thebluestift.com link).
  const doc = (title: string, body: string): BrandedDoc => ({
    brand: "raya",
    title,
    meta: new Date().toLocaleDateString(),
    audience: studentName || undefined,
    body,
  });
  const downloadActions = (d: BrandedDoc) => (
    <>
      <button style={ghost(t)} onClick={() => downloadBrandedText(d)}>TXT</button>
      <button style={ghost(t)} onClick={() => downloadBrandedPdf(d)}>PDF</button>
    </>
  );

  async function onPick(f: File | null) {
    setError(null);
    setSourceText("");
    setMediaId(null);
    setFileName(f?.name ?? null);
    if (!f) return;

    setBusy(true);
    setStatusMsg("Reading the file… (audio is transcribed, this can take a moment)");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/tools/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Extraction failed (${res.status}).`);
        return;
      }
      setSourceText(data.text ?? "");
      setMediaId(data.media_id ?? null);
      setStatusMsg(
        data.kind === "audio"
          ? "Audio transcribed ✓"
          : data.kind === "pdf"
            ? "PDF text extracted ✓"
            : "Text loaded ✓",
      );
    } catch {
      setError("Couldn't process the file.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!sourceText || busy) return;
    setBusy(true);
    setError(null);
    setStatusMsg("Generating…");
    try {
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool_type: tool,
          source_text: sourceText,
          title: fileName,
          source_media_id: mediaId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      // On success, drop straight into the focused player for this artifact.
      if (data.tool_type === "summary") {
        setPlayer({ kind: "summary", title: `Summary — ${baseName}`, text: (data.output_content?.text as string) ?? "" });
      } else if (data.tool_type === "flashcards") {
        setPlayer({ kind: "flashcards", title: `Flashcards — ${baseName}`, cards: (data.output_content?.cards as Flashcard[]) ?? [] });
      } else if (data.tool_type === "mind_map") {
        setPlayer({ kind: "mind_map", title: `Mind map — ${baseName}`, mindMap: (data.output_content as MindMap) ?? { title: baseName, branches: [] } });
      } else {
        setPlayer({ kind: "quiz", title: `Quiz — ${baseName}`, questions: (data.output_content?.questions as QuizQuestion[]) ?? [] });
      }
      setStatusMsg("Done ✓");
    } catch {
      setError("Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadUpload(path: string | null) {
    if (!path) return;
    const res = await fetch("/api/files/signed-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  // Re-open a saved generation into its focused player.
  function openOutput(o: Output) {
    const c = o.output_content as Record<string, unknown> | null;
    if (o.tool_type === "summary") {
      setPlayer({ kind: "summary", title: "Summary", text: (c?.text as string) ?? "" });
    } else if (o.tool_type === "quiz") {
      setPlayer({ kind: "quiz", title: "Quiz", questions: (c?.questions as QuizQuestion[]) ?? [] });
    } else if (o.tool_type === "flashcards") {
      setPlayer({ kind: "flashcards", title: "Flashcards", cards: (c?.cards as Flashcard[]) ?? [] });
    } else if (o.tool_type === "mind_map") {
      setPlayer({ kind: "mind_map", title: "Mind map", mindMap: (o.output_content as MindMap) ?? { title: "Mind map", branches: [] } });
    }
  }

  function openSelfTest(id: string) {
    // Self-tests live in the sibling Self-test section; ask it to open + scroll.
    document.getElementById("self-test")?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("bluestift:open-selftest", { detail: { id } }));
  }

  const toolIcon: Record<string, React.ReactNode> = {
    summary: <IconSummary size={18} />,
    quiz: <IconQuiz size={18} />,
    flashcards: <IconFlashcards size={18} />,
  };

  const closePlayer = () => setPlayer(null);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: display, marginBottom: 4, color: t.text }}>
        Tools Studio
      </div>
      <div style={{ fontSize: 12.5, color: t.muted, marginBottom: 24 }}>
        Generate quizzes, summaries and flashcards from any lesson — then study them one at a time.
      </div>

      {/* tool picker */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, maxWidth: 900 }}>
        {TOOLS.filter((x) => x.ready).map((x) => {
          const on = tool === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTool(x.id)}
              style={{
                textAlign: "left",
                background: t.cardBg2,
                border: `1px solid ${on ? statusColors.aiIndigo : t.cardBorder}`,
                boxShadow: on ? `0 0 0 1px ${statusColors.aiIndigo}` : "none",
                borderRadius: 16,
                padding: 16,
                cursor: "pointer",
                color: t.text,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 11, background: t.ctaBg, color: t.ctaText, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                {toolIcon[x.id] ?? <IconSummary size={18} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{x.label}</div>
            </button>
          );
        })}
      </div>

      {/* dropzone */}
      <label
        style={{
          display: "block",
          marginTop: 16,
          border: `1px dashed ${t.cardBorder}`,
          borderRadius: 18,
          padding: 22,
          maxWidth: 900,
          textAlign: "center",
          color: t.mutedLight,
          fontSize: 12,
          cursor: busy ? "default" : "pointer",
          background: t.cardBg2,
        }}
      >
        {fileName ? (
          <span style={{ color: t.text, fontWeight: 600 }}>{fileName}</span>
        ) : (
          "Drop a PDF, a photo of your notes or a document (text, Word, Excel, audio) to generate a tool"
        )}
        <input
          type="file"
          accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          disabled={busy}
          style={{ display: "none" }}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, maxWidth: 900 }}>
        <button style={{ ...cta(t), opacity: busy || !sourceText ? 0.5 : 1 }} onClick={generate} disabled={busy || !sourceText}>
          Generate
        </button>
        {statusMsg && <span style={{ fontSize: 12, color: t.muted }}>{statusMsg}</span>}
      </div>
      {error && <p style={{ color: "#f87171", marginTop: 12, fontSize: 12.5 }}>{error}</p>}

      {(uploads.length > 0 || outputs.length > 0 || selfTests.length > 0) && (
        <div style={{ ...panel(t), maxWidth: 900 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700, color: t.text }}>Your library</h3>
          {uploads.length > 0 && (
            <>
              <div style={sectionLabel(t)}>Files</div>
              {uploads.map((u) => (
                <LibraryRow key={u.id} theme={t} label={u.title ?? "file"} meta={u.type ?? undefined} action="Open" onAction={() => downloadUpload(u.url)} />
              ))}
            </>
          )}
          {outputs.length > 0 && (
            <>
              <div style={{ ...sectionLabel(t), marginTop: 12 }}>Generated</div>
              {outputs.map((o) => (
                <LibraryRow
                  key={o.id}
                  theme={t}
                  label={o.tool_type}
                  meta={o.status}
                  action="Study"
                  disabled={o.status !== "done"}
                  onAction={() => openOutput(o)}
                />
              ))}
            </>
          )}
          {selfTests.length > 0 && (
            <>
              <div style={{ ...sectionLabel(t), marginTop: 12 }}>Self-tests</div>
              {selfTests.map((s) => (
                <LibraryRow
                  key={s.id}
                  theme={t}
                  label={s.title ?? "Self-test"}
                  meta={s.score != null ? `${Math.round(s.score * 100)}%` : undefined}
                  action="Study"
                  onAction={() => openSelfTest(s.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Focused, one-at-a-time study players ── */}
      {player?.kind === "quiz" && (
        <QuizPlayer
          title={player.title}
          mode="reveal"
          questions={player.questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctIndex: q.correct_index,
            explanation: q.explanation,
          }))}
          onExit={closePlayer}
          actions={downloadActions(doc(player.title, quizToMd(player.questions)))}
        />
      )}
      {player?.kind === "flashcards" && (
        <FlashcardsPlayer
          title={player.title}
          cards={player.cards}
          onExit={closePlayer}
          actions={downloadActions(doc(player.title, flashcardsToMd(player.cards)))}
        />
      )}
      {player?.kind === "summary" && (
        <ReaderView
          title={player.title}
          subtitle="Summary"
          blocks={parseDoc(player.text)}
          onExit={closePlayer}
          actions={downloadActions(doc(player.title, player.text))}
        />
      )}
      {player?.kind === "mind_map" && (
        <MindMapView
          title={player.title}
          mindMap={player.mindMap}
          onExit={closePlayer}
          actions={downloadActions(doc(player.title, mindMapToMd(player.mindMap)))}
        />
      )}
    </div>
  );
}

function LibraryRow({
  theme: t,
  label,
  meta,
  action,
  disabled,
  onAction,
}: {
  theme: AppTheme;
  label: string;
  meta?: string;
  action: string;
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${t.cardBorder}` }}>
      <span style={{ flex: 1, fontSize: 12.5, color: t.text }}>{label}</span>
      {meta && <span style={{ color: t.mutedLight, fontSize: 11 }}>{meta}</span>}
      <button style={{ ...ghost(t), opacity: disabled ? 0.4 : 1 }} onClick={onAction} disabled={disabled}>
        {action}
      </button>
    </div>
  );
}
