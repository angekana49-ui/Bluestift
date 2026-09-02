"use client";

import { useEffect, useState } from "react";
import type {
  SchoolSubject,
  TeamAssignment,
  TeamInvite,
  TeamProf,
  TeamRequest,
} from "@/lib/school-admin";

import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";

type ClassOpt = { id: string; name: string };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

export function SchoolTeam({ classes }: { classes: ClassOpt[] }) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  const input = textInput(t);
  const select = input;
  const btn = ctaButton(t);
  const ghost = ghostButton(t);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [profs, setProfs] = useState<TeamProf[]>([]);
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-subject form
  const [sName, setSName] = useState("");
  const [sCode, setSCode] = useState("");
  // Add-prof form
  const [profId, setProfId] = useState("");
  // Add-assignment form
  const [aProf, setAProf] = useState("");
  const [aClass, setAClass] = useState(classes[0]?.id ?? "");
  const [aSubject, setASubject] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const t = await (await fetch("/api/school/team")).json();
        setSubjects(t.subjects ?? []);
        setProfs(t.profs ?? []);
        setAssignments(t.assignments ?? []);
        setInvites(t.invites ?? []);
        setRequests(t.requests ?? []);
        setASubject((t.subjects?.[0] as SchoolSubject | undefined)?.id ?? "");
        setAProf((t.profs?.[0] as TeamProf | undefined)?.adminId ?? "");
      } catch {
        setError("Could not load the team.");
      }
    })();
  }, []);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!sName.trim()) return;
    setError(null);
    try {
      const s = (await postJson("/api/school/subjects", { name: sName, code: sCode })) as SchoolSubject;
      setSubjects((v) => [...v, s]);
      if (!aSubject) setASubject(s.id);
      setSName("");
      setSCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the subject.");
    }
  }

  async function addProf(e: React.FormEvent) {
    e.preventDefault();
    if (!profId.trim()) return;
    setError(null);
    try {
      const p = (await postJson("/api/school/profs", { identifier: profId })) as TeamProf;
      setProfs((v) => [...v, p]);
      if (!aProf) setAProf(p.adminId);
      setProfId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the prof.");
    }
  }

  async function removeProf(adminId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/school/profs?adminId=${encodeURIComponent(adminId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not remove the teacher.");
      }
      setProfs((v) => v.filter((p) => p.adminId !== adminId));
      setAssignments((v) => v.filter((a) => a.profName !== profs.find((p) => p.adminId === adminId)?.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the teacher.");
    }
  }

  async function generateInvite() {
    setError(null);
    try {
      const inv = (await postJson("/api/school/invites", { autoApprove })) as TeamInvite;
      setInvites((v) => [inv, ...v]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invite code.");
    }
  }

  async function deactivateInvite(codeId: string) {
    setError(null);
    try {
      const res = await fetch("/api/school/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codeId, isActive: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not deactivate the code.");
      }
      setInvites((v) => v.filter((i) => i.id !== codeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate the code.");
    }
  }

  async function copyInvite(inv: TeamInvite) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/school?join=${inv.code}`);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 2000);
    } catch {
      setError("Could not copy the link.");
    }
  }

  async function decideRequest(req: TeamRequest, action: "approve" | "reject") {
    setError(null);
    try {
      const res = (await postJson("/api/school/requests", { requestId: req.id, action })) as {
        adminId: string | null;
      };
      setRequests((v) => v.filter((r) => r.id !== req.id));
      if (action === "approve" && res.adminId) {
        setProfs((v) =>
          v.some((p) => p.userId === req.userId)
            ? v
            : [...v, { adminId: res.adminId as string, userId: req.userId, name: req.name, email: req.email }],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the request.");
    }
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!aProf || !aClass || !aSubject) {
      setError("Pick a prof, a class and a subject.");
      return;
    }
    setError(null);
    try {
      const a = (await postJson("/api/school/assignments", {
        profAdminId: aProf,
        classId: aClass,
        subjectId: aSubject,
      })) as { id: string };
      setAssignments((v) => [
        ...v,
        {
          id: a.id,
          profName: profs.find((p) => p.adminId === aProf)?.name ?? "Prof",
          className: classes.find((c) => c.id === aClass)?.name ?? "Class",
          subjectName: subjects.find((s) => s.id === aSubject)?.name ?? "Subject",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the assignment.");
    }
  }

  return (
    <div>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {/* Subjects */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Subjects</h3>
        {subjects.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No subjects yet.</p>}
        {subjects.map((s) => (
          <div key={s.id} style={{ padding: "0.2rem 0" }}>
            {s.name}
            {s.code ? <span style={{ opacity: 0.5 }}> · {s.code}</span> : null}
          </div>
        ))}
        <form onSubmit={addSubject} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <input style={{ ...input, flex: 2, minWidth: 160 }} placeholder="Subject name" value={sName} onChange={(e) => setSName(e.target.value)} />
          <input style={{ ...input, flex: 1, minWidth: 90 }} placeholder="Code (e.g. MATH)" value={sCode} onChange={(e) => setSCode(e.target.value)} />
          <button type="submit" style={btn}>Add</button>
        </form>
      </div>

      {/* Pending join requests */}
      {requests.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>Requests to join ({requests.length})</h3>
          {requests.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}
            >
              <div style={{ flex: 1 }}>
                {r.name}
                {r.email ? <span style={{ opacity: 0.5 }}> · {r.email}</span> : null}
              </div>
              <button style={btn} onClick={() => decideRequest(r, "approve")}>Approve</button>
              <button style={ghost} onClick={() => decideRequest(r, "reject")}>Reject</button>
            </div>
          ))}
        </div>
      )}

      {/* Profs */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Teachers</h3>
        {profs.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No teachers yet.</p>}
        {profs.map((p) => (
          <div key={p.adminId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.2rem 0" }}>
            <span style={{ flex: 1 }}>
              {p.name}
              {p.email ? <span style={{ opacity: 0.5 }}> · {p.email}</span> : null}
            </span>
            <button
              onClick={() => removeProf(p.adminId)}
              title="Remove from school"
              style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer", fontSize: "0.9rem" }}
            >
              ✕
            </button>
          </div>
        ))}
        <form onSubmit={addProf} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <input style={{ ...input, flex: 1, minWidth: 200 }} placeholder="Teacher email or username" value={profId} onChange={(e) => setProfId(e.target.value)} />
          <button type="submit" style={btn}>Add teacher</button>
        </form>
      </div>

      {/* Invite codes */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Invite teachers</h3>
        <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
          Share an invite link. Teachers open it, paste the code, and join —
          instantly if auto-approve is on, otherwise you approve their request here.
        </p>
        {invites.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No active codes.</p>}
        {invites.map((inv) => (
          <div
            key={inv.id}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}
          >
            <code style={{ fontSize: "1rem", letterSpacing: "0.05em" }}>{inv.code}</code>
            <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>
              {inv.autoApprove ? "auto-approve" : "needs approval"}
            </span>
            <span style={{ flex: 1 }} />
            <button style={ghost} onClick={() => copyInvite(inv)}>
              {copiedId === inv.id ? "Copied ✓" : "Copy link"}
            </button>
            <button style={ghost} onClick={() => deactivateInvite(inv.id)}>Deactivate</button>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", opacity: 0.85, marginRight: "auto" }}>
            <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
            Auto-approve (join without my approval)
          </label>
          {/* The setting stays where it reads, the action moves to the edge. */}
          <button style={btn} onClick={generateInvite}>Generate code</button>
        </div>
      </div>

      {/* Assignments */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Assignments (teacher → class → subject)</h3>
        {assignments.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No assignments yet.</p>}
        {assignments.map((a) => (
          <div key={a.id} style={{ padding: "0.2rem 0" }}>
            {a.profName} → {a.className} → {a.subjectName}
          </div>
        ))}
        <form onSubmit={addAssignment} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <select style={select} value={aProf} onChange={(e) => setAProf(e.target.value)}>
            {profs.length === 0 && <option value="">No teachers</option>}
            {profs.map((p) => (
              <option key={p.adminId} value={p.adminId}>{p.name}</option>
            ))}
          </select>
          <select style={select} value={aClass} onChange={(e) => setAClass(e.target.value)}>
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select style={select} value={aSubject} onChange={(e) => setASubject(e.target.value)}>
            {subjects.length === 0 && <option value="">No subjects</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button type="submit" style={btn}>Assign</button>
        </form>
      </div>
    </div>
  );
}
