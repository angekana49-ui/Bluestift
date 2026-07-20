"use client";

import { useEffect, useState } from "react";
import type { LmsConnection, LmsMapping } from "@/lib/school-admin";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";

type ClassOpt = { id: string; name: string };

async function req(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

export function SchoolLms({ classes }: { classes: ClassOpt[] }) {
  const { theme: tt } = useAppTheme();
  const box = panelCard(tt);
  const btn = ctaButton(tt);
  const [connections, setConnections] = useState<LmsConnection[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) setNotice("Google Classroom connected. Sync your courses below.");
    if (q.get("lmsError")) setError(`Google Classroom: ${q.get("lmsError")}`);
    (async () => {
      try {
        const d = await req("/api/school/lms", "GET");
        setConnections(d.connections ?? []);
      } catch {
        setError("Could not load the LMS connection.");
      }
    })();
  }, []);

  const google = connections.find((c) => c.provider === "google_classroom");

  async function disconnect(id: string) {
    setError(null);
    try {
      await req(`/api/school/lms?id=${id}`, "DELETE");
      setConnections((v) => v.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
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
              Connect your Google Workspace to import your courses and map them to your classes.
            </p>
            <a href="/api/school/lms/google/start" style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
              Connect Google Classroom
            </a>
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
      onError(err instanceof Error ? err.message : "Could not assign.");
    }
  }
  async function remove() {
    try {
      await req(`/api/school/lms/mappings?id=${mp.id}`, "DELETE");
      onPatch(conn.id, (c) => ({ ...c, mappings: c.mappings.filter((m) => m.id !== mp.id) }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove.");
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0" }}>
      <span style={{ flex: 1, fontSize: "0.9rem" }}>{mp.externalClassName || mp.externalClassId}</span>
      {mp.className ? (
        <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>→ {mp.className}</span>
      ) : (
        <>
          <select style={{ ...input, padding: "0.3rem 0.5rem" }} value={assigning} onChange={(e) => setAssigning(e.target.value)}>
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button style={ghost} onClick={assign}>
            Assign
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
  const ghost = ghostButton(tt);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = (await req("/api/school/lms/google/sync", "POST")) as { imported: number; total: number };
      setSyncMsg(`Imported ${r.imported} new of ${r.total} course(s). Reload to see them.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <strong style={{ flex: 1 }}>
          Connected{conn.externalOrgName ? <span style={{ opacity: 0.5, fontWeight: 400 }}> · {conn.externalOrgName}</span> : null}
        </strong>
        <button style={ghost} onClick={sync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync courses"}
        </button>
        <button style={ghost} onClick={() => onDisconnect(conn.id)}>
          Disconnect
        </button>
      </div>
      {syncMsg && <p style={{ color: "#22c55e", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>{syncMsg}</p>}

      <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Course mappings
      </div>
      {conn.mappings.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: "0.85rem", margin: "0.3rem 0" }}>
          None yet — sync to import courses, then assign each to a class.
        </p>
      )}
      {conn.mappings.map((mp) => (
        <MappingRow key={mp.id} conn={conn} mp={mp} classes={classes} onPatch={onPatch} onError={onError} />
      ))}
    </div>
  );
}
