"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/app/rooms/actions";
import { dispatchUpgrade } from "@/lib/upgrade";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";

type Room = {
  id: string;
  name: string;
  subject: string | null;
  visibility: string;
  status: string;
};

// Smart defaults: one-tap subjects so the "New room" form isn't a pair of blank
// boxes. Public visibility is already the sensible default below.
const SUBJECT_SUGGESTIONS = ["Maths", "Physics", "Chemistry", "Biology", "History", "Languages"];

const DOC_ACCEPT = ".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.mp3,.m4a,.wav,.webm,.ogg,.flac,audio/*,application/pdf,text/plain";
const MAX_PACKET_BYTES = 20 * 1024 * 1024; // 20 MB total across the context docs

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RoomsList({
  rooms,
  myRoomIds,
}: {
  rooms: Room[];
  myRoomIds: string[];
}) {
  const { theme: t } = useAppTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  // Optional session timer: 0 = no timer; otherwise 10–60 min. Once it elapses
  // the room turns read-only (members can still read + generate the report).
  const [duration, setDuration] = useState(0);
  // Context documents Raya reads from the first message — so it skips the obvious
  // "what are we studying?" questions. Uploaded to room_files right after create.
  const [docs, setDocs] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addDocs(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setDocs((prev) => {
      const next = [...prev, ...Array.from(list)];
      if (next.reduce((n, f) => n + f.size, 0) > MAX_PACKET_BYTES) {
        setError("Context documents exceed 20 MB in total.");
        return prev;
      }
      return next;
    });
  }

  // Picking a subject also seeds a room name if the user hasn't typed one — one
  // tap and the form is submittable.
  function pickSubject(s: string) {
    const next = subject === s ? "" : s;
    setSubject(next);
    if (next && !name.trim()) setName(`${next} study room`);
  }

  const chip = (on: boolean): React.CSSProperties => ({
    background: on ? t.ctaBg : "transparent",
    color: on ? t.ctaText : t.muted,
    border: `1px solid ${on ? t.ctaBg : t.cardBorder}`,
    borderRadius: 99,
    padding: "6px 12px",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
  });

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createRoom({
        name,
        subject,
        visibility,
        durationMinutes: duration || null,
      });
      if ("error" in result) {
        dispatchUpgrade({ code: result.code, message: result.error });
        setBusy(false);
        return;
      }
      const { roomId } = result;
      // Upload the context documents so Raya has them from the very first turn.
      // Best-effort per file — the room exists regardless of a failed upload.
      for (const f of docs) {
        try {
          const fd = new FormData();
          fd.append("roomId", roomId);
          fd.append("file", f);
          await fetch("/api/rooms/files", { method: "POST", body: fd });
        } catch {
          // skip this doc — don't block entering the room
        }
      }
      router.push(`/rooms/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the room.");
      setBusy(false);
    }
  }

  const mySet = new Set(myRoomIds);
  const mine = rooms.filter((r) => mySet.has(r.id));
  const discover = rooms.filter((r) => !mySet.has(r.id));

  const sectionLabel: React.CSSProperties = {
    fontSize: 10.5,
    color: t.mutedLight,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const roomCard = (r: Room) => (
    <a
      key={r.id}
      href={`/rooms/${r.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: t.cardBg2,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 14,
        padding: "12px 16px",
        marginTop: 8,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: t.text, fontSize: 13 }}>{r.name}</div>
        <div style={{ fontSize: 11, color: t.mutedLight }}>
          {r.subject ?? "—"} · {r.visibility === "public" ? "public" : "private"}
        </div>
      </div>
      <span style={{ color: t.mutedLight }}>→</span>
    </a>
  );

  return (
    <div>
      <div style={panelCard(t)}>
        <h2 style={cardTitle(t)}>New room</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <input style={{ ...textInput(t), flex: 1, minWidth: 180, width: "auto" }} placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={{ ...textInput(t), flex: 1, minWidth: 180, width: "auto" }} placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
          {SUBJECT_SUGGESTIONS.map((s) => (
            <button key={s} type="button" style={chip(subject === s)} onClick={() => pickSubject(s)}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, margin: "10px 0 14px", fontSize: 12 }}>
          {(["public", "private"] as const).map((v) => (
            <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: t.text }}>
              <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
              <span>
                {v === "public" ? "Public" : "Private"}
                <span style={{ color: t.mutedLight, marginLeft: 6 }}>
                  {v === "public" ? "— visible and open to everyone" : "— by invite link"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 14px", fontSize: 12, flexWrap: "wrap" }}>
          <span style={{ color: t.text, fontWeight: 600 }}>⏱ Session length</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ ...textInput(t), width: "auto", padding: "8px 12px", cursor: "pointer" }}
          >
            <option value={0}>No timer</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
          <span style={{ color: t.mutedLight }}>
            {duration ? "Read-only once the time is up." : "Open until closed."}
          </span>
        </div>
        <div style={{ margin: "2px 0 14px" }}>
          <div style={{ fontSize: 12, color: t.text, fontWeight: 600, marginBottom: 4 }}>📎 Context documents (optional)</div>
          <div style={{ fontSize: 11, color: t.mutedLight, marginBottom: 6 }}>
            Raya reads these from the start, so it can skip the obvious questions. Max 20 MB total.
          </div>
          <input
            type="file"
            multiple
            accept={DOC_ACCEPT}
            onChange={(e) => {
              addDocs(e.target.files);
              e.target.value = "";
            }}
            style={{ fontSize: 12, color: t.muted }}
          />
          {docs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {docs.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: t.cardBg2,
                    border: `1px solid ${t.cardBorder}`,
                    borderRadius: 99,
                    padding: "4px 6px 4px 11px",
                    fontSize: 11,
                    color: t.text,
                  }}
                >
                  📄 <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ color: t.mutedLight }}>{humanSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setDocs((prev) => prev.filter((_, j) => j !== i))}
                    title="Remove"
                    style={{ background: "transparent", border: "none", color: t.mutedLight, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <button style={{ ...ctaButton(t), opacity: busy || !name.trim() ? 0.5 : 1 }} onClick={create} disabled={busy || !name.trim()}>
          {busy ? (docs.length ? "Creating & uploading…" : "Creating…") : "Create"}
        </button>
        {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 12.5 }}>{error}</p>}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={sectionLabel}>Your rooms ({mine.length})</div>
        {mine.length === 0 && <p style={{ color: t.muted, marginTop: 12, fontSize: 12.5 }}>You haven&apos;t joined any rooms yet.</p>}
        {mine.map(roomCard)}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={sectionLabel}>Discover</div>
        {discover.length === 0 && <p style={{ color: t.muted, marginTop: 12, fontSize: 12.5 }}>No other public rooms.</p>}
        {discover.map(roomCard)}
      </div>
    </div>
  );
}
