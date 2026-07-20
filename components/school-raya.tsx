"use client";

import { useEffect, useRef, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton } from "@/components/ui/forms";
import type { AppTheme } from "@/components/ui/tokens";

type Msg = { role: "user" | "assistant"; content: string };

/** The teaching context for a prof — used to frame RAYA around their subject(s). */
type TeacherCtx = { name: string; subjects: string[]; schoolName: string };

const mkBubble = (t: AppTheme) => (mine: boolean): React.CSSProperties => ({
  alignSelf: mine ? "flex-end" : "flex-start",
  background: mine ? t.ctaBg : t.bubbleBg,
  color: mine ? t.ctaText : t.text,
  padding: "10px 14px",
  borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
  maxWidth: "85%",
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
  fontSize: 13,
});

const BASE_SUGGESTIONS = [
  "Which class needs the most attention?",
  "Who are the at-risk students right now?",
  "What are my weakest concepts this week?",
];

/** RAYA rosette (the assistant's own mark) — the dashboard itself carries the
 *  Schools/BlueStift logo; here we're inside RAYA for Schools. */
function RayaMark({ size = 30 }: { size?: number }) {
  const { theme: t } = useAppTheme();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={t.dark ? "/raya-mark-violet.png" : "/raya-mark.png"}
      alt="RAYA"
      style={{ width: size, height: size, objectFit: "contain", flex: "none" }}
    />
  );
}

export function SchoolRaya({ fill = false, teacher }: { fill?: boolean; teacher?: TeacherCtx }) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const btn = ctaButton(t);
  const bubble = mkBubble(t);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const subjectLine = teacher && teacher.subjects.length > 0 ? teacher.subjects.join(", ") : null;
  const suggestions = subjectLine
    ? [`How is my ${teacher!.subjects[0]} class doing?`, ...BASE_SUGGESTIONS.slice(1)]
    : BASE_SUGGESTIONS;
  const subtitle = teacher
    ? subjectLine
      ? `Helping you teach ${subjectLine} at ${teacher.schoolName}`
      : `Grounded in your classes at ${teacher.schoolName}`
    : "Ask about your classes and students";

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school/raya", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "" }]);
    } catch {
      setError("Could not reach RAYA.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <RayaMark size={fill ? 34 : 26} />
      <div>
        <div style={{ fontWeight: 700, color: t.text }}>RAYA for Schools</div>
        <div style={{ opacity: 0.6, fontSize: 12, color: t.text }}>{subtitle}</div>
      </div>
    </div>
  );

  const emptyState = (
    <div style={{ color: t.muted, fontSize: 12.5 }}>
      <p style={{ margin: "0 0 8px" }}>Grounded in your school&apos;s real data. Try:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={busy}
            style={{
              background: "transparent",
              border: `1px solid ${t.cardBorder}`,
              color: t.text,
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 11.5,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  const thread = (
    <>
      {messages.length === 0 && emptyState}
      {messages.map((m, i) => (
        <div key={i} style={bubble(m.role === "user")}>
          {m.content}
        </div>
      ))}
      {busy && <div style={{ color: t.mutedLight, fontSize: 12 }}>RAYA is thinking…</div>}
    </>
  );

  const composer = (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        style={{ ...textInput(t), flex: 1, borderRadius: 99 }}
        placeholder="Ask a question about your students…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send(input)}
        disabled={busy}
      />
      <button style={{ ...btn, opacity: busy || !input.trim() ? 0.5 : 1 }} onClick={() => send(input)} disabled={busy || !input.trim()}>
        Send
      </button>
    </div>
  );

  // Full-height conversational surface (teacher dashboard RAYA tab): header pinned
  // top, thread scrolls, composer pinned bottom — a real chat, not a boxed widget.
  if (fill) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${t.cardBorder}` }}>{header}</div>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {thread}
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${t.cardBorder}` }}>
          {composer}
          {error && <p style={{ color: "#f87171", margin: "8px 0 0", fontSize: 12.5 }}>{error}</p>}
        </div>
      </div>
    );
  }

  // Compact card (admin RAYA tab, stacked under directives).
  return (
    <div style={box}>
      <div style={{ marginBottom: "0.75rem" }}>{header}</div>
      <div
        ref={scrollRef}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minHeight: 200, maxHeight: 420, overflow: "auto", marginBottom: "0.85rem" }}
      >
        {thread}
      </div>
      {composer}
      {error && <p style={{ color: "#f87171", margin: "8px 0 0", fontSize: 12.5 }}>{error}</p>}
    </div>
  );
}
