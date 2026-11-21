"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  SchoolSubject,
  TeamAssignment,
  TeamInvite,
  TeamProf,
  TeamRequest,
} from "@/lib/school-admin";
import type { MessageKey } from "@/lib/i18n";
import { RightPanel } from "@/components/ui/shell";

import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput, ctaButton, ghostButton } from "@/components/ui/forms";
import {
  ListNoMatch,
  ListToolbar,
  useListSearch,
  withCount,
} from "@/components/ui/list-filter";
import { sortByName } from "@/lib/search";
import { useTranslate, trNow } from "@/components/ui/locale";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { Modal } from "@/components/ui/modal";

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
  if (!res.ok) throw new Error(data?.error ?? trNow("common.requestFailed", { status: res.status }));
  return data;
}

type TeamData = {
  subjects?: SchoolSubject[];
  profs?: TeamProf[];
  assignments?: TeamAssignment[];
  invites?: TeamInvite[];
  requests?: TeamRequest[];
};

export type TeamSection = "subjects" | "teachers" | "access" | "assignments";
export type TeamSectionCounts = { subjects: number; teachers: number; access: number; assignments: number };

const TEAM_SECTIONS: { key: TeamSection; labelKey: MessageKey }[] = [
  { key: "subjects", labelKey: "school.team.navSubjects" },
  { key: "teachers", labelKey: "school.team.navTeachers" },
  { key: "access", labelKey: "school.team.navAccess" },
  { key: "assignments", labelKey: "school.team.navAssignments" },
];

/**
 * The Team sections nav, as a shell right panel — exactly the Overview tab's
 * shape (RightPanel + cards), fed by the tab's own counts.
 */
export function TeamSectionsPanel({
  section,
  counts,
  onSection,
}: {
  section: TeamSection;
  counts: TeamSectionCounts;
  onSection: (s: TeamSection) => void;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const card: CSSProperties = { border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 16, background: t.cardBg2 };
  return (
    <RightPanel theme={t} width={300} title={tr("school.team.sectionsLabel")}>
      <div style={card}>
        {TEAM_SECTIONS.map((s, i) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSection(s.key)}
              aria-current={active ? "true" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                width: "100%",
                background: t.rowActiveBg,
                borderRadius: 12,
                padding: 12,
                marginBottom: i === TEAM_SECTIONS.length - 1 ? 0 : 8,
                border: `1px solid ${active ? t.cardBorder : "transparent"}`,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                fontSize: 15,
                fontWeight: active ? 700 : 600,
                color: active ? t.text : t.muted,
              }}
            >
              <span style={{ flex: 1 }}>{tr(s.labelKey)}</span>
              <span style={{ fontSize: 14, opacity: 0.65 }}>{counts[s.key]}</span>
            </button>
          );
        })}
      </div>
    </RightPanel>
  );
}

export function SchoolTeam({
  classes,
  section,
  onSectionCounts,
}: {
  classes: ClassOpt[];
  section: TeamSection;
  onSectionCounts: (c: TeamSectionCounts) => void;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(t);
  const input = textInput(t);
  const select = input;
  const btn = ctaButton(t);
  const ghost = ghostButton(t);
  const zoneBand: CSSProperties = { background: t.cardBg2, borderRadius: 14, padding: "0.8rem 0.9rem" };
  const colHead: CSSProperties = { fontSize: "0.8rem", fontWeight: 700, color: t.link };
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [profs, setProfs] = useState<TeamProf[]>([]);
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = useMemo<TeamSectionCounts>(
    () => ({
      subjects: subjects.length,
      teachers: profs.length,
      access: invites.length + requests.length,
      assignments: assignments.length,
    }),
    [subjects.length, profs.length, invites.length, requests.length, assignments.length],
  );
  useEffect(() => {
    onSectionCounts(counts);
  }, [counts, onSectionCounts]);
  const [confirmRemove, setConfirmRemove] = useState<{ adminId: string; name: string }[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profScope, setProfScope] = useState<"all" | "name" | "email" | "subjects">("all");
  const [bulkClass, setBulkClass] = useState("");
  const [bulkSubject, setBulkSubject] = useState("");

  const toggleSelect = (adminId: string) =>
    setSelected((v) => {
      const next = new Set(v);
      if (next.has(adminId)) next.delete(adminId);
      else next.add(adminId);
      return next;
    });
  const toggleSelectVisible = (checked: boolean) =>
    setSelected((v) => {
      const next = new Set(v);
      for (const p of profSearch.visible) {
        if (checked) next.add(p.adminId);
        else next.delete(p.adminId);
      }
      return next;
    });
  const openRemoveSelected = () => {
    const sel = profs.filter((p) => selected.has(p.adminId)).map((p) => ({ adminId: p.adminId, name: p.name }));
    if (sel.length > 0) setConfirmRemove(sel);
  };

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
   * Inviting an EXISTING account does not add anyone: the teacher accepts with
   * the code, and only then appears in the list above. An address with no
   * account is different — the school creates it and it joins the team at once
   * (/api/school/profs) — so that case reloads the roster and says so.
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
        created?: boolean;
        code?: string;
        codeId?: string;
        emailed: boolean;
      };
      if (r.created) {
        setInviteSent(
          `${tr("school.team.accountCreatedA")} ${r.email ?? profId}${tr(
            r.emailed ? "school.team.accountCreatedB" : "school.team.accountCreatedNoEmail",
          )}`,
        );
        setProfId("");
        invalidateCached("school:team");
        const { data } = await getJsonCached<TeamData>("/api/school/team", {
          cacheKey: "school:team",
          onUpdate: applyTeamLists,
        });
        if (data) applyTeamLists(data);
        return;
      }
      if (!r.code || !r.codeId) throw new Error(tr("school.team.inviteFailed"));
      const code = r.code;
      const codeId = r.codeId;
      setInviteSent(
        r.emailed
          ? `${tr("school.team.invitationSentA")} ${r.email ?? profId}${tr("school.team.invitationSentB")}`
          : `${tr("school.team.emailNotSetUp")} ${code}`,
      );
      setProfId("");
      // The new code belongs on the list below, where it can be copied or
      // deactivated like any other.
      setInvites((v) => [{ id: codeId, code, autoApprove: true, isActive: true }, ...v]);
      invalidateCached("school:team");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("school.team.inviteFailed"));
    }
  }

  async function removeSelected() {
    if (removing || !confirmRemove || confirmRemove.length === 0) return;
    setRemoving(true);
    setError(null);
    const failed: { adminId: string; name: string }[] = [];
    const attempted = confirmRemove;
    for (const t of attempted) {
      try {
        const res = await netFetch(
          "/api/school/profs?adminId=" + encodeURIComponent(t.adminId),
          { method: "DELETE" },
          { timeoutMs: 15_000 },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? tr("school.team.removeTeacherFailed"));
        }
        setProfs((v) => v.filter((p) => p.adminId !== t.adminId));
        setAssignments((v) => v.filter((a) => a.profId !== t.adminId));
        setSelected((v) => {
          const next = new Set(v);
          next.delete(t.adminId);
          return next;
        });
      } catch {
        failed.push(t);
      }
    }
    invalidateCached("school:team");
    setRemoving(false);
    if (failed.length === 0) setConfirmRemove(null);
    else {
      setConfirmRemove(failed);
      setError(
        failed.length === attempted.length
          ? tr("school.team.removeTeacherFailed")
: tr("school.team.removeSomeFailed", { names: failed.map((f) => f.name).join(", ") }),
      );
    }
  }

  async function bulkAssign() {
    const targets = profs.filter((p) => selected.has(p.adminId));
    if (targets.length === 0) return;
    if (!bulkClass || !bulkSubject) {
      setError(tr("school.team.pickClassSubject"));
      return;
    }
    setError(null);
    const failed: string[] = [];
    for (const p of targets) {
      try {
        const a = (await postJson("/api/school/assignments", {
          profAdminId: p.adminId,
          classId: bulkClass,
          subjectId: bulkSubject,
        })) as { id: string };
        setAssignments((v) => [
          ...v,
          {
            id: a.id,
            profId: p.adminId,
            profName: p.name,
            className: classes.find((c) => c.id === bulkClass)?.name ?? tr("school.team.classFallback"),
            subjectName: subjects.find((s) => s.id === bulkSubject)?.name ?? tr("school.team.subjectFallback"),
          },
        ]);
      } catch {
        failed.push(p.name);
      }
    }
    invalidateCached("school:team");
    if (failed.length > 0) {
      setError(tr("school.team.assignSomeFailed", { names: failed.join(", ") }));
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
  const assignmentsOf = (p: TeamProf) =>
    assignments.filter((a) => a.profId === p.adminId || (a.profId === undefined && a.profName === p.name));

  const subjectSearch = useListSearch(sortedSubjects, (s) => [s.name, s.code], { noun: tr("list.noun.subjects"), minItems: 1 });
  const requestSearch = useListSearch(requests, (r) => [r.name, r.email], { noun: tr("list.noun.requests"), minItems: 1 });
  const profSearch = useListSearch(
    sortedProfs,
    (p) => {
      if (profScope === "name") return [p.name];
      if (profScope === "email") return [p.email];
      const subjectNames = [...new Set(assignmentsOf(p).map((a) => a.subjectName))].join(", ");
      if (profScope === "subjects") return [subjectNames];
      return [p.name, p.email, subjectNames];
    },
    { noun: tr("list.noun.teachers"), minItems: 1 },
  );
  const assignmentSearch = useListSearch(
    sortedAssignments,
    (a) => [a.profName, a.className, a.subjectName],
    { noun: tr("list.noun.assignments"), minItems: 1 },
  );

  return (
    <div style={{ color: t.text }}>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {confirmRemove && confirmRemove.length > 0 && (
        <Modal
          onClose={() => {
            if (!removing) setConfirmRemove(null);
          }}
          label={confirmRemove.length === 1 ? tr("school.team.removeTitle", { name: confirmRemove[0].name }) : tr("school.team.removeTitleOther", { n: confirmRemove.length })}
          maxWidth={520}
          center
        >
          <div
            style={{
              background: t.cardBg,
              border: "1px solid " + t.cardBorder,
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
            }}
          >
            <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: t.text, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
              {confirmRemove.length === 1 ? tr("school.team.removeTitle", { name: confirmRemove[0].name }) : tr("school.team.removeTitleOther", { n: confirmRemove.length })}
            </h2>
            {(() => {
              const ids = new Set(confirmRemove.map((x) => x.adminId));
              const names = new Map(confirmRemove.map((x) => [x.adminId, x.name] as const));
              const mine = assignments.filter(
                (a) => (a.profId !== undefined && ids.has(a.profId)) || (a.profId === undefined && confirmRemove.some((x) => x.name === a.profName)),
              );
              const kept = { resources: 0, reports: 0, followups: 0 };
              for (const p of profs) {
                if (!ids.has(p.adminId)) continue;
                kept.resources += p.authored?.resources ?? 0;
                kept.reports += p.authored?.reports ?? 0;
                kept.followups += p.authored?.followups ?? 0;
              }
              const single = confirmRemove.length === 1;
              const list = mine
                .map((a) => {
                  const who = a.profId !== undefined ? (names.get(a.profId) ?? a.profName) : a.profName;
                  return single ? a.className + " · " + a.subjectName : who + " — " + a.className + " · " + a.subjectName;
                })
                .join(", ");
              return (
                <>
                  <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.6, margin: "0 0 8px" }}>
                    {mine.length > 0 ? tr("school.team.removeLineAssignments", { n: mine.length, list }) : tr("school.team.removeLineNoAssignments")}
                  </p>
                  <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.6, margin: "0 0 8px" }}>
                    {tr("school.team.removeLineKept", { resources: kept.resources, reports: kept.reports, followups: kept.followups })}
                  </p>
                  <p style={{ fontSize: 14, color: t.mutedLight, lineHeight: 1.6, margin: 0 }}>
                    {tr("school.team.removeLineAccount")}
                  </p>
                </>
              );
            })()}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" onClick={() => setConfirmRemove(null)} disabled={removing} style={ghost}>
                {tr("hist.cancel")}
              </button>
              <button
                type="button"
                onClick={() => removeSelected()}
                disabled={removing}
                style={{
                  borderRadius: 999,
                  padding: "9px 18px",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: removing ? "wait" : "pointer",
                  fontFamily: "inherit",
                  border: "1px solid transparent",
                  background: "#dc2626",
                  color: "#fff",
                  opacity: removing ? 0.7 : 1,
                }}
              >
                {removing ? tr("hist.working") : confirmRemove.length === 1 ? tr("school.team.removeConfirm") : tr("school.team.removeConfirm") + " (" + confirmRemove.length + ")"}
              </button>
            </div>
          </div>
        </Modal>
      )}

          {section === "subjects" && (
            <>
      {/* Subjects */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>{withCount(tr("school.team.subjectsHeading"), subjects.length, t)}</h3>
        <div style={{ ...zoneBand, marginTop: "0.75rem" }}>
          <form onSubmit={addSubject} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input style={{ ...input, flex: 2, minWidth: 160 }} placeholder={tr("school.team.subjectNamePlaceholder")} value={sName} onChange={(e) => setSName(e.target.value)} />
            <input style={{ ...input, flex: 1, minWidth: 90 }} placeholder={tr("school.team.subjectCodePlaceholder")} value={sCode} onChange={(e) => setSCode(e.target.value)} />
            <button type="submit" style={btn}>{tr("school.dashboard.addButton")}</button>
          </form>
        </div>
        <div style={{ marginTop: "1.1rem" }}>
          {subjects.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noSubjectsYet")}</p>}
          <ListToolbar search={subjectSearch} />
          {subjects.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <div style={{ minWidth: 300 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) 120px", gap: "0 0.6rem", borderBottom: "1px solid " + t.cardBorder, paddingBottom: "0.35rem", marginBottom: "0.15rem" }}>
                  <span style={colHead}>{tr("school.team.colName")}</span>
                  <span style={colHead}>{tr("school.team.colCode")}</span>
                </div>
                {subjectSearch.visible.map((s) => (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) 120px", gap: "0 0.6rem", alignItems: "center", padding: "0.35rem 0" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    <span style={{ opacity: 0.5 }}>{s.code ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ListNoMatch search={subjectSearch} />
        </div>
      </div>
            </>
          )}
          {section === "teachers" && (
            <>
      {/* Profs */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>{withCount(tr("school.team.teachersHeading"), profs.length, t)}</h3>
        <ListToolbar search={profSearch} />
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {(["all", "name", "email", "subjects"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setProfScope(scope)}
              aria-pressed={profScope === scope}
              style={profScope === scope ? { ...btn, padding: "5px 14px", fontSize: 13 } : { ...ghost, padding: "5px 14px", fontSize: 13 }}
            >
              {scope === "all" ? tr("school.team.filterAll") : scope === "name" ? tr("school.team.colTeacher") : scope === "email" ? tr("school.team.colEmail") : tr("school.team.navSubjects")}
            </button>
          ))}
        </div>
        <div style={{ ...zoneBand, marginTop: "1.1rem" }}>
          <form onSubmit={addProf} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input style={{ ...input, flex: 1, minWidth: 200 }} placeholder={tr("school.team.teacherEmailPlaceholder")} value={profId} onChange={(e) => setProfId(e.target.value)} />
            <button type="submit" style={btn}>{tr("school.team.inviteTeacherButton")}</button>
          </form>
          {inviteSent && (
            <p style={{ fontSize: "0.85rem", opacity: 0.75, marginBottom: 0 }}>{inviteSent}</p>
          )}
        </div>
        <div style={{ marginTop: "1.1rem" }}>
          {/* The yearly roll: who has entered this year's staff code and who hasn't.
              Nobody is dropped automatically — a teacher who has left simply never
              comes back, and the admin removes them when they're sure. */}
          {notBack > 0 && (
            <p style={{ margin: "0 0 0.6rem", color: t.muted, fontSize: "0.85rem" }}>
              {notBack} {tr(notBack === 1 ? "school.team.notBackOne" : "school.team.notBackOther")}
            </p>
          )}
          {selected.size > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", background: t.rowActiveBg, borderRadius: 12, padding: "0.55rem 0.8rem", marginTop: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: t.text, marginRight: "auto" }}>{tr("school.team.selectedCount", { n: selected.size })}</span>
                <button type="button" onClick={openRemoveSelected} title={tr("school.team.removeFromSchoolTitle")} style={{ borderRadius: 999, padding: "7px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "1px solid transparent", background: "#dc2626", color: "#fff" }}>
                  {selected.size === 1 ? tr("school.team.removeConfirm") : tr("school.team.removeConfirm") + " (" + selected.size + ")"}
                </button>
                <button type="button" onClick={() => setSelected(new Set())} style={ghost}>
                  {tr("school.team.clearSelection")}
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <select style={{ ...select, width: "auto", flex: "1 1 130px", minWidth: 120 }} value={bulkClass} onChange={(e) => setBulkClass(e.target.value)}>
                  {classes.length === 0 && <option value="">{tr("school.team.noClassesOption")}</option>}
                  {sortByName(classes, (c) => c.name).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select style={{ ...select, width: "auto", flex: "1 1 140px", minWidth: 140 }} value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)}>
                  {subjects.length === 0 && <option value="">{tr("school.team.noSubjectsOption")}</option>}
                  {sortedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="button" onClick={bulkAssign} style={btn}>{tr("school.team.assignButton")}</button>
              </div>
            </div>
          )}
          {profs.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noTeachersYet")}</p>}
          {profs.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: "grid", gridTemplateColumns: "32px minmax(150px,1.5fr) minmax(150px,1.5fr) minmax(130px,1fr) 90px", gap: "0 0.6rem", borderBottom: "1px solid " + t.cardBorder, paddingBottom: "0.35rem", marginBottom: "0.15rem", alignItems: "center" }}>
                  <input type="checkbox" aria-label={tr("school.team.selectAll")} checked={profSearch.visible.length > 0 && profSearch.visible.every((p) => selected.has(p.adminId))} onChange={(e) => toggleSelectVisible(e.target.checked)} style={{ width: 16, height: 16, accentColor: t.ctaBg }} />
                  <span style={colHead}>{tr("school.team.colTeacher")}</span>
                  <span style={colHead}>{tr("school.team.colEmail")}</span>
                  <span style={colHead}>{tr("school.team.navSubjects")}</span>
                  <span style={{ ...colHead, textAlign: "right" }}>{tr("school.team.colClasses")}</span>
                </div>
                {profSearch.visible.map((p) => {
                  const mine = assignmentsOf(p);
                  const subjectNames = [...new Set(mine.map((a) => a.subjectName))].join(", ");
                  const classCount = new Set(mine.map((a) => a.className)).size;
                  const checked = selected.has(p.adminId);
                  return (
                    <div key={p.adminId} style={{ display: "grid", gridTemplateColumns: "32px minmax(150px,1.5fr) minmax(150px,1.5fr) minmax(130px,1fr) 90px", gap: "0 0.6rem", alignItems: "center", padding: "0.4rem 0" }}>
                      <input type="checkbox" aria-label={p.name} checked={checked} onChange={() => toggleSelect(p.adminId)} style={{ width: 16, height: 16, accentColor: t.ctaBg }} />
                      <span style={{ minWidth: 0, display: "flex", alignItems: "center" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        {!p.confirmedForYear && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              padding: "0.1rem 0.4rem",
                              borderRadius: 99,
                              border: "1px solid " + t.cardBorder,
                              color: t.muted,
                              fontSize: "0.72rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tr("school.team.notBackYet")}
                          </span>
                        )}
                      </span>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.75 }}>{p.email ?? "—"}</span>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.75 }}>{subjectNames || "—"}</span>
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{classCount}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <ListNoMatch search={profSearch} />
        </div>
      </div>
            </>
          )}
          {section === "access" && (
            <>
      {/* Pending join requests */}
      {requests.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0 }}>{tr("school.team.requestsToJoin")} ({requests.length})</h3>
          <ListToolbar search={requestSearch} />
          <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
            <div style={{ minWidth: 480 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(140px,1fr) auto", gap: "0 0.6rem", borderBottom: "1px solid " + t.cardBorder, paddingBottom: "0.35rem", marginBottom: "0.15rem" }}>
                <span style={colHead}>{tr("school.team.colName")}</span>
                <span style={colHead}>{tr("school.team.colEmail")}</span>
                <span />
              </div>
              {requestSearch.visible.map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) minmax(140px,1fr) auto", gap: "0 0.6rem", alignItems: "center", padding: "0.35rem 0" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.75 }}>{r.email}</span>
                  <span style={{ display: "flex", gap: "0.4rem" }}>
                    <button style={btn} onClick={() => decideRequest(r, "approve")}>{tr("school.team.approve")}</button>
                    <button style={ghost} onClick={() => decideRequest(r, "reject")}>{tr("school.team.reject")}</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ListNoMatch search={requestSearch} />
        </div>
      )}

      {/* Invite codes */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>{tr("school.team.inviteTeachersHeading")}</h3>
        <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
          {tr("school.team.shareInviteIntro")}
        </p>
        <div style={{ ...zoneBand, marginTop: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", opacity: 0.85, marginRight: "auto" }}>
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
              {tr("school.team.autoApproveCheckbox")}
            </label>
            {/* The setting stays where it reads, the action moves to the edge. */}
            <button style={btn} onClick={generateInvite}>{tr("school.team.generateCodeButton")}</button>
          </div>
        </div>
        <div style={{ marginTop: "1.1rem" }}>
          {invites.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noActiveCodes")}</p>}
          {invites.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <div style={{ minWidth: 480 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 150px auto", gap: "0 0.6rem", borderBottom: "1px solid " + t.cardBorder, paddingBottom: "0.35rem", marginBottom: "0.15rem" }}>
                  <span style={colHead}>{tr("school.team.colCode")}</span>
                  <span style={colHead}>{tr("school.team.colMode")}</span>
                  <span />
                </div>
                {invites.map((inv) => (
                  <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 150px auto", gap: "0 0.6rem", alignItems: "center", padding: "0.35rem 0" }}>
                    <code style={{ fontSize: "1rem", letterSpacing: "0.05em" }}>{inv.code}</code>
                    <span style={{ opacity: 0.5, fontSize: "0.75rem" }}>
                      {inv.autoApprove ? tr("school.team.autoApproveWord") : tr("school.team.needsApprovalWord")}
                    </span>
                    <span style={{ display: "flex", gap: "0.4rem" }}>
                      <button style={ghost} onClick={() => copyInvite(inv)}>
                        {copiedId === inv.id ? tr("school.class.copied") : tr("school.team.copyLink")}
                      </button>
                      <button style={ghost} onClick={() => deactivateInvite(inv.id)}>{tr("school.class.deactivate")}</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
            </>
          )}
          {section === "assignments" && (
            <>
      {/* Assignments */}
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>
          {withCount(tr("school.team.assignmentsHeading"), assignments.length, t)}
        </h3>
        <div style={{ ...zoneBand, marginTop: "0.75rem" }}>
          <form onSubmit={addAssignment} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
        <div style={{ marginTop: "1.1rem" }}>
          {assignments.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>{tr("school.team.noAssignmentsYet")}</p>}
          <ListToolbar search={assignmentSearch} />
          {assignments.length > 0 && (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <div style={{ minWidth: 420 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(130px,1fr) minmax(100px,0.8fr) minmax(130px,1fr)", gap: "0 0.6rem", borderBottom: "1px solid " + t.cardBorder, paddingBottom: "0.35rem", marginBottom: "0.15rem" }}>
                  <span style={colHead}>{tr("school.team.colTeacher")}</span>
                  <span style={colHead}>{tr("school.team.colClass")}</span>
                  <span style={colHead}>{tr("school.team.colSubject")}</span>
                </div>
                {assignmentSearch.visible.map((a) => (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(130px,1fr) minmax(100px,0.8fr) minmax(130px,1fr)", gap: "0 0.6rem", alignItems: "center", padding: "0.35rem 0" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{a.profName}</span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.75 }}>{a.className}</span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.75 }}>{a.subjectName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ListNoMatch search={assignmentSearch} />
        </div>
      </div>
            </>
          )}
    </div>
  );
}
