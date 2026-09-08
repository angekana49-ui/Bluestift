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
import {
  ListNoMatch,
  ListToolbar,
  useListSearch,
  withCount,
} from "@/components/ui/list-filter";
import { sortByName } from "@/lib/search";
import { useTranslate } from "@/components/ui/locale";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";

type ClassOpt = { id: string; name: string };

/** Every mutation here goes through netFetch — see school-admin.tsx's postJson
 *  for the full rationale (a deadline instead of a spinner stuck forever,
 *  never auto-retried since none of these writes are idempotent). */
async function postJson(url: string, body: unknown, method = "POST") {
  const res = await netFetch(
    url,
    { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    { timeoutMs: 15_000 },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

type TeamData = {
  subjects?: SchoolSubject[];
  profs?: TeamProf[];
  assignments?: TeamAssignment[];
  invites?: TeamInvite[];
  requests?: TeamRequest[];
};

export function SchoolTeam({ classes }: { classes: ClassOpt[] }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
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
  const [inviteSent, setInviteSent] = useState<string | null>(null);
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

  /** Applies a fresh payload's lists — shared between the initial load and the
   *  background revalidation, so a reconciled response updates the same way
   *  whichever path it came from. Deliberately doesn't touch aSubject/aProf:
   *  those pickers default from the FIRST load only, so a background refresh
   *  never yanks a selection the teacher already made underneath them. */
  function applyTeamLists(t: TeamData) {
    if (Array.isArray(t.subjects)) setSubjects(t.subjects);
    if (Array.isArray(t.profs)) setProfs(t.profs);
    if (Array.isArray(t.assignments)) setAssignments(t.assignments);
    if (Array.isArray(t.invites)) setInvites(t.invites);
    if (Array.isArray(t.requests)) setRequests(t.requests);
  }

  useEffect(() => {
    (async () => {
      // Cached-first: re-opening the Team tab renders the last known roster
      // instantly and reconciles in the background instead of a blank panel
      // on every mount.
      const { data } = await getJsonCached<TeamData>("/api/school/team", {
        cacheKey: "school:team",
        onUpdate: applyTeamLists,
      });
      if (!data) {
        setError(tr("school.team.loadFailed"));
        return;
      }
      applyTeamLists(data);
      setASubject((data.subjects?.[0] as SchoolSubject | undefined)?.id ?? "");
      setAProf((data.profs?.[0] as TeamProf | undefined)?.adminId ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      invalidateCached("school:team");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.addSubjectFailed"));
    }
  }

  /**
   * Inviting does NOT add anyone. The teacher accepts with the code, and only
   * then do they appear in the list above — so nothing is appended here, and
   * the confirmation says what actually happened.
   */
  async function addProf(e: React.FormEvent) {
    e.preventDefault();
    if (!profId.trim()) return;
    setError(null);
    setInviteSent(null);
    try {
      const r = (await postJson("/api/school/profs", { identifier: profId })) as {
        email: string | null;
        name: string;
        code: string;
        codeId: string;
        emailed: boolean;
      };
      setInviteSent(
        r.emailed
          ? `${tr("school.team.invitationSentA")} ${r.email ?? profId}${tr("school.team.invitationSentB")}`
          : `${tr("school.team.emailNotSetUp")} ${r.code}`,
      );
      setProfId("");
      // The new code belongs on the list below, where it can be copied or
      // deactivated like any other.
      setInvites((v) => [{ id: r.codeId, code: r.code, autoApprove: true, isActive: true }, ...v]);
      invalidateCached("school:team");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.inviteFailed"));
    }
  }

  async function removeProf(adminId: string) {
    setError(null);
    try {
      const res = await netFetch(
        `/api/school/profs?adminId=${encodeURIComponent(adminId)}`,
        { method: "DELETE" },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? tr("school.team.removeTeacherFailed"));
      }
      setProfs((v) => v.filter((p) => p.adminId !== adminId));
      setAssignments((v) => v.filter((a) => a.profName !== profs.find((p) => p.adminId === adminId)?.name));
      invalidateCached("school:team");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.removeTeacherFailed"));
    }
  }

  async function generateInvite() {
    setError(null);
    try {
      const inv = (await postJson("/api/school/invites", { autoApprove })) as TeamInvite;
      setInvites((v) => [inv, ...v]);
      invalidateCached("school:team");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.createInviteFailed"));
    }
  }

  async function deactivateInvite(codeId: string) {
    setError(null);
    try {
      const res = await netFetch(
        "/api/school/invites",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ codeId, isActive: false }),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? tr("school.team.deactivateFailed"));
      }
      setInvites((v) => v.filter((i) => i.id !== codeId));
      invalidateCached("school:team");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.deactivateFailed"));
    }
  }

  async function copyInvite(inv: TeamInvite) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/school?join=${inv.code}`);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 2000);
    } catch {
      setError(tr("school.team.copyLinkFailed"));
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
        // A returning teacher is already on the list, carrying a "Not back yet"
        // badge — approving clears it rather than adding them a second time.
        setProfs((v) =>
          v.some((p) => p.userId === req.userId)
            ? v.map((p) => (p.userId === req.userId ? { ...p, confirmedForYear: true } : p))
            : [
                ...v,
                {
                  adminId: res.adminId as string,
                  userId: req.userId,
                  name: req.name,
                  email: req.email,
                  confirmedForYear: true,
                },
              ],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.updateRequestFailed"));
    }
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!aProf || !aClass || !aSubject) {
      setError(tr("school.team.pickProfClassSubject"));
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
          profName: profs.find((p) => p.adminId === aProf)?.name ?? tr("school.team.profFallback"),
          className: classes.find((c) => c.id === aClass)?.name ?? tr("school.team.classFallback"),
          subjectName: subjects.find((s) => s.id === aSubject)?.name ?? tr("school.team.subjectFallback"),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.createAssignmentFailed"));
    }
  }

  /**
   * Sorted, then searchable — in that order.
   *
   * These four lists all rendered in insertion order, which for a school that
   * has been running two years means "the order people happened to be added in",
   * i.e. none. Alphabetical first so scanning works at all, then a field for
   * when scanning stops being enough (see LIST_SEARCH_MIN: none of these show a
   * search box until they are actually long).
   *
   * Assignments are keyed on the teacher, since "what does this teacher teach"
   * is the question the row is read to answer; the search covers class and
   * subject too, so typing a class name filters to that class without needing a
   * second control.
   */
  const sortedSubjects = sortByName(subjects, (s) => s.name);
  const sortedProfs = sortByName(profs, (p) => p.name);
  const notBack = profs.filter((p) => !p.confirmedForYear).length;
  const sortedAssignments = sortByName(assignments, (a) => a.profName);

  const subjectSearch = useListSearch(sortedSubjects, (s) => [s.name, s.code], { noun: tr("list.noun.subjects") });
  const requestSearch = useListSearch(requests, (r) => [r.name, r.email], { noun: tr("list.noun.requests") });
  const profSearch = useListSearch(sortedProfs, (p) => [p.name, p.email], { noun: tr("list.noun.teachers") });
  const assignmentSearch = useListSearch(
    sortedAssignments,
    (a) => [a.profName, a.className, a.subjectName],
    { noun: tr("list.noun.assignments") },
  );

  return (
    <div>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {/* Subjects */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>{withCount(tr("school.team.subjectsHeading"), subjects.length, t)}</h3>
        {subjects.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noSubjectsYet")}</p>}
        <ListToolbar search={subjectSearch} />
        {subjectSearch.visible.map((s) => (
          <div key={s.id} style={{ padding: "0.2rem 0" }}>
            {s.name}
            {s.code ? <span style={{ opacity: 0.5 }}> · {s.code}</span> : null}
          </div>
        ))}
        <ListNoMatch search={subjectSearch} />
        <form onSubmit={addSubject} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <input style={{ ...input, flex: 2, minWidth: 160 }} placeholder={tr("school.team.subjectNamePlaceholder")} value={sName} onChange={(e) => setSName(e.target.value)} />
          <input style={{ ...input, flex: 1, minWidth: 90 }} placeholder={tr("school.team.subjectCodePlaceholder")} value={sCode} onChange={(e) => setSCode(e.target.value)} />
          <button type="submit" style={btn}>{tr("school.dashboard.addButton")}</button>
        </form>
      </div>

      {/* Pending join requests */}
      {requests.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>{tr("school.team.requestsToJoin")} ({requests.length})</h3>
          <ListToolbar search={requestSearch} />
          {requestSearch.visible.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}
            >
              <div style={{ flex: 1 }}>
                {r.name}
                {r.email ? <span style={{ opacity: 0.5 }}> · {r.email}</span> : null}
              </div>
              <button style={btn} onClick={() => decideRequest(r, "approve")}>{tr("school.team.approve")}</button>
              <button style={ghost} onClick={() => decideRequest(r, "reject")}>{tr("school.team.reject")}</button>
            </div>
          ))}
          <ListNoMatch search={requestSearch} />
        </div>
      )}

      {/* Profs */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>{withCount(tr("school.team.teachersHeading"), profs.length, t)}</h3>
        {profs.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noTeachersYet")}</p>}
        {/* The yearly roll: who has entered this year's staff code and who hasn't.
            Nobody is dropped automatically — a teacher who has left simply never
            comes back, and the admin removes them when they're sure. */}
        {notBack > 0 && (
          <p style={{ margin: "0 0 0.6rem", color: t.muted, fontSize: "0.85rem" }}>
            {notBack} {tr(notBack === 1 ? "school.team.notBackOne" : "school.team.notBackOther")}
          </p>
        )}
        <ListToolbar search={profSearch} />
        {profSearch.visible.map((p) => (
          <div key={p.adminId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.2rem 0" }}>
            <span style={{ flex: 1 }}>
              {p.name}
              {p.email ? <span style={{ opacity: 0.5 }}> · {p.email}</span> : null}
              {!p.confirmedForYear && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: 99,
                    border: `1px solid ${t.cardBorder}`,
                    color: t.muted,
                    fontSize: "0.72rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tr("school.team.notBackYet")}
                </span>
              )}
            </span>
            <button
              onClick={() => removeProf(p.adminId)}
              title={tr("school.team.removeFromSchoolTitle")}
              style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer", fontSize: "0.9rem" }}
            >
              ✕
            </button>
          </div>
        ))}
        <ListNoMatch search={profSearch} />
        <form onSubmit={addProf} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <input style={{ ...input, flex: 1, minWidth: 200 }} placeholder={tr("school.team.teacherEmailPlaceholder")} value={profId} onChange={(e) => setProfId(e.target.value)} />
          <button type="submit" style={btn}>{tr("school.team.inviteTeacherButton")}</button>
        </form>
        {inviteSent && (
          <p style={{ fontSize: "0.85rem", opacity: 0.75, marginBottom: 0 }}>{inviteSent}</p>
        )}
      </div>

      {/* Invite codes */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>{tr("school.team.inviteTeachersHeading")}</h3>
        <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
          {tr("school.team.shareInviteIntro")}
        </p>
        {invites.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noActiveCodes")}</p>}
        {invites.map((inv) => (
          <div
            key={inv.id}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}
          >
            <code style={{ fontSize: "1rem", letterSpacing: "0.05em" }}>{inv.code}</code>
            <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>
              {inv.autoApprove ? tr("school.team.autoApproveWord") : tr("school.team.needsApprovalWord")}
            </span>
            <span style={{ flex: 1 }} />
            <button style={ghost} onClick={() => copyInvite(inv)}>
              {copiedId === inv.id ? tr("school.class.copied") : tr("school.team.copyLink")}
            </button>
            <button style={ghost} onClick={() => deactivateInvite(inv.id)}>{tr("school.class.deactivate")}</button>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", opacity: 0.85, marginRight: "auto" }}>
            <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
            {tr("school.team.autoApproveCheckbox")}
          </label>
          {/* The setting stays where it reads, the action moves to the edge. */}
          <button style={btn} onClick={generateInvite}>{tr("school.team.generateCodeButton")}</button>
        </div>
      </div>

      {/* Assignments */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>
          {withCount(tr("school.team.assignmentsHeading"), assignments.length, t)}
        </h3>
        {assignments.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noAssignmentsYet")}</p>}
        <ListToolbar search={assignmentSearch} />
        {assignmentSearch.visible.map((a) => (
          <div key={a.id} style={{ padding: "0.2rem 0" }}>
            {a.profName} → {a.className} → {a.subjectName}
          </div>
        ))}
        <ListNoMatch search={assignmentSearch} />
        <form onSubmit={addAssignment} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {/* Sorted, like the lists above. A native <select> only offers
              first-letter type-ahead, so with a hundred teachers in it the
              alphabetical order is the ONLY thing making the control usable —
              in insertion order, type-ahead lands you somewhere arbitrary. */}
          <select style={select} value={aProf} onChange={(e) => setAProf(e.target.value)}>
            {profs.length === 0 && <option value="">{tr("school.team.noTeachersOption")}</option>}
            {sortedProfs.map((p) => (
              <option key={p.adminId} value={p.adminId}>{p.name}</option>
            ))}
          </select>
          <select style={select} value={aClass} onChange={(e) => setAClass(e.target.value)}>
            {classes.length === 0 && <option value="">{tr("school.team.noClassesOption")}</option>}
            {sortByName(classes, (c) => c.name).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select style={select} value={aSubject} onChange={(e) => setASubject(e.target.value)}>
            {subjects.length === 0 && <option value="">{tr("school.team.noSubjectsOption")}</option>}
            {sortedSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {/* The three selects are fixed-width, so without this the free space
              all pools to the RIGHT of the button and the action sits hard left
              — the same shape as the report row above. */}
          <button type="submit" style={{ ...btn, marginLeft: "auto" }}>{tr("school.team.assignButton")}</button>
        </form>
      </div>
    </div>
  );
}
