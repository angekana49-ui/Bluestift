"use client";

import { useEffect, useState } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { ToolPlayer, playerFor, type ActivePlayer, type Flashcard, type MindMap, type QuizQuestion } from "@/components/study/tool-player";
import { ArtifactMenu } from "@/components/ui/artifact-menu";
import { ArchivedDisclosure } from "@/components/ui/archived-section";
import { useAppTheme } from "@/components/ui/theme";
import { status as statusColors, type AppTheme } from "@/components/ui/tokens";
import { IconQuiz, IconFlashcards, IconSummary, IconMindMap } from "@/components/ui/icons";
import { neutralButton, formActions } from "@/components/ui/forms";
import { useMathsDock } from "@/components/raya/maths-dock-context";
import type { MathBlockLang } from "@/lib/math-blocks";
import { SectionHeader } from "@/components/raya/section-header";
import { FilePicker } from "@/components/ui/file-picker";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

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
  archived_at?: string | null;
};
type SelfTest = { id: string; title: string | null; score: number | null };

/** A picked source doc: a fresh upload or a reused library doc. */
type Source = { mediaId: string | null; name: string; kind?: string; bytes?: number; text?: string };

/** Max total size of an upload packet (all files picked at once + already added). */
const MAX_PACKET_BYTES = 20 * 1024 * 1024;

const TOOLS: { id: string; labelKey: MessageKey; descKey: MessageKey; ready: boolean }[] = [
  { id: "summary", labelKey: "tools.tool.summary", descKey: "tools.desc.summary", ready: true },
  { id: "quiz", labelKey: "tools.tool.quiz", descKey: "tools.desc.quiz", ready: true },
  { id: "flashcards", labelKey: "tools.tool.flashcards", descKey: "tools.desc.flashcards", ready: true },
  { id: "mind_map", labelKey: "tools.tool.mindMap", descKey: "tools.desc.mindMap", ready: true },
];

/** One icon per tool — the mind map used to borrow the summary's. */
const TOOL_ICON: Record<string, (p: { size?: number }) => React.ReactNode> = {
  summary: IconSummary,
  quiz: IconQuiz,
  flashcards: IconFlashcards,
  mind_map: IconMindMap,
};

/**
 * The calculator and the graph, as entries on the page. They open in the Maths
 * panel beside it (components/raya/maths-dock.tsx) — the rail along the right
 * edge was their only door, two unlabelled glyphs a learner had to find.
 */
const MATHS: { lang: MathBlockLang; glyph: string; tint: string; labelKey: MessageKey; descKey: MessageKey }[] = [
  { lang: "calc", glyph: "=", tint: "#2f6fde", labelKey: "math.calc", descKey: "tools.maths.calcDesc" },
  { lang: "graph", glyph: "ƒ", tint: "#2a9d55", labelKey: "math.graph", descKey: "tools.maths.graphDesc" },
];

// Themed style helpers.
const panel = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 18,
  padding: "16px 20px",
});
/** The creation card: the page's one primary surface. */
const studio = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 20,
  padding: 20,
});
const cta = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
});
const ghost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)"}`,
  borderRadius: 99,
  padding: "6px 13px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
});
/** Each tool's display name. */
const PRETTY: Record<string, MessageKey> = {
  summary: "tools.pretty.summary",
  quiz: "tools.pretty.quiz",
  flashcards: "tools.pretty.flashcards",
  mind_map: "tools.pretty.mindMap",
};

/** One of the learner's conversations with Raya, offered as a source. */
type ConversationRef = { id: string; title: string | null; updated_at: string };

/**
 * Where the material comes from. A file is the classic case; a topic (built
 * from its Wikipedia article) and a past conversation with Raya mean a quiz,
 * a summary or a mind map no longer needs a document to exist first.
 */
type SourceMode = "file" | "topic" | "conversation";

export function Tools({
  uploads,
  outputs,
  selfTests,
  conversations = [],
  studentName,
}: {
  uploads: Upload[];
  outputs: Output[];
  selfTests: SelfTest[];
  conversations?: ConversationRef[];
  studentName?: string;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const dock = useMathsDock();
  const [mode, setMode] = useState<SourceMode>("file");
  const [topic, setTopic] = useState("");
  const [conversationId, setConversationId] = useState(conversations[0]?.id ?? "");
  /** The Wikipedia page the last generation was built from (or that none was found). */
  const [reference, setReference] = useState<{ title: string; url: string } | "none" | null>(null);
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
  // Local copy of the generated-outputs library so archive/delete can update
  // the list in place without a refetch.
  const [outputItems, setOutputItems] = useState<Output[]>(outputs);

  async function archiveOutput(id: string, archived: boolean) {
    const res = await netFetch("/api/tools/outputs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: archived ? "archive" : "unarchive" }),
    });
    const d = await res.json();
    // ArtifactMenu keeps its confirm dialog open and shows this rather than
    // silently doing nothing when the server refuses the action.
    if (!res.ok) throw new Error(d?.error);
    setOutputItems((v) => v.map((o) => (o.id === id ? { ...o, archived_at: d.archived_at ?? null } : o)));
  }

  async function deleteOutput(id: string) {
    const res = await netFetch(`/api/tools/outputs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error);
    }
    setOutputItems((v) => v.filter((o) => o.id !== id));
  }

  const conversationTitle = (id: string) => conversations.find((c) => c.id === id)?.title || tr("tools.conversation.untitled");
  const baseName =
    mode === "topic" && topic.trim()
      ? topic.trim().slice(0, 60)
      : mode === "conversation" && conversationId
        ? conversationTitle(conversationId)
        : (sources[0]?.name ?? "raya").replace(/\.[^.]+$/, "");
  const ready = mode === "file" ? sources.length > 0 : mode === "topic" ? topic.trim().length >= 2 : Boolean(conversationId);
  const packetBytes = sources.reduce((s, x) => s + (x.bytes ?? 0), 0);

  // `/tools?open=<id>` — the "Open in Tools" link of a card in a Raya
  // conversation lands on the tool it created, already open. Once, then the
  // parameter is stripped so a reload doesn't reopen it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("open");
    if (!id) return;
    url.searchParams.delete("open");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const o = outputs.find((x) => x.id === id && x.status === "done");
    if (o) setPlayer(playerFor(o.tool_type, o.id, o.output_content, tr(PRETTY[o.tool_type] ?? "tools.pretty.quiz")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError(`${tr("tools.packetTooLargeA")} ${Math.round(MAX_PACKET_BYTES / 1024 / 1024)} ${tr("tools.packetTooLargeB")}`);
      return;
    }
    setBusy(true);
    try {
      for (const f of arr) {
        setStatusMsg(`${tr("tools.readingFilePrefix")} ${f.name}${tr("tools.readingFileSuffix")}`);
        try {
          const fd = new FormData();
          fd.append("file", f);
          // Audio/PDF go through server-side extraction (maxDuration 60s) — a
          // bare fetch never times out, but the default 10s would abort a
          // legitimately-running transcription.
          const res = await netFetch("/api/tools/extract", { method: "POST", body: fd }, { timeoutMs: 65_000 });
          const data = await res.json();
          if (!res.ok) {
            setError(data?.error ?? `${tr("tools.couldntReadPrefix")} ${f.name}.`);
            continue;
          }
          setSources((s) => [
            ...s,
            { mediaId: data.media_id ?? null, name: f.name, kind: data.kind, bytes: f.size, text: data.media_id ? undefined : (data.text ?? "") },
          ]);
        } catch {
          setError(`${tr("tools.couldntProcessPrefix")} ${f.name}.`);
        }
      }
      setStatusMsg(tr("tools.ready"));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setReference(null);
    setStatusMsg(tr("tools.generating"));
    try {
      const sourceMediaIds = sources.map((s) => s.mediaId).filter((id): id is string => !!id);
      const inline = sources.filter((s) => !s.mediaId && s.text).map((s) => s.text as string).join("\n\n");
      // Only the chosen source is sent: a file picked earlier must not slip
      // into a quiz the learner asked to build from a topic.
      const source =
        mode === "file"
          ? { source_media_ids: sourceMediaIds, source_text: inline || undefined }
          : mode === "topic"
            ? { topic: topic.trim() }
            : { conversation_id: conversationId };
      // LLM-generated output (quiz/flashcards/summary), non-streamed.
      const res = await netFetch(
        "/api/tools/generate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tool_type: tool, ...source, title: baseName }),
        },
        { timeoutMs: 65_000 },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `${tr("tools.requestFailedPrefix")} (${res.status}).`);
        return;
      }
      if (mode === "topic") setReference(data.reference ?? (data.topic_only ? "none" : null));
      // On success, drop straight into the focused player for this artifact.
      if (data.tool_type === "summary") {
        setPlayer({ kind: "summary", title: `${tr("tools.pretty.summary")} — ${baseName}`, text: (data.output_content?.text as string) ?? "" });
      } else if (data.tool_type === "flashcards") {
        setPlayer({ kind: "flashcards", title: `${tr("tools.pretty.flashcards")} — ${baseName}`, cards: (data.output_content?.cards as Flashcard[]) ?? [] });
      } else if (data.tool_type === "mind_map") {
        setPlayer({ kind: "mind_map", title: `${tr("tools.pretty.mindMap")} — ${baseName}`, mindMap: (data.output_content as MindMap) ?? { title: baseName, branches: [] } });
      } else {
        setPlayer({ kind: "quiz", title: `${tr("tools.pretty.quiz")} — ${baseName}`, questions: (data.output_content?.questions as QuizQuestion[]) ?? [], outputId: typeof data.id === "string" ? data.id : undefined });
      }
      setStatusMsg(tr("tools.done"));
    } catch {
      setError(tr("tools.generationFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function downloadUpload(path: string | null) {
    if (!path) return;
    const res = await netFetch(
      "/api/files/signed-url",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      },
      { timeoutMs: 15_000 },
    );
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  /** "Quiz — Les dérivées": the tool, and what it is about when that was kept. */
  const outputTitle = (o: Output) => {
    const name = PRETTY_TOOL_KEY[o.tool_type] ? tr(PRETTY_TOOL_KEY[o.tool_type]) : o.tool_type;
    const about = outputSubject(o.output_content);
    return about ? `${name} — ${about}` : name;
  };

  // Re-open a saved generation into its focused player.
  function openOutput(o: Output) {
    const c = o.output_content as Record<string, unknown> | null;
    const title = outputTitle(o);
    if (o.tool_type === "summary") {
      setPlayer({ kind: "summary", title, text: (c?.text as string) ?? "" });
    } else if (o.tool_type === "quiz") {
      setPlayer({ kind: "quiz", title, questions: (c?.questions as QuizQuestion[]) ?? [], outputId: o.id });
    } else if (o.tool_type === "flashcards") {
      setPlayer({ kind: "flashcards", title, cards: (c?.cards as Flashcard[]) ?? [] });
    } else if (o.tool_type === "mind_map") {
      setPlayer({ kind: "mind_map", title, mindMap: (o.output_content as MindMap) ?? { title, branches: [] } });
    }
  }

  function openSelfTest(id: string) {
    // Self-tests live in the sibling Self-test section; ask it to open + scroll.
    document.getElementById("self-test")?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("bluestift:open-selftest", { detail: { id } }));
  }

  const closePlayer = () => setPlayer(null);

  return (
    <div>
      {/* Was the same 23/800/display + 15/muted pair copied inline, at a
          different margin and without the brand wrapper — so the one page that
          rolled its own header was also the one whose header sat 4px off from
          /rooms, /profile and /account, and the only one where "Raya" in a
          subtitle could be machine-translated. */}
      <SectionHeader
        title="Tools Studio"
        subtitle={tr("tools.pageSubtitle")}
      />

      {/* ── Create: one card, two questions — what, and from what ── */}
      <section style={studio(t)}>
        <StepTitle n={1} theme={t}>
          {tr("tools.step.tool")}
        </StepTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 10 }}>
          {TOOLS.filter((x) => x.ready).map((x) => {
            const on = tool === x.id;
            const Icon = TOOL_ICON[x.id] ?? IconSummary;
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTool(x.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  background: on ? t.cardBg : t.cardBg2,
                  border: `1px solid ${on ? statusColors.aiIndigo : t.cardBorder}`,
                  boxShadow: on ? `0 0 0 1px ${statusColors.aiIndigo}` : "none",
                  borderRadius: 14,
                  padding: "12px 14px",
                  cursor: "pointer",
                  color: t.text,
                  fontFamily: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flex: "none",
                    background: on ? t.ctaBg : t.cardBg,
                    color: on ? t.ctaText : t.text,
                    border: `1px solid ${on ? "transparent" : t.cardBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={19} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{tr(x.labelKey)}</span>
                  <span style={{ display: "block", fontSize: 14, color: t.muted, marginTop: 1 }}>{tr(x.descKey)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <StepTitle n={2} theme={t} style={{ marginTop: 22 }}>
          {tr("tools.step.source")}
        </StepTitle>
        {/* Where the material comes from — one choice of three, so a segmented
            control: three identical black pills read as three actions. */}
        <Segmented
          theme={t}
          label={tr("tools.source.label")}
          value={mode}
          options={(["file", "topic", "conversation"] as SourceMode[]).map((m) => ({ value: m, label: tr(`tools.source.${m}`) }))}
          onChange={(m) => {
            setMode(m);
            setError(null);
            setReference(null);
          }}
        />

      {mode === "topic" && (
        <div style={{ marginTop: 12 }}>
          <input
            value={topic}
            maxLength={120}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void generate();
            }}
            placeholder={tr("tools.topic.placeholder")}
            aria-label={tr("tools.source.topic")}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: 16,
              background: t.inputBg,
              color: t.text,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
          <p style={{ margin: "8px 0 0", fontSize: 14, color: t.muted }}>{tr("tools.topic.hint")}</p>
        </div>
      )}

      {mode === "conversation" && (
        <div style={{ marginTop: 12 }}>
          {conversations.length === 0 ? (
            <p style={{ margin: 0, fontSize: 15, color: t.muted }}>{tr("tools.conversation.none")}</p>
          ) : (
            <>
              <select
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                aria-label={tr("tools.conversation.pick")}
                style={{
                  width: "100%",
                  fontSize: 16,
                  background: t.inputBg,
                  color: t.text,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || tr("tools.conversation.untitled")} · {new Date(c.updated_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: t.muted }}>{tr("tools.conversation.hint")}</p>
            </>
          )}
        </div>
      )}

      {mode === "file" && (
      <>
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
          marginTop: 12,
          border: `1px dashed ${dragging ? statusColors.aiIndigo : t.cardBorder}`,
          borderRadius: 18,
          padding: 22,
          textAlign: "center",
          color: t.mutedLight,
          fontSize: 15,
          background: dragging ? t.cardBg : t.contentBg,
          transition: "border-color 0.15s ease, background 0.15s ease",
        }}
      >
        {tr("tools.dropzone")}
        <div style={{ fontSize: 14, color: t.mutedLight, marginTop: 4 }}>
          {tr("tools.upTo")} {Math.round(MAX_PACKET_BYTES / 1024 / 1024)} {tr("tools.mbTotal")}
          {packetBytes > 0 ? ` · ${(packetBytes / 1024 / 1024).toFixed(1)} ${tr("tools.mbUsed")}` : ""}
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
            buttonStyle={neutralButton(t)}
          />
        </div>
      </div>

      {/* picked sources */}
      {sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
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
                fontSize: 15,
                color: t.text,
              }}
            >
              <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.mediaId && s.bytes == null ? "↻ " : ""}
                {s.name}
              </span>
              <button
                onClick={() => removeSource(i)}
                title={tr("tools.remove")}
                style={{ background: t.cardBg2, border: `1px solid ${t.cardBorder}`, color: t.mutedLight, borderRadius: "50%", width: 20, height: 20, cursor: "pointer", lineHeight: 1, fontSize: 15 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      </>
      )}

      <div style={{ ...formActions, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.cardBorder}` }}>
        {statusMsg && <span style={{ fontSize: 15, color: t.muted, marginRight: "auto" }}>{statusMsg}</span>}
        <button style={{ ...cta(t), padding: "10px 22px", opacity: busy || !ready ? 0.5 : 1 }} onClick={generate} disabled={busy || !ready}>
          {tr("tools.generate")}
        </button>
      </div>
      {/* Built from a topic: say from what, so it can be checked. */}
      {reference && (
        <p style={{ marginTop: 8, fontSize: 14, color: t.muted }}>
          {reference === "none" ? (
            tr("tools.noReference")
          ) : (
            <>
              {tr("tools.reference")}{" "}
              <a href={reference.url} target="_blank" rel="noopener noreferrer" style={{ color: t.link }}>
                {reference.title}
              </a>
            </>
          )}
        </p>
      )}
      {error && <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: 16 }}>{error}</p>}
      </section>

      {/* ── Maths: the calculator and the graph, opened in the panel beside the page ── */}
      {dock && (
        <section style={{ marginTop: 28 }}>
          <SectionTitle theme={t} title={tr("tools.maths.title")} hint={tr("tools.maths.hint")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 10 }}>
            {MATHS.map((m) => (
              <button
                key={m.lang}
                type="button"
                onClick={() => dock.open(m.lang)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textAlign: "left",
                  background: t.cardBg,
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: 16,
                  padding: "14px 16px",
                  cursor: "pointer",
                  color: t.text,
                  fontFamily: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 44,
                    height: 44,
                    flex: "none",
                    borderRadius: 12,
                    background: m.tint,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                    fontSize: 22,
                  }}
                >
                  {m.glyph}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{tr(m.labelKey)}</span>
                  <span style={{ display: "block", fontSize: 14, color: t.muted, marginTop: 1 }}>{tr(m.descKey)}</span>
                </span>
                <span aria-hidden style={{ color: t.mutedLight, fontSize: 18, flex: "none" }}>
                  →
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {(uploads.length > 0 || outputItems.length > 0 || selfTests.length > 0) && (
        <section style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionTitle theme={t} title={tr("tools.library")} />
          {uploads.length > 0 && (
            <div style={panel(t)}>
              <LibraryHeader theme={t} title={tr("tools.yourFiles")} count={uploads.length} hint={tr("tools.yourFilesHint")} />
              {uploads.map((u) => {
                const inUse = sources.some((s) => s.mediaId === u.id);
                return (
                  <LibraryRow
                    key={u.id}
                    theme={t}
                    label={u.title ?? tr("tools.fileFallback")}
                    meta={u.type ?? undefined}
                    action={inUse ? tr("tools.added") : tr("tools.use")}
                    disabled={inUse}
                    onAction={() => reuseFromLibrary(u)}
                    action2={tr("tools.open")}
                    onAction2={() => downloadUpload(u.url)}
                  />
                );
              })}
            </div>
          )}
          {outputItems.length > 0 && (() => {
            const liveOutputs = outputItems.filter((o) => !o.archived_at);
            const archivedOutputs = outputItems.filter((o) => !!o.archived_at);
            const row = (o: Output) => {
              const label = outputTitle(o);
              const archived = !!o.archived_at;
              const Icon = TOOL_ICON[o.tool_type] ?? IconSummary;
              return (
                <LibraryRow
                  key={o.id}
                  theme={t}
                  icon={<Icon size={17} />}
                  label={label}
                  meta={o.status === "done" ? new Date(o.created_at).toLocaleDateString() : o.status}
                  dimmed={archived}
                  action={tr("tools.study")}
                  disabled={o.status !== "done"}
                  onAction={() => openOutput(o)}
                  menu={
                    <ArtifactMenu
                      theme={t}
                      itemLabel={label}
                      archived={archived}
                      deleteCaveatKey="artifact.delete.caveat.toolOutput"
                      onArchive={(next) => archiveOutput(o.id, next)}
                      onDelete={() => deleteOutput(o.id)}
                    />
                  }
                />
              );
            };
            return (
              <div style={panel(t)}>
                <LibraryHeader theme={t} title={tr("tools.generated")} count={liveOutputs.length} hint={tr("tools.generatedHint")} />
                {liveOutputs.map(row)}
                <ArchivedDisclosure theme={t} count={archivedOutputs.length}>
                  {archivedOutputs.map(row)}
                </ArchivedDisclosure>
              </div>
            );
          })()}
          {selfTests.length > 0 && (
            <div style={panel(t)}>
              <LibraryHeader theme={t} title={tr("tools.selfTests")} count={selfTests.length} hint={tr("tools.selfTestsHint")} />
              {selfTests.map((s) => (
                <LibraryRow
                  key={s.id}
                  theme={t}
                  label={s.title ?? tr("tools.selfTest.fallbackTitle")}
                  meta={s.score != null ? `${Math.round(s.score * 100)}%` : undefined}
                  action={tr("tools.study")}
                  onAction={() => openSelfTest(s.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Focused, one-at-a-time study player (shared with the chat's "Create in Tools" card) ── */}
      {player && <ToolPlayer player={player} onExit={closePlayer} studentName={studentName} />}
    </div>
  );
}

const PRETTY_TOOL_KEY: Record<string, MessageKey> = {
  summary: "tools.pretty.summary",
  quiz: "tools.pretty.quiz",
  flashcards: "tools.pretty.flashcards",
  mind_map: "tools.pretty.mindMap",
};

function LibraryHeader({ theme: t, title, count, hint }: { theme: AppTheme; title: string; count: number; hint: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h3>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.mutedLight }}>{count}</span>
      </div>
      <div style={{ fontSize: 14, color: t.mutedLight, marginTop: 2 }}>{hint}</div>
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
  menu,
  dimmed,
  icon,
}: {
  theme: AppTheme;
  /** What kind of thing the row is, before its name. */
  icon?: React.ReactNode;
  label: string;
  meta?: string;
  action: string;
  disabled?: boolean;
  onAction: () => void;
  action2?: string;
  onAction2?: () => void;
  /** Row-level overflow menu (archive/delete) — omitted where the row has none. */
  menu?: React.ReactNode;
  /** Visually files this row away, e.g. once it's archived. */
  dimmed?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${t.cardBorder}`, opacity: dimmed ? 0.62 : 1 }}>
      {icon && (
        <span aria-hidden style={{ color: t.muted, display: "flex", flex: "none" }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {/* The type or the date, and the first thing to go on a phone: it is
          `flex: none` next to two buttons that are also `flex: none`, so on a
          375px row it was taking 92px off the one item that says WHICH file
          this is — "Chapitre 7 — Les fonctions affines.pdf" rendered as
          "Chapit…" beside a perfectly legible "application/pdf". */}
      {meta && <span className="app-row-meta" style={{ color: t.mutedLight, fontSize: 14, flex: "none" }}>{meta}</span>}
      {action2 && onAction2 && (
        <button style={ghost(t)} onClick={onAction2}>
          {action2}
        </button>
      )}
      <button style={{ ...ghost(t), opacity: disabled ? 0.4 : 1 }} onClick={onAction} disabled={disabled}>
        {action}
      </button>
      {menu}
    </div>
  );
}

/** What a stored generation is about: the name it was made under, else its own title or source. */
function outputSubject(content: unknown): string | null {
  const c = (content ?? {}) as Record<string, unknown>;
  if (typeof c.label === "string" && c.label.trim()) return c.label.trim();
  if (typeof c.title === "string" && c.title.trim()) return c.title.trim();
  const ref = c.reference as { title?: unknown } | null | undefined;
  if (ref && typeof ref.title === "string") return ref.title;
  return null;
}

/** A section of the page below the creation card: a heading and, optionally, one line on what it is. */
function SectionTitle({ theme: t, title, hint }: { theme: AppTheme; title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: t.text }}>{title}</h2>
      {hint && <div style={{ fontSize: 15, color: t.muted, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** A numbered question inside the creation card. */
function StepTitle({ n, theme: t, style, children }: { n: number; theme: AppTheme; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: t.text, ...style }}>
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 99,
          flex: "none",
          background: t.cardBg2,
          border: `1px solid ${t.cardBorder}`,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </span>
      {children}
    </h2>
  );
}

/** One choice of a few, as a track with the chosen option raised out of it. */
function Segmented<T extends string>({
  theme: t,
  label,
  value,
  options,
  onChange,
}: {
  theme: AppTheme;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", gap: 2, padding: 4, borderRadius: 99, background: t.pillTrackBg, maxWidth: "100%" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            style={{
              border: `1px solid ${on ? t.controlBorder : "transparent"}`,
              background: on ? t.cardBg : "transparent",
              color: on ? t.text : t.muted,
              borderRadius: 99,
              padding: "7px 16px",
              fontSize: 15,
              fontWeight: on ? 700 : 550,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
