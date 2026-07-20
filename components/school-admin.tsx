"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setActiveSchool } from "@/app/school/actions";
import { SchoolRaya } from "@/components/school-raya";
import { SchoolReports } from "@/components/school-reports";
import { SchoolTeam } from "@/components/school-team";
import { SchoolInsights } from "@/components/school-insights";
import { SchoolLms } from "@/components/school-lms";
import { SchoolBilling } from "@/components/school-billing";
import { COUNTRIES, SCHOOL_TYPES } from "@/lib/school-constants";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { SchoolsShell, type SchoolNavItem } from "@/components/school/schools-shell";
import { RightPanel } from "@/components/ui/shell";
import { KpiTile, MasteryGauge } from "@/components/ui/widgets";
import {
  IconOverview,
  IconClasses,
  IconKernel,
  IconSettings,
  IconChat,
  IconRooms,
  IconFile,
  IconSummary,
  IconBilling,
} from "@/components/ui/icons";
import { initialsOf } from "@/lib/name";
import type { AppTheme } from "@/components/ui/tokens";
import type {
  AdminClass,
  AdminSchool,
  ClassRoster,
  ClassSummary,
  LearningGraph,
  MembershipSummary,
  ProfInsights,
  RosterStudent,
  SchoolDashboard,
  SchoolOverview,
  SchoolRole,
  StudentDetail,
} from "@/lib/school-admin";

const pctOrDash = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const masteryColor = (m: number | null) =>
  m == null ? "#6b7794" : m >= 0.7 ? "#22c55e" : m >= 0.5 ? "#f59e0b" : "#ef4444";
const riskColor = (level: string | null) =>
  level === "high" ? "#ef4444" : level === "medium" || level === "med" ? "#f59e0b" : level === "low" || level === "ok" ? "#22c55e" : "#6b7794";

// Themed style helpers — built from the active theme via useAppTheme() inside
// each view. `mkX(t)` replace the former hardcoded module-level constants.
const mkBox = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
});
const mkInput = (t: AppTheme): React.CSSProperties => ({
  background: t.inputBg,
  color: t.text,
  border: `1px solid ${t.inputBorder}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 12.5,
  outline: "none",
});
const mkBtn = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
const mkGhost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 99,
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
});
/** Convenience: pull the theme + the four common style helpers in one call. */
function useSchoolStyles() {
  const { theme: t } = useAppTheme();
  return { t, box: mkBox(t), input: mkInput(t), btn: mkBtn(t), ghost: mkGhost(t) };
}

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

/** Country picker whose value is the ISO code stored in schools.country_code. */
function CountrySelect({
  value,
  onChange,
  disabled,
  style,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const { input } = useSchoolStyles();
  return (
    <select
      style={{ ...input, ...style }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Select a country…</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Signed-in user's own identity + their school memberships, for the sidebar
 * (profile photo + school switcher). Shared via context so every SchoolChrome
 * branch can render the switcher without threading props through each one.
 */
const SchoolUserContext = createContext<{
  avatarUrl: string | null;
  memberships: MembershipSummary[];
  activeSchoolId: string | null;
}>({ avatarUrl: null, memberships: [], activeSchoolId: null });
const useSchoolUser = () => useContext(SchoolUserContext);

export function SchoolAdmin({
  role,
  dashboard,
  profClasses,
  teacherName = "Teacher",
  profSubjects = [],
  profSchoolName = null,
  userAvatarUrl = null,
  memberships = [],
  activeSchoolId = null,
  initialTab = null,
  initialJoinCode = null,
}: {
  role: SchoolRole | null;
  dashboard: SchoolDashboard | null;
  profClasses: AdminClass[];
  /** Signed-in teacher's identity + teaching subjects, for the prof dashboard. */
  teacherName?: string;
  profSubjects?: string[];
  profSchoolName?: string | null;
  userAvatarUrl?: string | null;
  memberships?: MembershipSummary[];
  activeSchoolId?: string | null;
  initialTab?: string | null;
  initialJoinCode?: string | null;
}) {
  const dm = useDarkMode();
  const [dash, setDash] = useState<SchoolDashboard | null>(dashboard);

  const showNoMembership = role !== "prof" && !(role === "admin_master" && dash);

  return (
    <AppThemeProvider value={dm}>
     <SchoolUserContext.Provider value={{ avatarUrl: userAvatarUrl, memberships, activeSchoolId }}>
      {showNoMembership ? (
        <NoMembership initialJoinCode={initialJoinCode} />
      ) : role === "prof" ? (
        <ProfView classes={profClasses} teacherName={teacherName} subjects={profSubjects} schoolName={profSchoolName} />
      ) : (
        <Dashboard dash={dash as SchoolDashboard} setDash={setDash} initialTab={initialTab} />
      )}
     </SchoolUserContext.Provider>
    </AppThemeProvider>
  );
}

/** A concise "Teacher · Math, Physics" descriptor (or just "Teacher"). */
function teacherRoleLabel(subjects: string[]): string {
  return subjects.length > 0 ? `Teacher · ${subjects.join(", ")}` : "Teacher";
}

/**
 * The Schools cloud-shell chrome for one branch: pulls the theme from context and
 * renders the sidebar (nav → in-page tab state) + main card around `children`.
 */
function SchoolChrome({
  nav,
  activeKey,
  onNav,
  schoolName,
  profileName,
  profileSubtitle,
  headerTitle,
  headerSubtitle,
  searchPlaceholder,
  rightPanel,
  contentFlush,
  children,
}: {
  nav: SchoolNavItem[];
  activeKey: string;
  onNav: (key: string) => void;
  schoolName: string;
  /** Override the profile chip (teacher dashboard shows the teacher, not the school). */
  profileName?: string;
  profileSubtitle?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  searchPlaceholder?: string;
  rightPanel?: React.ReactNode;
  contentFlush?: boolean;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const { avatarUrl, memberships, activeSchoolId } = useSchoolUser();
  const router = useRouter();
  return (
    <SchoolsShell
      theme={theme}
      nav={nav}
      activeKey={activeKey}
      onNav={onNav}
      schoolName={schoolName}
      schoolInitials={initialsOf(profileName ?? schoolName)}
      profileName={profileName}
      profileSubtitle={profileSubtitle}
      profileAvatarUrl={avatarUrl}
      roleSwitch={<SchoolSwitcher memberships={memberships} activeSchoolId={activeSchoolId} />}
      onProfile={() => router.push("/account")}
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      searchPlaceholder={searchPlaceholder}
      rightPanel={rightPanel}
      contentFlush={contentFlush}
    >
      {children}
    </SchoolsShell>
  );
}

/**
 * Sidebar school switcher for multi-school users: lists every school the user
 * belongs to and switches the active one via the `setActiveSchool` server action.
 * Only renders when the user has more than one school. (Creating a school happens
 * in RAYA / the profile; a teacher adds more schools by code in their dashboard.)
 */
function SchoolSwitcher({
  memberships,
  activeSchoolId,
}: {
  memberships: MembershipSummary[];
  activeSchoolId: string | null;
}) {
  const { theme: t } = useAppTheme();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (memberships.length <= 1) return null;

  function switchTo(schoolId: string) {
    if (schoolId === activeSchoolId || pending) return;
    startTransition(async () => {
      await setActiveSchool(schoolId);
      router.refresh();
    });
  }

  const roleLabel = (r: SchoolRole) => (r === "admin_master" ? "Admin" : "Teacher");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 6px" }}>
      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em", color: t.sidebarMuted, marginBottom: 2 }}>
        My schools
      </div>
      {memberships.map((m) => {
        const active = m.schoolId === activeSchoolId;
        return (
          <button
            key={m.schoolId}
            onClick={() => switchTo(m.schoolId)}
            disabled={pending}
            title={m.schoolName}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              textAlign: "left",
              background: active ? t.sidebarActiveBg : "transparent",
              border: `1px solid ${active ? t.sidebarBorder : "transparent"}`,
              borderRadius: 9,
              padding: "6px 8px",
              cursor: active || pending ? "default" : "pointer",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                flex: "none",
                borderRadius: 6,
                background: active ? "#2f7fe0" : t.cardBg2,
                color: active ? "#fff" : t.sidebarMuted,
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initialsOf(m.schoolName)}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: t.sidebarText }}>
              {m.schoolName}
            </span>
            <span style={{ fontSize: 8.5, color: t.sidebarMuted, flex: "none" }}>{roleLabel(m.role)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * No school yet: join with a staff invite code. Creating a school lives in RAYA
 * (the profile), where every user is — so we point there rather than duplicating
 * the create form here.
 */
function NoMembership({ initialJoinCode }: { initialJoinCode: string | null }) {
  const { t } = useSchoolStyles();
  return (
    <SchoolChrome nav={[]} activeKey="" onNav={() => {}} schoolName="School" headerTitle="School">
      <JoinSchool initialCode={initialJoinCode} />
      <p style={{ fontSize: 12.5, color: t.muted, marginTop: 16 }}>
        Want to run your own school?{" "}
        <Link href="/profile" style={{ color: "#2f7fe0", fontWeight: 600 }}>
          Create one from your profile →
        </Link>
      </p>
    </SchoolChrome>
  );
}

function JoinSchool({ initialCode }: { initialCode: string | null }) {
  const { box, input, btn } = useSchoolStyles();
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = (await postJson("/api/school/join-team", { code: code.trim() })) as {
        status: "joined" | "requested" | "already";
        schoolName: string | null;
      };
      const where = d.schoolName ? ` ${d.schoolName}` : "";
      if (d.status === "requested") {
        setMsg(`Request sent to${where}. You'll get access once an admin approves it.`);
      } else {
        // joined or already a member — land in that school (now the active one).
        setMsg(`You're in${where}. Loading…`);
        router.push("/school");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join with that code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={box} onSubmit={submit}>
      <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.25rem" }}>Join a school as a teacher</h2>
      <p style={{ margin: "0 0 0.85rem", opacity: 0.6, fontSize: "0.9rem" }}>
        Got an invite code from your school? Enter it to join.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200, letterSpacing: "0.05em" }}
          placeholder="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={busy}
        />
        <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      {msg && <p style={{ color: "#22c55e", margin: "0.75rem 0 0" }}>{msg}</p>}
      {error && <p style={{ color: "#f87171", margin: "0.75rem 0 0" }}>{error}</p>}
    </form>
  );
}

/**
 * Prof-dashboard affordance to link to *another* school: a teacher can belong to
 * several schools — they just add each one's staff invite code here. On success
 * the new school becomes active (join-team sets the cookie) and we reload into it.
 */
function AddSchoolByCode() {
  const { box, input, btn } = useSchoolStyles();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = (await postJson("/api/school/join-team", { code: code.trim() })) as {
        status: "joined" | "requested" | "already";
        schoolName: string | null;
      };
      const where = d.schoolName ? ` ${d.schoolName}` : "";
      if (d.status === "requested") {
        setMsg(`Request sent to${where}. You'll get access once an admin approves it.`);
        setCode("");
      } else {
        setMsg(`You're in${where}. Switching…`);
        router.push("/school");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join with that code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={{ ...box, marginTop: 24 }} onSubmit={submit}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700 }}>＋ Add another school</h3>
      <p style={{ margin: "0 0 10px", opacity: 0.6, fontSize: 11.5 }}>
        Teach at more than one school? Enter another school&apos;s invite code to link it — you can
        switch between them from the sidebar.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 180, letterSpacing: "0.05em" }}
          placeholder="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={busy}
        />
        <button type="submit" style={{ ...btn, opacity: busy || !code.trim() ? 0.6 : 1 }} disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Add school"}
        </button>
      </div>
      {msg && <p style={{ color: "#22c55e", margin: "10px 0 0", fontSize: 12 }}>{msg}</p>}
      {error && <p style={{ color: "#f87171", margin: "10px 0 0", fontSize: 12 }}>{error}</p>}
    </form>
  );
}

type ProfTab = "classes" | "insights" | "raya";

function ProfView({
  classes,
  teacherName,
  subjects,
  schoolName,
}: {
  classes: AdminClass[];
  teacherName: string;
  subjects: string[];
  schoolName: string | null;
}) {
  const { t, box, ghost } = useSchoolStyles();
  const { memberships, activeSchoolId } = useSchoolUser();
  const [tab, setTab] = useState<ProfTab>("classes");
  const [directives, setDirectives] = useState<{ id: string; content: string }[]>([]);
  const [nav, setNav] = useState<
    | { mode: "list" }
    | { mode: "class"; roster: ClassRoster }
    | { mode: "student"; detail: StudentDetail; onBack: () => void }
  >({ mode: "list" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // School directives aimed at teachers — informational, aligns their own recs.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/school/directives");
        const d = await r.json();
        if (r.ok) setDirectives(d.directives ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function openClass(classId: string) {
    setBusy(true);
    setError(null);
    try {
      const roster = (await (await fetch(`/api/school/roster?classId=${classId}`)).json()) as ClassRoster;
      setNav({ mode: "class", roster });
    } catch {
      setError("Could not load the class.");
    } finally {
      setBusy(false);
    }
  }

  async function openStudent(classId: string, userId: string, onBack: () => void) {
    setBusy(true);
    setError(null);
    try {
      const detail = (await (
        await fetch(`/api/school/student?classId=${classId}&userId=${userId}`)
      ).json()) as StudentDetail;
      setNav({ mode: "student", detail, onBack });
    } catch {
      setError("Could not load the student.");
    } finally {
      setBusy(false);
    }
  }

  // The school the teacher is currently viewing (server prop, else the active
  // membership) — surfaced in the header so their teaching hat is explicit.
  const resolvedSchool =
    schoolName ||
    memberships.find((m) => m.schoolId === activeSchoolId)?.schoolName ||
    memberships[0]?.schoolName ||
    "your school";
  const roleLabel = teacherRoleLabel(subjects);

  const navItems: SchoolNavItem[] = [
    { key: "classes", label: "Classes", icon: <IconClasses /> },
    { key: "insights", label: "Insights", icon: <IconKernel /> },
    { key: "raya", label: "RAYA", icon: <IconChat /> },
  ];
  const goTab = (k: string) => {
    setTab(k as ProfTab);
    setNav({ mode: "list" });
  };

  // The RAYA tab is a full-height conversational surface — it owns the whole card
  // body (no page padding) when we're on that tab at the top level.
  const rayaFullScreen = tab === "raya" && nav.mode === "list";

  let body: React.ReactNode;
  if (nav.mode === "student") {
    body = <StudentDetailView detail={nav.detail} onBack={nav.onBack} />;
  } else if (nav.mode === "class") {
    const roster = nav.roster;
    body = (
      <RosterView
        roster={roster}
        busy={busy}
        error={error}
        onBack={() => setNav({ mode: "list" })}
        onStudent={(userId) =>
          openStudent(roster.classId, userId, () => setNav({ mode: "class", roster }))
        }
      />
    );
  } else if (tab === "raya") {
    body = <SchoolRaya fill teacher={{ name: teacherName, subjects, schoolName: resolvedSchool }} />;
  } else if (tab === "insights") {
    body = <ProfInsightsView onStudent={(classId, userId) => openStudent(classId, userId, () => setTab("insights"))} />;
  } else {
    body = (
      <>
        <TeacherBanner name={teacherName} subjects={subjects} schoolName={resolvedSchool} classCount={classes.length} />
        {directives.length > 0 && (
          <div style={{ border: `1px solid ${t.cardBorder}`, background: t.cardBg2, borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: t.muted, marginBottom: 6 }}>📌 From your school</div>
            {directives.map((d) => (
              <div key={d.id} style={{ fontSize: 12.5 }}>{d.content}</div>
            ))}
          </div>
        )}
        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
        {busy && <p style={{ color: t.muted, fontSize: 12.5 }}>Loading…</p>}
        {classes.length === 0 ? (
          <div style={box}>
            <p style={{ margin: 0, color: t.muted, fontSize: 12.5 }}>
              You don&apos;t have any assigned classes yet. Your administrator assigns you classes and subjects.
            </p>
          </div>
        ) : (
          classes.map((c) => (
            <div key={c.id} style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {c.name}
                  {c.level ? <span style={{ opacity: 0.5, fontWeight: 400 }}> · {c.level}</span> : null}
                </div>
                <div style={{ opacity: 0.55, fontSize: 11.5 }}>{c.studentCount} students</div>
              </div>
              <button style={ghost} onClick={() => openClass(c.id)} disabled={busy}>
                Open →
              </button>
            </div>
          ))
        )}
        <AddSchoolByCode />
      </>
    );
  }

  return (
    <SchoolChrome
      nav={navItems}
      activeKey={tab}
      onNav={goTab}
      schoolName={resolvedSchool}
      profileName={teacherName}
      profileSubtitle={roleLabel}
      headerTitle={rayaFullScreen ? "RAYA for Schools" : "Teacher dashboard"}
      headerSubtitle={`${resolvedSchool} · ${roleLabel}`}
      searchPlaceholder={rayaFullScreen ? undefined : "Search students, classes..."}
      contentFlush={rayaFullScreen}
    >
      {body}
    </SchoolChrome>
  );
}

/**
 * The teacher's "double-hat" banner: makes explicit that this dashboard is RAYA
 * extended for someone who also teaches — showing who they are, the subject(s)
 * they teach, and at which school.
 */
function TeacherBanner({
  name,
  subjects,
  schoolName,
  classCount,
}: {
  name: string;
  subjects: string[];
  schoolName: string;
  classCount: number;
}) {
  const { theme: t } = useAppTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${t.cardBorder}`,
        background: t.cardBg2,
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          flex: "none",
          borderRadius: 12,
          background: "linear-gradient(135deg,#2f7fe0,#173d8a)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initialsOf(name)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
          {name}
          <span style={{ fontWeight: 500, color: t.muted }}>
            {" "}· Teacher{subjects.length > 0 ? ` of ${subjects.join(", ")}` : ""}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: t.mutedLight, marginTop: 2 }}>
          {schoolName} · {classCount} {classCount === 1 ? "class" : "classes"} · your RAYA, extended for teaching
        </div>
      </div>
    </div>
  );
}

/** Read-only insights + at-risk feed for a teacher's assigned classes. */
function ProfInsightsView({ onStudent }: { onStudent: (classId: string, userId: string) => void }) {
  const { box, ghost } = useSchoolStyles();
  const [data, setData] = useState<ProfInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/school/prof-insights");
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? "Could not load insights.");
        setData(d as ProfInsights);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load insights.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ opacity: 0.6 }}>Loading…</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!data) return null;

  return (
    <div>
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>At-risk students</h3>
        {data.alerts.length === 0 ? (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>No students need attention right now.</p>
        ) : (
          data.alerts.map((a) => (
            <div
              key={`${a.classId}:${a.userId}`}
              style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: riskColor(a.riskLevel), flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                {a.name}
                <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>
                  {" "}· {a.className} · {a.statusLabel ?? "at risk"} · {pctOrDash(a.avgMastery)}
                </span>
              </span>
              <button style={ghost} onClick={() => onStudent(a.classId, a.userId)}>Open →</button>
            </div>
          ))
        )}
      </div>

      <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Class insights</h3>
      {data.insights.length === 0 ? (
        <div style={box}>
          <p style={{ margin: 0, opacity: 0.65 }}>
            No certified insights yet — they appear once your students have enough activity.
          </p>
        </div>
      ) : (
        data.insights.map((ins) => (
          <div key={ins.id} style={box}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <strong>{ins.className}</strong>
              <span style={{ opacity: 0.6 }}>· {ins.subjectName}</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: masteryColor(ins.avgMastery) }}>{pctOrDash(ins.avgMastery)}</span>
            </div>
            {ins.topGaps.length > 0 && (
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
                <span style={{ opacity: 0.6 }}>Top gaps:</span> {ins.topGaps.join(", ")}
              </p>
            )}
            {ins.topRecommendation && (
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem" }}>
                <span style={{ opacity: 0.6 }}>Recommendation:</span> {ins.topRecommendation}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

type Directive = { id: string; content: string; audience: string; isActive: boolean };
const AUDIENCE_LABEL: Record<string, string> = {
  students: "Students",
  teachers: "Teachers",
  both: "Everyone",
};

/** Admin authoring of school-wide directives broadcast through RAYA. */
function SchoolDirectives() {
  const { box, input, btn, ghost } = useSchoolStyles();
  const [items, setItems] = useState<Directive[]>([]);
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/school/directives");
        const d = await r.json();
        if (r.ok) setItems(d.directives ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = (await postJson("/api/school/directives", { content, audience })) as Directive;
      setItems((v) => [d, ...v]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the directive.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: Directive) {
    setError(null);
    try {
      await postJson("/api/school/directives", { id: it.id, isActive: !it.isActive }, "PATCH");
      setItems((v) => v.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/school/directives?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not delete.");
      setItems((v) => v.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>School directives</h3>
      <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
        School-wide guidance RAYA passes on to your students (as a soft recommendation) and shows
        to your teachers. It never overrides RAYA&apos;s rules.
      </p>
      {error && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}
      {items.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No directives yet.</p>}
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}>
          <span style={{ flex: 1, opacity: it.isActive ? 1 : 0.45 }}>
            {it.content}
            <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>
              {" "}· {AUDIENCE_LABEL[it.audience] ?? it.audience}
            </span>
          </span>
          <button style={ghost} onClick={() => toggle(it)}>{it.isActive ? "Disable" : "Enable"}</button>
          <button
            onClick={() => remove(it.id)}
            title="Delete"
            style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200 }}
          placeholder="e.g. Exam-revision week — prioritise past-paper practice"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        <select style={input} value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="both">Everyone</option>
          <option value="students">Students</option>
          <option value="teachers">Teachers</option>
        </select>
        <button type="submit" style={btn} disabled={busy || !content.trim()}>Add</button>
      </form>
    </div>
  );
}

function SchoolSettings({
  school,
  onUpdated,
}: {
  school: AdminSchool;
  onUpdated: (s: AdminSchool) => void;
}) {
  const { t, box, input, btn, ghost } = useSchoolStyles();
  const [name, setName] = useState(school.name);
  const [city, setCity] = useState(school.city ?? "");
  const [countryCode, setCountryCode] = useState(school.countryCode ?? "");
  const [schoolType, setSchoolType] = useState(school.schoolType ?? "");
  const [email, setEmail] = useState(school.email ?? "");
  const [phone, setPhone] = useState(school.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = await postJson(
        "/api/school/settings",
        { name, city, countryCode, schoolType, email, phone },
        "PATCH",
      );
      onUpdated({
        ...school,
        name: d.name,
        city: d.city,
        countryCode: d.countryCode,
        schoolType: d.schoolType,
        email: d.email,
        phone: d.phone,
        logoUrl: d.logoUrl ?? school.logoUrl,
      });
      setMsg("Saved ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/school/logo", { method: "POST", body: fd });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error ?? "Could not upload the logo.");
        return;
      }
      onUpdated({ ...school, logoUrl: d.logoUrl });
      setMsg("Logo updated ✓");
    } catch {
      setError("Could not upload the logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={box} onSubmit={save}>
      <h3 style={{ margin: "0 0 0.85rem", fontSize: "1.05rem" }}>School info</h3>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            overflow: "hidden",
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            (school.name || "?").charAt(0).toUpperCase()
          )}
        </div>
        <label style={{ ...ghost, display: "inline-block" }}>
          {busy ? "Uploading…" : "Change logo"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
        <label style={{ gridColumn: "1 / -1", fontSize: "0.8rem", opacity: 0.6 }}>
          Name
          <input style={{ ...input, width: "100%", marginTop: 4 }} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          City
          <input style={{ ...input, width: "100%", marginTop: 4 }} value={city} onChange={(e) => setCity(e.target.value)} disabled={busy} />
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Country
          <CountrySelect
            value={countryCode}
            onChange={setCountryCode}
            disabled={busy}
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Type
          <select
            style={{ ...input, width: "100%", marginTop: 4 }}
            value={schoolType}
            onChange={(e) => setSchoolType(e.target.value)}
            disabled={busy}
          >
            <option value="">—</option>
            {SCHOOL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Contact email
          <input style={{ ...input, width: "100%", marginTop: 4 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Phone
          <input style={{ ...input, width: "100%", marginTop: 4 }} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.9rem" }}>
        <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg && <span style={{ color: "#22c55e", fontSize: "0.85rem" }}>{msg}</span>}
        {error && <span style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</span>}
      </div>
    </form>
  );
}

type DashTab = "overview" | "manage" | "team" | "insights" | "lms" | "raya" | "reports" | "billing" | "settings";
const DASH_TABS: DashTab[] = ["overview", "manage", "team", "insights", "lms", "raya", "reports", "billing", "settings"];

function Dashboard({
  dash,
  setDash,
  initialTab = null,
}: {
  dash: SchoolDashboard;
  setDash: (d: SchoolDashboard) => void;
  initialTab?: string | null;
}) {
  const { t, box, input, btn, ghost } = useSchoolStyles();
  const router = useRouter();
  const [className, setClassName] = useState("");
  const [level, setLevel] = useState("");
  const [effectif, setEffectif] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setClasses = (classes: AdminClass[]) => setDash({ ...dash, classes });

  // Drill-down: class list → roster → one student.
  type Nav =
    | { mode: "list" }
    | { mode: "class"; roster: ClassRoster }
    | { mode: "student"; detail: StudentDetail; roster: ClassRoster };
  const [nav, setNav] = useState<Nav>({ mode: "list" });
  const [navBusy, setNavBusy] = useState(false);

  const [tab, setTab] = useState<DashTab>(
    (DASH_TABS as string[]).includes(initialTab ?? "") ? (initialTab as DashTab) : "overview",
  );
  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [overviewBusy, setOverviewBusy] = useState(false);

  async function fetchOverview() {
    if (overview || overviewBusy) return;
    setOverviewBusy(true);
    try {
      setOverview((await (await fetch("/api/school/overview")).json()) as SchoolOverview);
    } catch {
      setError("Could not load the overview.");
    } finally {
      setOverviewBusy(false);
    }
  }
  function showOverview() {
    setTab("overview");
    void fetchOverview();
  }

  // Preload the overview once on mount without forcing the active tab.
  useEffect(() => {
    void fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openClass(classId: string) {
    setNavBusy(true);
    setError(null);
    try {
      const roster = (await (await fetch(`/api/school/roster?classId=${classId}`)).json()) as ClassRoster;
      setNav({ mode: "class", roster });
    } catch {
      setError("Could not load the class.");
    } finally {
      setNavBusy(false);
    }
  }

  async function openStudent(roster: ClassRoster, userId: string) {
    setNavBusy(true);
    setError(null);
    try {
      const detail = (await (
        await fetch(`/api/school/student?classId=${roster.classId}&userId=${userId}`)
      ).json()) as StudentDetail;
      setNav({ mode: "student", detail, roster });
    } catch {
      setError("Could not load the student.");
    } finally {
      setNavBusy(false);
    }
  }

  async function startNewYear() {
    if (busy) return;
    if (
      !window.confirm(
        "Start a new school year? New classes will start fresh — this year's classes and students stay archived under the current year.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/school/year", {});
      // Reload so the dashboard re-fetches the (now empty) new year's classes.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a new year.");
      setBusy(false);
    }
  }

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !className.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const expectedSize = effectif.trim() === "" ? null : Number(effectif);
      const c = (await postJson("/api/school/classes", {
        name: className,
        level,
        expectedSize,
      })) as AdminClass;
      setClasses([...dash.classes, c]);
      setClassName("");
      setLevel("");
      setEffectif("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the class.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEffectif(classId: string, expectedSize: number | null) {
    setError(null);
    const d = (await postJson("/api/school/classes", { classId, expectedSize }, "PATCH")) as {
      expectedSize: number | null;
      capacity: number | null;
    };
    setClasses(
      dash.classes.map((c) =>
        c.id === classId ? { ...c, expectedSize: d.expectedSize, capacity: d.capacity } : c,
      ),
    );
  }

  async function genCode(classId: string) {
    setError(null);
    try {
      const code = (await postJson("/api/school/codes", { classId })) as AdminClass["codes"][number];
      // The server retired any prior code — replace, don't append (one code per class).
      setClasses(dash.classes.map((c) => (c.id === classId ? { ...c, codes: [code] } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a code.");
    }
  }

  async function toggleCode(classId: string, codeId: string, isActive: boolean) {
    setError(null);
    try {
      await postJson("/api/school/codes", { codeId, isActive }, "PATCH");
      setClasses(
        dash.classes.map((c) =>
          c.id === classId
            ? { ...c, codes: c.codes.map((k) => (k.id === codeId ? { ...k, isActive } : k)) }
            : c,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the code.");
    }
  }

  const navItems: SchoolNavItem[] = [
    { key: "overview", label: "Overview", icon: <IconOverview /> },
    { key: "manage", label: "Classes & codes", icon: <IconClasses /> },
    { key: "team", label: "Team", icon: <IconRooms /> },
    { key: "insights", label: "Insights", icon: <IconKernel /> },
    { key: "lms", label: "LMS", icon: <IconFile /> },
    { key: "raya", label: "RAYA", icon: <IconChat /> },
    { key: "reports", label: "Reports", icon: <IconSummary /> },
    { key: "billing", label: "Billing", icon: <IconBilling /> },
    { key: "settings", label: "Settings", icon: <IconSettings /> },
  ];
  const goTab = (k: string) => {
    setNav({ mode: "list" });
    if (k === "overview") showOverview();
    else setTab(k as DashTab);
  };

  const tabContent =
    tab === "raya" ? (
      <>
        <SchoolDirectives />
        <SchoolRaya />
      </>
    ) : tab === "settings" ? (
      <SchoolSettings school={dash.school} onUpdated={(school) => setDash({ ...dash, school })} />
    ) : tab === "team" ? (
      <SchoolTeam classes={dash.classes.map((c) => ({ id: c.id, name: c.name }))} />
    ) : tab === "insights" ? (
      <SchoolInsights />
    ) : tab === "lms" ? (
      <SchoolLms classes={dash.classes.map((c) => ({ id: c.id, name: c.name }))} />
    ) : tab === "reports" ? (
      <SchoolReports classes={dash.classes.map((c) => ({ id: c.id, name: c.name }))} />
    ) : tab === "billing" ? (
      <SchoolBilling />
    ) : tab === "overview" ? (
      <OverviewView school={dash.school.name} overview={overview} busy={overviewBusy} onClass={(id) => openClass(id)} />
    ) : (
      <>
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, margin: 0, color: t.text }}>{dash.school.name}</h2>
            <p style={{ margin: "4px 0 0", color: t.muted, fontSize: 12 }}>
              {dash.school.currentYearLabel ? `Year ${dash.school.currentYearLabel} · ` : ""}
              {dash.classes.length} {dash.classes.length === 1 ? "class" : "classes"}
            </p>
          </div>
          <button style={ghost} onClick={startNewYear} disabled={busy}>
            New year
          </button>
        </div>

        <form style={box} onSubmit={addClass}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, color: t.text }}>Add a class</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input style={{ ...input, flex: 2, minWidth: 160 }} placeholder="Class name (e.g. 6th A)" value={className} onChange={(e) => setClassName(e.target.value)} disabled={busy} />
            <input style={{ ...input, flex: 1, minWidth: 110 }} placeholder="Level (optional)" value={level} onChange={(e) => setLevel(e.target.value)} disabled={busy} />
            <input type="number" min={1} max={1000} style={{ ...input, width: 130 }} placeholder="Class size (n)" title="Class size. The cap is n + 5." value={effectif} onChange={(e) => setEffectif(e.target.value)} disabled={busy} />
            <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !className.trim()}>
              Add
            </button>
          </div>
          <p style={{ margin: "8px 0 0", color: t.mutedLight, fontSize: 11 }}>
            The class size is the number you set. Students can join up to <strong>n + 5</strong>.
          </p>
        </form>

        {navBusy && <p style={{ color: t.muted, fontSize: 12.5 }}>Loading…</p>}

        {dash.classes.map((c) => (
          <ClassCard key={c.id} c={c} onGenCode={genCode} onToggleCode={toggleCode} onSetEffectif={updateEffectif} onOpen={() => openClass(c.id)} />
        ))}
      </>
    );

  let body: React.ReactNode;
  if (nav.mode === "student") {
    body = <StudentDetailView detail={nav.detail} onBack={() => setNav({ mode: "class", roster: nav.roster })} />;
  } else if (nav.mode === "class") {
    body = (
      <RosterView
        roster={nav.roster}
        busy={navBusy}
        error={error}
        onBack={() => setNav({ mode: "list" })}
        onStudent={(userId) => openStudent(nav.roster, userId)}
      />
    );
  } else {
    body = (
      <>
        {error && <p style={{ color: "#f87171", fontSize: 12.5 }}>{error}</p>}
        {tabContent}
      </>
    );
  }

  return (
    <SchoolChrome
      nav={navItems}
      activeKey={nav.mode === "list" ? tab : ""}
      onNav={goTab}
      schoolName={dash.school.name}
      headerTitle="School"
      searchPlaceholder="Search students, classes..."
      rightPanel={nav.mode === "list" && tab === "overview" && overview ? <OverviewRightPanel overview={overview} /> : undefined}
    >
      {body}
    </SchoolChrome>
  );
}

function OverviewView({
  school,
  overview,
  busy,
  onClass,
}: {
  school: string;
  overview: SchoolOverview | null;
  busy: boolean;
  onClass: (classId: string) => void;
}) {
  const { t, box } = useSchoolStyles();
  if (busy && !overview) return <p style={{ color: t.muted, fontSize: 12.5 }}>Loading overview…</p>;
  if (!overview) return <p style={{ color: t.muted, fontSize: 12.5 }}>No overview available.</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <KpiTile theme={t} label="Students" value={overview.totals.students} shine />
        <KpiTile theme={t} label="Active (7d)" value={overview.totals.active} shine />
        <KpiTile theme={t} label="Struggling" value={overview.totals.alerts} />
        <KpiTile theme={t} label="Average mastery" value={pctOrDash(overview.totals.avgMastery)} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: "0 0 10px" }}>{school} · by class</div>

      {overview.classes.length === 0 ? (
        <div style={box}>
          <p style={{ margin: 0, color: t.muted, fontSize: 12.5 }}>
            No classes. Add one in “Classes &amp; codes”.
          </p>
        </div>
      ) : (
        overview.classes.map((c) => <OverviewClassRow key={c.id} c={c} onOpen={() => onClass(c.id)} />)
      )}
    </div>
  );
}

function OverviewClassRow({ c, onOpen }: { c: ClassSummary; onOpen: () => void }) {
  const { t, box, ghost } = useSchoolStyles();
  return (
    <div style={{ ...box, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: t.text }}>{c.name}</div>
        <div style={{ color: t.mutedLight, fontSize: 11.5 }}>
          {c.studentCount} students · {c.active} active
        </div>
      </div>
      {c.alerts > 0 && (
        <span
          style={{
            background: t.dark ? "#3a1a1a" : "#fee2e2",
            color: "#dc2626",
            borderRadius: 999,
            padding: "2px 9px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {c.alerts} alert{c.alerts === 1 ? "" : "s"}
        </span>
      )}
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 70, height: 6, borderRadius: 99, background: t.gaugeTrack, overflow: "hidden" }}>
          <span style={{ display: "block", width: `${Math.round((c.avgMastery ?? 0) * 100)}%`, height: "100%", background: masteryColor(c.avgMastery) }} />
        </span>
        <span style={{ color: t.text, fontSize: 11.5, width: 40, textAlign: "right" }}>{pctOrDash(c.avgMastery)}</span>
      </span>
      <button style={ghost} onClick={onOpen}>
        Open →
      </button>
    </div>
  );
}

/** Admin Overview right panel — grounded in the real school overview snapshot. */
function OverviewRightPanel({ overview }: { overview: SchoolOverview }) {
  const { theme: t } = useAppTheme();
  const avg = overview.totals.avgMastery;
  const weak = [...overview.classes]
    .filter((c) => c.avgMastery != null)
    .sort((a, b) => (a.avgMastery ?? 1) - (b.avgMastery ?? 1))
    .slice(0, 2);
  const card: React.CSSProperties = { border: `1px solid ${t.cardBorder}`, borderRadius: 20, padding: 16, background: t.cardBg2 };
  const title: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 10, color: t.text };
  const insight: React.CSSProperties = { background: t.rowActiveBg, borderRadius: 12, padding: 12, marginBottom: 8 };
  return (
    <RightPanel theme={t} width={300}>
      <div style={card}>
        <div style={title}>Kernel — overall mastery</div>
        <MasteryGauge
          theme={t}
          valueLabel={pctOrDash(avg)}
          caption={`${overview.totals.students} students tracked`}
          dashoffset={avg != null ? 188 * (1 - avg) : 188}
        />
      </div>
      <div style={card}>
        <div style={title}>Alerts</div>
        <div style={{ ...insight, marginBottom: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
            {overview.totals.alerts} student{overview.totals.alerts === 1 ? "" : "s"} struggling
          </div>
          <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>{overview.totals.active} active over 7 days</div>
        </div>
      </div>
      {weak.length > 0 && (
        <div style={card}>
          <div style={title}>Classes to watch</div>
          {weak.map((c) => (
            <div key={c.id} style={insight}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{c.name}</div>
              <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>
                Mastery {pctOrDash(c.avgMastery)} · {c.alerts} alert{c.alerts === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}
    </RightPanel>
  );
}

function ClassCard({
  c,
  onGenCode,
  onToggleCode,
  onSetEffectif,
  onOpen,
}: {
  c: AdminClass;
  onGenCode: (classId: string) => void;
  onToggleCode: (classId: string, codeId: string, isActive: boolean) => void;
  onSetEffectif: (classId: string, expectedSize: number | null) => Promise<void>;
  onOpen: () => void;
}) {
  const { box, input, ghost } = useSchoolStyles();
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.expectedSize != null ? String(c.expectedSize) : "");
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied((v) => (v === code ? null : v)), 1500);
    });
  }

  async function saveEffectif() {
    if (saving) return;
    setSaving(true);
    setEditErr(null);
    try {
      const expectedSize = draft.trim() === "" ? null : Number(draft);
      await onSetEffectif(c.id, expectedSize);
      setEditing(false);
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, flex: 1 }}>
          {c.name}
          {c.level ? <span style={{ opacity: 0.5, fontWeight: 400 }}> · {c.level}</span> : null}
        </h3>
        {editing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <input
              type="number"
              min={1}
              max={1000}
              autoFocus
              placeholder="n (blank = no limit)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEffectif();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{ ...input, width: 120, padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
              disabled={saving}
            />
            <button style={ghost} onClick={saveEffectif} disabled={saving}>
              {saving ? "…" : "Save"}
            </button>
            <button
              style={{ ...ghost, background: "transparent" }}
              onClick={() => {
                setEditing(false);
                setDraft(c.expectedSize != null ? String(c.expectedSize) : "");
                setEditErr(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </span>
        ) : (
          <>
            <span
              style={{
                opacity: 0.6,
                fontSize: "0.85rem",
                color: c.capacity != null && c.studentCount >= c.capacity ? "#f59e0b" : undefined,
              }}
              title={
                c.expectedSize != null
                  ? `Size ${c.expectedSize} · cap ${c.capacity} (n+5)`
                  : "No size limit set"
              }
            >
              {c.studentCount}
              {c.capacity != null ? ` / ${c.capacity}` : ""}{" "}
              {c.studentCount === 1 && c.capacity == null ? "student" : "students"}
            </span>
            <button
              style={{ ...ghost, padding: "0.3rem 0.55rem" }}
              onClick={() => setEditing(true)}
              title="Edit the class size"
            >
              {c.expectedSize != null ? "Size ✎" : "+ Size"}
            </button>
          </>
        )}
        <button style={ghost} onClick={onOpen}>
          Open →
        </button>
      </div>
      {editErr && <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.4rem 0 0" }}>{editErr}</p>}

      <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {c.codes.length === 0 && (
          <p style={{ opacity: 0.5, fontSize: "0.85rem", margin: 0 }}>No access code yet.</p>
        )}
        {c.codes.map((k) => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <code
              style={{
                fontSize: "1.05rem",
                letterSpacing: "0.12em",
                fontWeight: 700,
                opacity: k.isActive ? 1 : 0.4,
                textDecoration: k.isActive ? "none" : "line-through",
              }}
            >
              {k.code}
            </code>
            <button style={ghost} onClick={() => copy(k.code)}>
              {copied === k.code ? "Copied ✓" : "Copy"}
            </button>
            <button style={ghost} onClick={() => onToggleCode(c.id, k.id, !k.isActive)}>
              {k.isActive ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>

      <button
        style={{ ...ghost, marginTop: "0.75rem" }}
        onClick={() => {
          // Regenerating retires the current code for good — confirm first.
          if (
            c.codes.length > 0 &&
            !window.confirm(
              "This permanently deactivates the current code — students who already joined keep their access. Continue?",
            )
          ) {
            return;
          }
          onGenCode(c.id);
        }}
      >
        {c.codes.length > 0 ? "Regenerate code" : "+ Generate code"}
      </button>
    </div>
  );
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function RosterView({
  roster,
  busy,
  error,
  onBack,
  onStudent,
}: {
  roster: ClassRoster;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onStudent: (userId: string) => void;
}) {
  const { box, ghost } = useSchoolStyles();
  const alerts = roster.students.filter(
    (s) => s.riskLevel === "high" || s.riskLevel === "medium" || s.riskLevel === "med",
  ).length;
  const withMastery = roster.students.filter((s) => s.avgMastery != null);
  const avg =
    withMastery.length > 0
      ? withMastery.reduce((a, s) => a + (s.avgMastery ?? 0), 0) / withMastery.length
      : null;

  return (
    <div>
      <button style={{ ...ghost, marginBottom: "1rem" }} onClick={onBack}>
        ← Back to classes
      </button>
      <div style={box}>
        <h2 style={{ margin: 0 }}>{roster.className}</h2>
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.6rem", fontSize: "0.9rem" }}>
          <span>
            <strong>{roster.students.length}</strong> <span style={{ opacity: 0.6 }}>students</span>
          </span>
          <span>
            <strong style={{ color: alerts ? "#f87171" : "inherit" }}>{alerts}</strong>{" "}
            <span style={{ opacity: 0.6 }}>need attention</span>
          </span>
          <span>
            <strong>{pctOrDash(avg)}</strong> <span style={{ opacity: 0.6 }}>avg mastery</span>
          </span>
        </div>
      </div>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {roster.students.length === 0 ? (
        <div style={box}>
          <p style={{ margin: 0, opacity: 0.65 }}>
            No students have joined this class yet. Share an access code so they can link their
            account.
          </p>
        </div>
      ) : (
        roster.students.map((s) => (
          <RosterRow key={s.userId} s={s} busy={busy} onOpen={() => onStudent(s.userId)} />
        ))
      )}

      <InstructionsPanel classId={roster.classId} />
    </div>
  );
}

type Instruction = { id: string; content: string; isActive: boolean; subjectId: string | null; subjectName: string | null };
type SubjectOpt = { id: string; name: string };

/** Teacher instructions that steer RAYA for this class (admin_master or assigned prof). */
function InstructionsPanel({ classId }: { classId: string }) {
  const { box, input, btn, ghost } = useSchoolStyles();
  const [items, setItems] = useState<Instruction[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/school/instructions?classId=${encodeURIComponent(classId)}`);
        const d = await r.json();
        if (r.ok) {
          setItems(d.instructions ?? []);
          setSubjects(d.subjects ?? []);
        }
      } catch {
        // leave empty
      }
    })();
  }, [classId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = (await postJson("/api/school/instructions", {
        classId,
        subjectId: subjectId || null,
        content,
      })) as Instruction;
      const subjectName = subjects.find((s) => s.id === d.subjectId)?.name ?? null;
      setItems((v) => [{ ...d, subjectName }, ...v]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the instruction.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(it: Instruction) {
    setError(null);
    try {
      await postJson("/api/school/instructions", { id: it.id, isActive: !it.isActive }, "PATCH");
      setItems((v) => v.map((x) => (x.id === it.id ? { ...x, isActive: !x.isActive } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/school/instructions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not delete.");
      setItems((v) => v.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>Instructions to RAYA</h3>
      <p style={{ opacity: 0.6, fontSize: "0.82rem", marginTop: 0 }}>
        Focus areas RAYA applies for this class&apos;s students — guidance only, it never gives
        answers away.
      </p>
      {error && <p style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}
      {items.length === 0 && <p style={{ opacity: 0.55, fontSize: "0.85rem" }}>No instructions yet.</p>}
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0" }}>
          <span style={{ flex: 1, opacity: it.isActive ? 1 : 0.45 }}>
            {it.content}
            <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>
              {" "}· {it.subjectName ?? "all subjects"}
            </span>
          </span>
          <button style={ghost} onClick={() => toggle(it)}>{it.isActive ? "Disable" : "Enable"}</button>
          <button
            onClick={() => remove(it.id)}
            title="Delete"
            style={{ background: "transparent", color: "#6b7794", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200 }}
          placeholder="e.g. Focus on fractions this week"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        <select style={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" style={btn} disabled={busy || !content.trim()}>Add</button>
      </form>
    </div>
  );
}

function RosterRow({ s, busy, onOpen }: { s: RosterStudent; busy: boolean; onOpen: () => void }) {
  const { box, ghost } = useSchoolStyles();
  return (
    <div style={{ ...box, display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span
        style={{ width: 8, height: 8, borderRadius: 999, background: riskColor(s.riskLevel), flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>
          {s.firstName} {s.lastName}
        </div>
        <div style={{ opacity: 0.55, fontSize: "0.8rem" }}>
          {s.statusLabel ?? "No data yet"} · last active {fmtDate(s.lastActiveAt)}
        </div>
      </div>
      <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>{pctOrDash(s.avgMastery)}</span>
      <button style={ghost} onClick={onOpen} disabled={busy}>
        View
      </button>
    </div>
  );
}

function LearningGraphView({ graph }: { graph: LearningGraph }) {
  const { box } = useSchoolStyles();
  const W = 660;
  const layerGap = 92;
  const topPad = 30;
  const r = 8;

  // Group by prerequisite depth and place each layer's nodes evenly across the width.
  const maxDepth = graph.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const byDepth = new Map<number, typeof graph.nodes>();
  for (const n of graph.nodes) {
    const arr = byDepth.get(n.depth) ?? [];
    arr.push(n);
    byDepth.set(n.depth, arr);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, nodes] of byDepth) {
    nodes.forEach((n, i) => {
      pos.set(n.id, { x: (W * (i + 1)) / (nodes.length + 1), y: topPad + d * layerGap });
    });
  }
  const H = topPad * 2 + maxDepth * layerGap;

  const legend: [string, string][] = [
    ["#22c55e", "Mastered"],
    ["#f59e0b", "Partial"],
    ["#ef4444", "Gap"],
    ["#6b7794", "Not started"],
  ];

  return (
    <div style={box}>
      <div style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
        Learning graph
      </div>
      <p style={{ opacity: 0.55, fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
        Concepts of this student and the prerequisites they build on — a foundation
        node in red is a gap holding back everything below it.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {legend.map(([c, l]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", opacity: 0.8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
            {l}
          </span>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }}>
          {graph.edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2a3550" strokeWidth={1.5} />
            );
          })}
          {graph.nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const short = n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label;
            return (
              <g key={n.id}>
                <title>{`${n.label} — ${n.mastery == null ? "not started" : Math.round(n.mastery * 100) + "%"}`}</title>
                <circle cx={p.x} cy={p.y} r={r} fill={masteryColor(n.mastery)} stroke="#0b1020" strokeWidth={1.5} />
                <text
                  x={p.x}
                  y={p.y + r + 11}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#c9d3ea"
                >
                  {short}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function StudentDetailView({ detail, onBack }: { detail: StudentDetail; onBack: () => void }) {
  const { t, box, ghost } = useSchoolStyles();
  return (
    <div>
      <button style={{ ...ghost, marginBottom: "1rem" }} onClick={onBack}>
        ← Back to class
      </button>

      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h2 style={{ margin: 0, flex: 1 }}>
            {detail.firstName} {detail.lastName}
          </h2>
          {detail.statusLabel && (
            <span
              style={{
                background: riskColor(detail.riskLevel),
                color: "#0b1020",
                borderRadius: 999,
                padding: "0.2rem 0.7rem",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {detail.statusLabel}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.75rem", fontSize: "0.9rem" }}>
          {[
            ["Avg mastery", pctOrDash(detail.avgMastery)],
            ["Confidence", pctOrDash(detail.mindsetScore)],
            ["Sessions (7d)", detail.sessionsLast7d ?? "—"],
            ["Last active", fmtDate(detail.lastActiveAt)],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div style={{ fontWeight: 700 }}>{value}</div>
              <div style={{ opacity: 0.55, fontSize: "0.75rem" }}>{label}</div>
            </div>
          ))}
        </div>
        {detail.detectedMindset && (
          <p style={{ margin: "0.6rem 0 0", opacity: 0.7, fontSize: "0.85rem" }}>
            Mindset: {detail.detectedMindset}
          </p>
        )}
      </div>

      {detail.insight && (
        <div style={{ ...box, borderColor: "#8b5cf655", background: t.cardBg }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#a78bfa", marginBottom: "0.35rem" }}>
            RAYA analysis
          </div>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{detail.insight}</p>
        </div>
      )}

      {detail.graph.edges.length > 0 && <LearningGraphView graph={detail.graph} />}

      <div style={box}>
        <div style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
          Mastery by concept
        </div>
        {detail.kcs.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6 }}>
            No cognitive data yet — it appears once this student works with RAYA.
          </p>
        ) : (
          detail.kcs.map((kc, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.45rem" }}>
              <span style={{ flex: 1, fontSize: "0.9rem" }}>{kc.label}</span>
              <div style={{ width: 120, height: 5, background: t.gaugeTrack, borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: pctOrDash(kc.mastery),
                    height: "100%",
                    background: riskColor(
                      kc.mastery == null ? null : kc.mastery >= 0.7 ? "low" : kc.mastery >= 0.5 ? "med" : "high",
                    ),
                  }}
                />
              </div>
              <span style={{ width: 40, textAlign: "right", opacity: 0.7, fontSize: "0.85rem" }}>
                {pctOrDash(kc.mastery)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
