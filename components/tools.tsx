"use client";

import { useState } from "react";
import { downloadBrandedPdf, downloadBrandedText, type BrandedDoc } from "@/lib/document";
import { parseDoc } from "@/lib/doc-format";
import { QuizPlayer, FlashcardsPlayer, ReaderView, MindMapView } from "@/components/study/focus-player";
import { ShareLinkButton } from "@/components/study/share-button";
import { useAppTheme } from "@/components/ui/theme";
import { display, status as statusColors, type AppTheme } from "@/components/ui/tokens";
import { IconQuiz, IconFlashcards, IconSummary } from "@/components/ui/icons";
import { ghostButton } from "@/components/ui/forms";
import { FilePicker } from "@/components/ui/file-picker";

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

/** A picked source doc: a fresh upload or a reused library doc. */
type Source = { mediaId: string | null; name: string; kind?: string; bytes?: number; text?: string };

/** Max total size of an upload packet (all files picked at once + already added). */
const MAX_PACKET_BYTES = 20 * 1024 * 1024;

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
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
const ghost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)"}`,
  borderRadius: 99,
  padding: "6px 13px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
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
  // A source is a picked doc — a fresh upload (has `bytes`, maybe inline `text`
  // if it couldn't be stored) or an existing library doc reused (mediaId only).
  const [sources, setSources] = useState<Source[]>([]);
  const [tool, setTool] = useState("summary");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<ActivePlayer | null>(null);
  /** Files are being dragged over the dropzone — highlights it. */
  const [dragging, setDragging] = useState(false);

  const baseName = (sources[0]?.name ?? "raya").replace(/\.[^.]+$/, "");
  const packetBytes = sources.reduce((s, x) => s + (x.bytes ?? 0), 0);

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
      <ShareLinkButton theme={t} doc={d} />
    </>
  );

  // Add one library doc as a reusable source (no re-upload).
  function reuseFromLibrary(u: Upload) {
    setError(null);
    setSources((s) => (s.some((x) => x.mediaId === u.id) ? s : [...s, { mediaId: u.id, name: u.title ?? "file" }]));
  }
  function removeSource(i: number) {
    setSources((s) => s.filter((_, k) => k !== i));
  }

  // Multi-file upload: extract each into the packet (capped total size).
  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const arr = Array.from(files);
    const addBytes = arr.reduce((s, f) => s + f.size, 0);
    if (packetBytes + addBytes > MAX_PACKET_BYTES) {
      setError(`That packet is too large — keep the total under ${Math.round(MAX_PACKET_BYTES / 1024 / 1024)} MB.`);
      return;
    }
    setBusy(true);
    try {
      for (const f of arr) {
        setStatusMsg(`Reading ${f.name}… (audio is transcribed, this can take a moment)`);
        try {
          const fd = new FormData();
          fd.append("file", f);
          const res = await fetch("/api/tools/extract", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) {
            setError(data?.error ?? `Couldn't read ${f.name}.`);
            continue;
          }
          setSources((s) => [
            ...s,
            { mediaId: data.media_id ?? null, name: f.name, kind: data.kind, bytes: f.size, text: data.media_id ? undefined : (data.text ?? "") },
          ]);
        } catch {
          setError(`Couldn't process ${f.name}.`);
        }
      }
      setStatusMsg("Ready ✓");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (sources.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setStatusMsg("Generating…");
    try {
      const sourceMediaIds = sources.map((s) => s.mediaId).filter((id): id is string => !!id);
      const inline = sources.filter((s) => !s.mediaId && s.text).map((s) => s.text as string).join("\n\n");
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool_type: tool,
          source_media_ids: sourceMediaIds,
          source_text: inline || undefined,
          title: baseName,
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
      <div style={{ fontSize: 23, fontWeight: 800, fontFamily: display, marginBottom: 4, color: t.text }}>
        Tools Studio
      </div>
      <div style={{ fontSize: 15, color: t.muted, marginBottom: 24 }}>
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
              <div style={{ fontSize: 15, fontWeight: 700 }}>{x.label}</div>
            </button>
          );
        })}
      </div>

      {/* Dropzone — multi-file.
          It used to be a <label> that said "Drop one or more files" and had no
          drop handler at all: the only thing it accepted was a click, so the
          sentence was an instruction the zone could not honour. Now it takes an
          actual drop, and the click affordance is a real focusable button
          instead of a label (which no keyboard could reach). */}
      <div
        onDragOver={(e) => {
          // Without preventDefault the browser keeps its default "open this
          // file in a tab" behaviour and no drop event ever fires.
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void onPick(e.dataTransfer.files);
        }}
        style={{
          marginTop: 16,
          border: `1px dashed ${dragging ? statusColors.aiIndigo : t.cardBorder}`,
          borderRadius: 18,
          padding: 22,
          maxWidth: 900,
          textAlign: "center",
          color: t.mutedLight,
          fontSize: 14,
          background: dragging ? t.cardBg : t.cardBg2,
          transition: "border-color 0.15s ease, background 0.15s ease",
        }}
      >
        Drop one or more files (PDF, notes, Word, Excel, audio) — they combine into one packet
        <div style={{ fontSize: 13, color: t.mutedLight, marginTop: 4 }}>
          Up to {Math.round(MAX_PACKET_BYTES / 1024 / 1024)} MB total{packetBytes > 0 ? ` · ${(packetBytes / 1024 / 1024).toFixed(1)} MB used` : ""}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <FilePicker
            multiple
            accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain"
            onPick={onPick}
            disabled={busy}
            // The packet is cumulative, so the same file may be added, removed
            // and added again.
            resetAfterPick
            buttonStyle={ghostButton(t)}
          />
        </div>
      </div>

      {/* picked sources */}
      {sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, maxWidth: 900 }}>
          {sources.map((s, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 99,
                padding: "5px 6px 5px 12px",
                fontSize: 14,
                color: t.text,
              }}
            >
              <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.mediaId && s.bytes == null ? "↻ " : ""}
                {s.name}
              </span>
              <button
                onClick={() => removeSource(i)}
                title="Remove"
                style={{ background: t.cardBg2, border: `1px solid ${t.cardBorder}`, color: t.mutedLight, borderRadius: "50%", width: 20, height: 20, cursor: "pointer", lineHeight: 1, fontSize: 14 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, maxWidth: 900 }}>
        <button style={{ ...cta(t), opacity: busy || sources.length === 0 ? 0.5 : 1 }} onClick={generate} disabled={busy || sources.length === 0}>
          Generate
        </button>
        {statusMsg && <span style={{ fontSize: 14, color: t.muted }}>{statusMsg}</span>}
      </div>
      {error && <p style={{ color: "#f87171", marginTop: 12, fontSize: 15 }}>{error}</p>}

      {(uploads.length > 0 || outputs.length > 0 || selfTests.length > 0) && (
        <div style={{ marginTop: 20, maxWidth: 900, display: "flex", flexDirection: "column", gap: 14 }}>
          {uploads.length > 0 && (
            <div style={panel(t)}>
              <LibraryHeader theme={t} title="Your files" count={uploads.length} hint="Reuse any of these as a source — no re-upload." />
              {uploads.map((u) => {
                const inUse = sources.some((s) => s.mediaId === u.id);
                return (
                  <LibraryRow
                    key={u.id}
                    theme={t}
                    label={u.title ?? "file"}
                    meta={u.type ?? undefined}
                    action={inUse ? "Added" : "Use"}
                    disabled={inUse}
                    onAction={() => reuseFromLibrary(u)}
                    action2="Open"
                    onAction2={() => downloadUpload(u.url)}
                  />
                );
              })}
            </div>
          )}
          {outputs.length > 0 && (
            <div style={panel(t)}>
              <LibraryHeader theme={t} title="Generated" count={outputs.length} hint="Quizzes, summaries, flashcards and mind maps you've made." />
              {outputs.map((o) => (
                <LibraryRow
                  key={o.id}
                  theme={t}
                  label={prettyTool(o.tool_type)}
                  meta={o.status === "done" ? new Date(o.created_at).toLocaleDateString() : o.status}
                  action="Study"
                  disabled={o.status !== "done"}
                  onAction={() => openOutput(o)}
                />
              ))}
            </div>
          )}
          {selfTests.length > 0 && (
            <div style={panel(t)}>
              <LibraryHeader theme={t} title="Self-tests" count={selfTests.length} hint="Your tests and their scores." />
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
            </div>
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

const PRETTY_TOOL: Record<string, string> = {
  summary: "Summary",
  quiz: "Quiz",
  flashcards: "Flashcards",
  mind_map: "Mind map",
};
const prettyTool = (id: string) => PRETTY_TOOL[id] ?? id;

function LibraryHeader({ theme: t, title, count, hint }: { theme: AppTheme; title: string; count: number; hint: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>{title}</h3>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.mutedLight }}>{count}</span>
      </div>
      <div style={{ fontSize: 13, color: t.mutedLight, marginTop: 2 }}>{hint}</div>
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
  action2,
  onAction2,
}: {
  theme: AppTheme;
  label: string;
  meta?: string;
  action: string;
  disabled?: boolean;
  onAction: () => void;
  action2?: string;
  onAction2?: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${t.cardBorder}` }}>
      <span style={{ flex: 1, fontSize: 15, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {meta && <span style={{ color: t.mutedLight, fontSize: 13, flex: "none" }}>{meta}</span>}
      {action2 && onAction2 && (
        <button style={ghost(t)} onClick={onAction2}>
          {action2}
        </button>
      )}
      <button style={{ ...ghost(t), opacity: disabled ? 0.4 : 1 }} onClick={onAction} disabled={disabled}>
        {action}
      </button>
    </div>
  );
}
