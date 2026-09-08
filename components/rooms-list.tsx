"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/app/rooms/actions";
import { dispatchUpgrade } from "@/lib/upgrade";
import { netFetch } from "@/lib/net/client-fetch";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton, neutralButton, formActions } from "@/components/ui/forms";
import { FilePicker } from "@/components/ui/file-picker";
import { ListNoMatch, ListToolbar, useListSearch } from "@/components/ui/list-filter";
import { RayaName } from "@/components/ui/brand";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type Room = {
  id: string;
  name: string;
  subject: string | null;
  visibility: string;
  status: string;
};

// Smart defaults: one-tap subjects so the "New room" form isn't a pair of blank
// boxes. Visibility defaults to private — see createRoom for why that direction.
// Keys, not literal strings, so the chips translate along with everything else
// (see also solo-challenge.tsx and student-simulation.tsx, which offer the
// same six subjects as suggestion chips).
const SUBJECT_KEYS: MessageKey[] = [
  "subject.maths",
  "subject.physics",
  "subject.chemistry",
  "subject.biology",
  "subject.history",
  "subject.languages",
];

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
  canChooseVisibility = false,
}: {
  rooms: Room[];
  myRoomIds: string[];
  /** `roomVisibilityChoice` for the signed-in plan, resolved on the server.
   *  False (the Free default) means every room this account opens is private. */
  canChooseVisibility?: boolean;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
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
        setError(tr("rooms.docsExceed"));
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
    fontSize: 14,
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
        // See room-view's join(): the age rule is not something a plan fixes.
        if (result.code === "minor_public_room") {
          setError(result.error);
        } else {
          dispatchUpgrade({ code: result.code, message: result.error });
        }
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
          // Server-side extraction can run up to 60s (maxDuration) — a bare
          // fetch never times out, so this used to hang silently on a dead
          // link until the tab was closed instead of moving on to the room.
          await netFetch("/api/rooms/files", { method: "POST", body: fd }, { timeoutMs: 65_000 });
        } catch {
          // skip this doc — don't block entering the room
        }
      }
      router.push(`/rooms/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("rooms.createFailed"));
      setBusy(false);
    }
  }

  const mySet = new Set(myRoomIds);
  const mine = rooms.filter((r) => mySet.has(r.id));
  const discover = rooms.filter((r) => !mySet.has(r.id));
  const discoverSearch = useListSearch(discover, (r) => [r.name, r.subject], { noun: tr("list.noun.rooms") });

  const sectionLabel: React.CSSProperties = {
    fontSize: 13,
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
        <div style={{ fontWeight: 600, color: t.text, fontSize: 15 }}>{r.name}</div>
        <div style={{ fontSize: 13, color: t.mutedLight }}>
          {r.subject ?? "—"} · {r.visibility === "public" ? tr("rooms.visPublic") : tr("rooms.visPrivate")}
        </div>
      </div>
      <span style={{ color: t.mutedLight }}>→</span>
    </a>
  );

  return (
    <div>
      <div style={panelCard(t)}>
        <h2 style={cardTitle(t)}>{tr("rooms.newRoomTitle")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <input style={{ ...textInput(t), flex: 1, minWidth: 180, width: "auto" }} placeholder={tr("rooms.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          <input style={{ ...textInput(t), flex: 1, minWidth: 180, width: "auto" }} placeholder={tr("rooms.subjectPlaceholder")} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
          {SUBJECT_KEYS.map((key) => {
            const s = tr(key);
            return (
              <button key={key} type="button" style={chip(subject === s)} onClick={() => pickSubject(s)}>
                {s}
              </button>
            );
          })}
        </div>
        {/* Private is the default and, without `canChooseVisibility`, the only
            option — so the radios are not rendered at all rather than rendered
            disabled. A control that cannot move still invites the reader to try
            it and then explains itself with an upsell; a plain line of text says
            the same thing once and takes no room. createRoom coerces the value
            server-side regardless, so this is the honest face of a rule that is
            enforced whether or not this component behaves. */}
        {canChooseVisibility ? (
          <div style={{ display: "flex", gap: 16, margin: "10px 0 14px", fontSize: 14 }}>
            {(["private", "public"] as const).map((v) => (
              <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: t.text }}>
                <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
                <span>
                  {v === "public" ? tr("rooms.visPublic") : tr("rooms.visPrivate")}
                  <span style={{ color: t.mutedLight, marginLeft: 6 }}>
                    — {v === "public" ? tr("rooms.visPublicHint") : tr("rooms.visPrivateHint")}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div style={{ margin: "10px 0 14px", fontSize: 14, color: t.mutedLight }}>
            {tr("rooms.lockedPrivateNotice")}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 14px", fontSize: 14, flexWrap: "wrap" }}>
          <span style={{ color: t.text, fontWeight: 600 }}>{tr("rooms.sessionLength")}</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ ...textInput(t), width: "auto", padding: "8px 12px", cursor: "pointer" }}
          >
            <option value={0}>{tr("rooms.noTimer")}</option>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} {tr("rooms.minutes")}
              </option>
            ))}
          </select>
          <span style={{ color: t.mutedLight }}>
            {duration ? tr("rooms.readOnlyAfterTimer") : tr("rooms.openUntilClosed")}
          </span>
        </div>
        <div style={{ margin: "2px 0 14px" }}>
          <div style={{ fontSize: 14, color: t.text, fontWeight: 600, marginBottom: 4 }}>{tr("rooms.contextDocsLabel")}</div>
          <div style={{ fontSize: 13, color: t.mutedLight, marginBottom: 6 }}>
            <RayaName /> {tr("rooms.contextDocsHint")}
          </div>
          <FilePicker
            multiple
            accept={DOC_ACCEPT}
            onPick={addDocs}
            // The same file may legitimately be picked again after being removed
            // from the chips below.
            resetAfterPick
            buttonStyle={neutralButton(t)}
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
                    fontSize: 13,
                    color: t.text,
                  }}
                >
                  📄 <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ color: t.mutedLight }}>{humanSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setDocs((prev) => prev.filter((_, j) => j !== i))}
                    title={tr("rooms.removeTitle")}
                    style={{ background: "transparent", border: "none", color: t.mutedLight, cursor: "pointer", fontSize: 15, padding: 0, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={formActions}>
          <button style={{ ...ctaButton(t), opacity: busy || !name.trim() ? 0.5 : 1 }} onClick={create} disabled={busy || !name.trim()}>
            {busy ? (docs.length ? tr("rooms.creatingAndUploading") : tr("rooms.creating")) : tr("rooms.create")}
          </button>
        </div>
        {error && <p style={{ color: "#f87171", marginTop: 8, fontSize: 15 }}>{error}</p>}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={sectionLabel}>{tr("rooms.yourRooms")} ({mine.length})</div>
        {mine.length === 0 && <p style={{ color: t.muted, marginTop: 12, fontSize: 15 }}>{tr("rooms.noneJoinedYet")}</p>}
        {mine.map(roomCard)}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ ...sectionLabel, marginBottom: 10 }}>{tr("rooms.discover")}</div>
        {/* The one list here that grows without the learner doing anything —
            every public room in the product lands in it. Subject as well as
            name, since "who else is revising physics" is the question this
            section is actually browsed with. */}
        <ListToolbar search={discoverSearch} />
        {discover.length === 0 && <p style={{ color: t.muted, marginTop: 12, fontSize: 15 }}>{tr("rooms.noPublicRooms")}</p>}
        {discoverSearch.visible.map(roomCard)}
        <ListNoMatch search={discoverSearch} />
      </div>
    </div>
  );
}
