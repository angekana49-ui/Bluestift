"use client";

import { useEffect, useState } from "react";
import type { LmsConnection, LmsMapping } from "@/lib/school-admin";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { panelCard, textInput, ctaButton, ghostButton, formActions } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";

type ClassOpt = { id: string; name: string };

async function req(url: string, method: string, body?: unknown, timeoutMs = 15_000) {
  const res = await netFetch(
    url,
    {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
    { timeoutMs },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

export function SchoolLms({ classes }: { classes: ClassOpt[] }) {
  const { theme: tt } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(tt);
  const btn = ctaButton(tt);
  const [connections, setConnections] = useState<LmsConnection[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) setNotice(tr("school.lms.connectedNotice"));
    if (q.get("lmsError")) setError(`${tr("school.lms.errorPrefix")} ${q.get("lmsError")}`);
    (async () => {
      const { data } = await getJsonCached<{ connections?: LmsConnection[] }>("/api/school/lms", {
        cacheKey: "school:lms",
        onUpdate: (fresh) => setConnections(fresh.connections ?? []),
      });
      if (!data) {
        setError(tr("school.lms.loadFailed"));
        return;
      }
      setConnections(data.connections ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const google = connections.find((c) => c.provider === "google_classroom");

  async function disconnect(id: string) {
    setError(null);
    try {
      await req(`/api/school/lms?id=${id}`, "DELETE");
      setConnections((v) => v.filter((c) => c.id !== id));
      invalidateCached("school:lms");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.lms.disconnectFailed"));
    }
  }

  function patchConn(id: string, fn: (c: LmsConnection) => LmsConnection) {
    setConnections((v) => v.map((c) => (c.id === id ? fn(c) : c)));
  }

  return (
    <div>
      {notice && <p style={{ color: "#22c55e" }}>{notice}</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Google Classroom</h3>
        {!google ? (
          <>
            <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
              {tr("school.lms.connectIntro")}
            </p>
            <div style={{ ...formActions, marginTop: 0 }}>
              <a href="/api/school/lms/google/start" style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
                {tr("school.lms.connectButton")}
              </a>
            </div>
          </>
        ) : (
          <GoogleConnection
            conn={google}
            classes={classes}
            onDisconnect={disconnect}
            onPatch={patchConn}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

function MappingRow({
  conn,
  mp,
  classes,
  onPatch,
  onError,
}: {
  conn: LmsConnection;
  mp: LmsMapping;
  classes: ClassOpt[];
  onPatch: (id: string, fn: (c: LmsConnection) => LmsConnection) => void;
  onError: (m: string) => void;
}) {
  const { theme: tt } = useAppTheme();
  const tr = useTranslate();
  const input = textInput(tt);
  const ghost = ghostButton(tt);
  const [assigning, setAssigning] = useState(classes[0]?.id ?? "");
  async function assign() {
    if (!assigning) return;
    try {
      const r = (await req("/api/school/lms/mappings", "PATCH", { id: mp.id, classId: assigning })) as {
        classId: string;
        className: string;
      };
      onPatch(conn.id, (c) => ({
        ...c,
        mappings: c.mappings.map((m) => (m.id === mp.id ? { ...m, classId: r.classId, className: r.className } : m)),
      }));
    } catch (err) {
      onError(err instanceof Error ? err.message : tr("school.lms.assignFailed"));
    }
  }
  async function remove() {
    try {
      await req(`/api/school/lms/mappings?id=${mp.id}`, "DELETE");
      onPatch(conn.id, (c) => ({ ...c, mappings: c.mappings.filter((m) => m.id !== mp.id) }));
    } catch (err) {
      onError(err instanceof Error ? err.message : tr("school.lms.removeFailed"));
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0" }}>
      {/* minWidth: 0 — without it a long imported course name can't shrink
          below its own content width, and next to a select + two buttons in a
          row with no wrap, that pushes the whole roster row past the viewport
          on a narrow screen instead of wrapping the name. Same fix as
          RosterRow above (a `flex: 1` label is only really flexible with
          this set). */}
      <span style={{ flex: 1, minWidth: 0, fontSize: "0.9rem" }}>{mp.externalClassName || mp.externalClassId}</span>
      {mp.className ? (
        <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>→ {mp.className}</span>
      ) : (
        <>
          <select style={{ ...input, padding: "0.3rem 0.5rem" }} value={assigning} onChange={(e) => setAssigning(e.target.value)}>
            {classes.length === 0 && <option value="">{tr("school.team.noClassesOption")}</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button style={ghost} onClick={assign}>
            {tr("school.team.assignButton")}
          </button>
        </>
      )}
      <button style={ghost} onClick={remove}>
        ✕
      </button>
    </div>
  );
}

function GoogleConnection({
  conn,
  classes,
  onDisconnect,
  onPatch,
  onError,
}: {
  conn: LmsConnection;
  classes: ClassOpt[];
  onDisconnect: (id: string) => void;
  onPatch: (id: string, fn: (c: LmsConnection) => LmsConnection) => void;
  onError: (m: string) => void;
}) {
  const { theme: tt } = useAppTheme();
  const tr = useTranslate();
  const ghost = ghostButton(tt);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      // A full roster sync against the Google Classroom API — slower than a
      // plain JSON round trip, so it gets more room than the 15s default.
      const r = (await req("/api/school/lms/google/sync", "POST", undefined, 30_000)) as {
        imported: number;
        total: number;
      };
      setSyncMsg(`${tr("school.lms.importedA")} ${r.imported} ${tr("school.lms.importedB")} ${r.total} ${tr("school.lms.importedC")}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : tr("school.lms.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* minWidth: 0 — a long Workspace org name sits next to two buttons in
            an unwrapped row; without it the name can't shrink and the row
            overflows on a narrow screen (see MappingRow below). */}
        <strong style={{ flex: 1, minWidth: 0 }}>
          {tr("school.lms.connectedPrefix")}{conn.externalOrgName ? <span style={{ opacity: 0.5, fontWeight: 400 }}> · {conn.externalOrgName}</span> : null}
        </strong>
        <button style={ghost} onClick={sync} disabled={syncing}>
          {syncing ? tr("school.lms.syncing") : tr("school.lms.syncCourses")}
        </button>
        <button style={ghost} onClick={() => onDisconnect(conn.id)}>
          {tr("school.lms.disconnectButton")}
        </button>
      </div>
      {syncMsg && <p style={{ color: "#22c55e", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>{syncMsg}</p>}

      <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {tr("school.lms.courseMappingsHeading")}
      </div>
      {conn.mappings.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: "0.85rem", margin: "0.3rem 0" }}>
          {tr("school.lms.noneYetSync")}
        </p>
      )}
      {conn.mappings.map((mp) => (
        <MappingRow key={mp.id} conn={conn} mp={mp} classes={classes} onPatch={onPatch} onError={onError} />
      ))}
    </div>
  );
}
