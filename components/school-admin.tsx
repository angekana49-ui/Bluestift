"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setActiveSchool } from "@/app/school/actions";
import { clearLocalData } from "@/lib/net/local-data";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { SchoolRayaChat } from "@/components/school/school-raya-chat";
import { AuthPanel, type RecoveryKeyInfo } from "@/components/auth-panel";
import { SettingsThemeCard } from "@/components/raya/settings-theme-card";
import { SettingsLanguageCard } from "@/components/raya/settings-language-card";
import { StudentBillingCard } from "@/components/raya/settings-billing-card";
import { SectionHeader } from "@/components/raya/section-header";
import { SchoolReports } from "@/components/school-reports";
import { SchoolTeam } from "@/components/school-team";
import { SchoolInsights } from "@/components/school-insights";
import { SchoolLms } from "@/components/school-lms";
import { SchoolBilling } from "@/components/school-billing";
import { InstructionsPanel } from "@/components/school/class-instructions";
import { FollowupsPanel } from "@/components/school/prof-followups";
import { ProfOverviewView } from "@/components/school/prof-overview";
import { PrepareView } from "@/components/school/prof-prepare";
import { downloadBrandedPdf, type BrandedDoc } from "@/lib/document";
import { COUNTRIES, SCHOOL_TYPES } from "@/lib/school-constants";
import { useDarkMode, useAppTheme, AppThemeProvider } from "@/components/ui/theme";
import { LocaleProvider, useTranslate } from "@/components/ui/locale";
import { useLocale } from "@/lib/use-locale";
import { SchoolsShell, type SchoolNavItem } from "@/components/school/schools-shell";
import { RightPanel } from "@/components/ui/shell";
import { RayaName, SchoolsName } from "@/components/ui/brand";
import { createClient } from "@/lib/supabase/client";
import { KpiTile, MasteryGauge } from "@/components/ui/widgets";
import {
  FilterChips,
  ListNoMatch,
  ListToolbar,
  useListSearch,
  withCount,
} from "@/components/ui/list-filter";
import { sortByName } from "@/lib/search";
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
  IconUpgrade,
} from "@/components/ui/icons";
import { FilePicker } from "@/components/ui/file-picker";
import { neutralButton, formActions } from "@/components/ui/forms";
import { SettingsSheet, type SettingsGroup } from "@/components/ui/settings-sheet";
import { initialsOf } from "@/lib/name";
import type { AppTheme } from "@/components/ui/tokens";
import type {
  AdminClass,
  AdminSchool,
  ClassRoster,
  ClassSummary,
  LearningGraph,
  MembershipSummary,
  ProfAlert,
  ProfInsights,
  RosterStudent,
  SchoolDashboard,
  SchoolOverview,
  SchoolRole,
  StudentDetail,
} from "@/lib/school-admin";

/** The signed-in user's own account, for the in-dashboard Settings panel. Mirrors
 * exactly what /account renders (theme + AuthPanel + billing), so the teacher's
 * profile chip opens Settings in place instead of bouncing to the Raya scaffold. */
export type StaffAccount = {
  user: { id: string; email: string | null; isAnonymous: boolean };
  profile: {
    username: string | null;
    display_name: string | null;
    account_type: string;
    account_state: string;
    profile_picture_url: string | null;
  };
  /** Whether a recovery key has been issued — never the key itself, which is
   *  stored only as a hash and cannot be read back. */
  recoveryKey?: RecoveryKeyInfo;
};

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
  fontSize: 15,
  outline: "none",
});
const mkBtn = (t: AppTheme): React.CSSProperties => ({
  background: t.ctaBg,
  color: t.ctaText,
  border: "none",
  borderRadius: 99,
  padding: "9px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
const mkGhost = (t: AppTheme): React.CSSProperties => ({
  background: t.cardBg2,
  color: t.text,
  border: `1px solid ${t.cardBorder}`,
  borderRadius: 99,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});
/** Convenience: pull the theme + the four common style helpers in one call. */
function useSchoolStyles() {
  const { theme: t } = useAppTheme();
  return { t, box: mkBox(t), input: mkInput(t), btn: mkBtn(t), ghost: mkGhost(t) };
}

/**
 * Every mutation on this dashboard goes through here. netFetch gives it a
 * deadline (a hung request used to leave a button spinning forever) and reports
 * connectivity to the degraded banner. Deliberately NOT retried: creating a
 * class or an invite is not idempotent — the caller keeps the form filled and
 * lets the user decide.
 */
async function postJson(url: string, body: unknown, method = "POST") {
  const res = await netFetch(
    url,
    {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    { timeoutMs: 15_000 },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data;
}

/**
 * Read-only dashboard GET with a stale-first cache: switching tabs on a weak
 * link renders the last known data immediately and reconciles in the
 * background, instead of blanking the panel on every mount. Returns null when
 * there is nothing cached AND the network failed — callers show their error.
 */
async function getJson<T>(url: string, cacheKey: string, onFresh?: (data: T) => void): Promise<T | null> {
  const { data } = await getJsonCached<T>(url, {
    cacheKey,
    cacheTtlMs: 30_000,
    retries: 1,
    onUpdate: onFresh,
  });
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
  userName = "",
  planLabel = null,
  profSubjects = [],
  profSchoolName = null,
  profSchoolLogoUrl = null,
  userAvatarUrl = null,
  memberships = [],
  activeSchoolId = null,
  account = null,
  initialTab = null,
  initialJoinCode = null,
}: {
  role: SchoolRole | null;
  dashboard: SchoolDashboard | null;
  profClasses: AdminClass[];
  account?: StaffAccount | null;
  /** Signed-in teacher's identity + teaching subjects, for the prof dashboard. */
  teacherName?: string;
  /** Signed-in user's display name for the sidebar profile chip (name + photo). */
  userName?: string;
  /** Active school's plan/forfait, shown under the name in the profile chip. */
  planLabel?: string | null;
  profSubjects?: string[];
  profSchoolName?: string | null;
  profSchoolLogoUrl?: string | null;
  userAvatarUrl?: string | null;
  memberships?: MembershipSummary[];
  activeSchoolId?: string | null;
  initialTab?: string | null;
  initialJoinCode?: string | null;
}) {
  const dm = useDarkMode();
  const localeValue = useLocale();
  const [dash, setDash] = useState<SchoolDashboard | null>(dashboard);

  const showNoMembership = role !== "prof" && !(role === "admin_master" && dash);

  return (
    <AppThemeProvider value={dm}>
     <LocaleProvider value={localeValue}>
     <SchoolUserContext.Provider value={{ avatarUrl: userAvatarUrl, memberships, activeSchoolId }}>
      {showNoMembership ? (
        <NoMembership initialJoinCode={initialJoinCode} />
      ) : role === "prof" ? (
        <ProfView classes={profClasses} teacherName={teacherName} planLabel={planLabel} subjects={profSubjects} schoolName={profSchoolName} schoolLogoUrl={profSchoolLogoUrl} account={account} />
      ) : (
        <Dashboard dash={dash as SchoolDashboard} setDash={setDash} adminName={userName} planLabel={planLabel} initialTab={initialTab} />
      )}
     </SchoolUserContext.Provider>
     </LocaleProvider>
    </AppThemeProvider>
  );
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
  headerLogoUrl,
  rightPanel,
  contentFlush,
  onProfile,
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
  headerLogoUrl?: string | null;
  rightPanel?: React.ReactNode;
  contentFlush?: boolean;
  /** What the sidebar profile chip does. Defaults to the /account page; the prof
   *  dashboard overrides it to open Settings in place. */
  onProfile?: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const tr = useTranslate();
  const { avatarUrl, memberships, activeSchoolId } = useSchoolUser();
  const activeSchool = memberships.find((m) => m.schoolId === activeSchoolId) ?? null;
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The profile chip opens a small menu (like the Raya app) rather than jumping
  // straight to Settings. "Settings" delegates to the caller's `onProfile` (prof
  // → in-dashboard settings; admin → /account), plus a sign-out.
  const settingsAction = onProfile ?? (() => router.push("/account"));
  async function signOut() {
    // Shared machines: wipe locally retained user data before switching users.
    await clearLocalData();
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  }
  /**
   * Staff settings, as the sheet lays them out — deliberately NOT the learner's.
   *
   * The two apps ask different questions of the same person. Raya's sheet is
   * about one account and one learning record; this one has to answer "which
   * school am I in right now", which is a question the student side does not
   * have, and it has to keep the door to that person's OWN Raya visible without
   * making it look like part of the job.
   *
   * The active school leads, because on a multi-school account every other row
   * in this sheet is scoped to it and getting it wrong is how a teacher edits
   * the wrong school's classes.
   */
  const settingsGroups: SettingsGroup[] = [
    {
      key: "school",
      title: tr("settings.group.school"),
      rows: [
        {
          key: "active-school",
          icon: <IconClasses />,
          label: tr("settings.row.activeSchool"),
          value: activeSchool?.schoolName ?? schoolName,
          // Switching lives in the sidebar's own switcher, which is visible
          // without opening anything; a second control here would be two
          // places that disagree.
        },
        {
          key: "billing",
          icon: <IconBilling />,
          label: tr("settings.row.billing"),
          onSelect: () => onNav("billing"),
        },
      ],
    },
    {
      key: "account",
      title: tr("settings.group.account"),
      rows: [
        {
          key: "settings",
          icon: <IconSettings />,
          label: tr("settings.row.profile"),
          sublabel: tr("settings.row.profile.sub"),
          onSelect: settingsAction,
        },
        // An honest, non-forced door to the person's *own* Raya (solo chat,
        // Tools, their Kernel). Teaching features live in this dashboard and
        // are covered by the school; personal Raya is their own account — so we
        // label who-pays and never redirect silently. A "want", not a "need".
        {
          key: "personal-raya",
          icon: <IconChat />,
          label: tr("menu.personalRaya"),
          sublabel: tr("menu.personalRaya.sub"),
          onSelect: () => router.push("/chat"),
        },
        {
          key: "upgrade",
          icon: <IconUpgrade />,
          label: tr("menu.upgrade"),
          sublabel: tr("menu.upgrade.sub"),
          tone: "accent",
          onSelect: () => router.push("/pricing"),
        },
      ],
    },
  ];

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
      onProfile={() => setSettingsOpen(true)}
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      headerLogoUrl={headerLogoUrl}
      rightPanel={rightPanel}
      contentFlush={contentFlush}
    >
      {children}
      {settingsOpen && (
        <SettingsSheet
          title={tr("settings.title")}
          identity={profileName ?? schoolName}
          identitySub={activeSchool?.schoolName ?? schoolName}
          groups={settingsGroups}
          onSignOut={signOut}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </SchoolsShell>
  );
}

/**
 * Sidebar school switcher for multi-school users: lists every school the user
 * belongs to and switches the active one via the `setActiveSchool` server action.
 * Only renders when the user has more than one school. (Creating a school happens
 * in Raya / the profile; a teacher adds more schools by code in their dashboard.)
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
      <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", color: t.sidebarMuted, marginBottom: 2 }}>
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
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initialsOf(m.schoolName)}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: t.sidebarText }}>
              {m.schoolName}
            </span>
            <span style={{ fontSize: 13, color: t.sidebarMuted, flex: "none" }}>{roleLabel(m.role)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * No school yet: join with a staff invite code. Creating a school lives in Raya
 * (the profile), where every user is — so we point there rather than duplicating
 * the create form here.
 */
function NoMembership({ initialJoinCode }: { initialJoinCode: string | null }) {
  const { t } = useSchoolStyles();
  return (
    <SchoolChrome nav={[]} activeKey="" onNav={() => {}} schoolName="School" headerTitle="School">
      <JoinSchool initialCode={initialJoinCode} />
      <p style={{ fontSize: 15, color: t.muted, marginTop: 16 }}>
        Want to run your own school?{" "}
        <Link href="/profile" style={{ color: t.link, fontWeight: 600 }}>
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
      <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>＋ Add another school</h3>
      <p style={{ margin: "0 0 10px", opacity: 0.6, fontSize: 14 }}>
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
      {msg && <p style={{ color: "#22c55e", margin: "10px 0 0", fontSize: 14 }}>{msg}</p>}
      {error && <p style={{ color: "#f87171", margin: "10px 0 0", fontSize: 14 }}>{error}</p>}
    </form>
  );
}

type ProfTab =
  | "overview"
  | "classes"
  | "focus"
  | "prepare"
  | "insights"
  | "reports"
  | "raya"
  | "settings";

type ProfNav =
  | { mode: "list" }
  | { mode: "class"; roster: ClassRoster }
  | { mode: "student"; detail: StudentDetail; classId: string; onBack: () => void };

function ProfView({
  classes,
  teacherName,
  planLabel = null,
  subjects,
  schoolName,
  schoolLogoUrl = null,
  account = null,
}: {
  classes: AdminClass[];
  teacherName: string;
  planLabel?: string | null;
  subjects: string[];
  schoolName: string | null;
  schoolLogoUrl?: string | null;
  account?: StaffAccount | null;
}) {
  const { t, box, ghost } = useSchoolStyles();
  const { memberships, activeSchoolId } = useSchoolUser();
  const tr = useTranslate();
  const [tab, setTab] = useState<ProfTab>("overview");
  const [directives, setDirectives] = useState<{ id: string; content: string }[]>([]);
  const [nav, setNav] = useState<ProfNav>({ mode: "list" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // School directives aimed at teachers — informational, aligns their own recs.
  useEffect(() => {
    void getJson<{ directives?: { id: string; content: string }[] }>(
      "/api/school/directives",
      "school:directives",
      (fresh) => setDirectives(fresh.directives ?? []),
    ).then((d) => {
      if (d) setDirectives(d.directives ?? []);
    });
  }, []);

  async function openClass(classId: string) {
    setBusy(true);
    setError(null);
    try {
      const roster = await getJson<ClassRoster>(
        `/api/school/roster?classId=${classId}`,
        `school:roster:${classId}`,
      );
      if (!roster) {
        setError("Could not load the class.");
        return;
      }
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
      const detail = await getJson<StudentDetail>(
        `/api/school/student?classId=${classId}&userId=${userId}`,
        `school:student:${classId}:${userId}`,
      );
      if (!detail) {
        setError("Could not load the student.");
        return;
      }
      setNav({ mode: "student", detail, classId, onBack });
    } catch {
      setError("Could not load the student.");
    } finally {
      setBusy(false);
    }
  }

  // Open a student in the Focus tab (from the Overview at-risk feed or the picker).
  function focusStudent(classId: string, userId: string) {
    setTab("focus");
    openStudent(classId, userId, () => setNav({ mode: "list" }));
  }

  // The school the teacher is currently viewing (server prop, else the active
  // membership) — surfaced in the header so their teaching hat is explicit.
  const resolvedSchool =
    schoolName ||
    memberships.find((m) => m.schoolId === activeSchoolId)?.schoolName ||
    memberships[0]?.schoolName ||
    "your school";
  // Profile chip (like Raya): name + photo, with "Teacher · <forfait>" under it.
  const profileForfait = planLabel ? `Teacher · ${planLabel}` : "Teacher";

  // "Raya" is a brand name — it is never translated (see the brand-names rule).
  const navItems: SchoolNavItem[] = [
    { key: "overview", label: tr("nav.overview"), icon: <IconOverview /> },
    { key: "classes", label: tr("nav.classes"), icon: <IconClasses /> },
    { key: "focus", label: tr("nav.focus"), icon: <IconRooms /> },
    { key: "prepare", label: tr("nav.prepare"), icon: <IconFile /> },
    { key: "insights", label: tr("nav.insights"), icon: <IconKernel /> },
    { key: "reports", label: tr("nav.reports"), icon: <IconSummary /> },
    { key: "raya", label: "Raya", icon: <IconChat /> },
    { key: "settings", label: tr("nav.settings"), icon: <IconSettings /> },
  ];
  const goTab = (k: string) => {
    setTab(k as ProfTab);
    setNav({ mode: "list" });
  };

  // The Raya tab is a full-height conversational surface — it owns the whole card
  // body (no page padding) when we're on that tab at the top level.
  const rayaFullScreen = tab === "raya" && nav.mode === "list";

  // Header context line under the school name+logo: the drilled element, else the
  // active tab — one short line so the header brands the school without saturating.
  const tabLabel = navItems.find((n) => n.key === tab)?.label ?? "";
  const contextLabel =
    nav.mode === "student"
      ? `${nav.detail.firstName} ${nav.detail.lastName}`.trim() || "Student"
      : nav.mode === "class"
        ? nav.roster.className
        : tab === "raya"
          ? "Raya for Schools"
          : tabLabel;

  let body: React.ReactNode;
  if (nav.mode === "student") {
    body = <StudentDetailView detail={nav.detail} classId={nav.classId} onBack={nav.onBack} />;
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
    body = <SchoolRayaChat role="prof" staffName={teacherName} />;
  } else if (tab === "settings") {
    body = <ProfSettings account={account} classes={classes} />;
  } else if (tab === "overview") {
    body = (
      <ProfOverviewView
        classes={classes.map((c) => ({ id: c.id, name: c.name, studentCount: c.studentCount }))}
        teacherName={teacherName}
        onOpenStudent={focusStudent}
        onGoto={(k) => goTab(k)}
      />
    );
  } else if (tab === "prepare") {
    body = <PrepareView classes={classes.map((c) => ({ id: c.id, name: c.name }))} schoolName={resolvedSchool} />;
  } else if (tab === "reports") {
    body = (
      <SchoolReports
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        schoolName={resolvedSchool}
        allowedScopes={["class"]}
      />
    );
  } else if (tab === "focus") {
    body = (
      <FocusView
        classes={classes}
        busy={busy}
        error={error}
        onOpenStudent={(classId, userId) =>
          openStudent(classId, userId, () => setNav({ mode: "list" }))
        }
      />
    );
  } else if (tab === "insights") {
    body = <ProfInsightsView schoolName={resolvedSchool} onStudent={focusStudent} />;
  } else {
    body = (
      <>
        <TeacherBanner name={teacherName} subjects={subjects} schoolName={resolvedSchool} classCount={classes.length} />
        {directives.length > 0 && (
          <div style={{ border: `1px solid ${t.cardBorder}`, background: t.cardBg2, borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.muted, marginBottom: 6 }}>📌 From your school</div>
            {directives.map((d) => (
              <div key={d.id} style={{ fontSize: 15 }}>{d.content}</div>
            ))}
          </div>
        )}
        {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
        {busy && <p style={{ color: t.muted, fontSize: 15 }}>Loading…</p>}
        {classes.length === 0 ? (
          <div style={box}>
            <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
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
                <div style={{ opacity: 0.55, fontSize: 14 }}>{c.studentCount} students</div>
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
      activeKey={nav.mode === "list" ? tab : ""}
      onNav={goTab}
      schoolName={resolvedSchool}
      profileName={teacherName}
      profileSubtitle={profileForfait}
      headerTitle={resolvedSchool}
      headerSubtitle={contextLabel}
      headerLogoUrl={schoolLogoUrl}
      contentFlush={rayaFullScreen}
      onProfile={() => goTab("settings")}
    >
      {body}
    </SchoolChrome>
  );
}

/**
 * Focus mode: pick one student (class → student) and drop into their deep
 * workspace (cognitive detail + learning graph + follow-up notes). A faster path
 * than drilling through the class roster when you want to work on one learner.
 */
function FocusView({
  classes,
  busy,
  error,
  onOpenStudent,
}: {
  classes: AdminClass[];
  busy: boolean;
  error: string | null;
  onOpenStudent: (classId: string, userId: string) => void;
}) {
  const { t, box } = useSchoolStyles();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classId) {
      setRoster(null);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const r = await getJson<ClassRoster>(
          `/api/school/roster?classId=${classId}`,
          `school:roster:${classId}`,
          (fresh) => {
            if (alive) setRoster(fresh);
          },
        );
        if (alive) setRoster(r);
      } catch {
        if (alive) setRoster(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId]);

  if (classes.length === 0) {
    return (
      <div style={box}>
        <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
          You don&apos;t have any assigned classes yet, so there&apos;s no student to focus on.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={box}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.25rem" }}>Focus on a student</h2>
        <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
          Pick a class, then a student, to open their cognitive detail and your follow-up log.
        </p>
        <select
          style={{ ...mkInput(t), minWidth: 200 }}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          {sortByName(classes, (c) => c.name).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
      {(loading || busy) && <p style={{ color: t.muted, fontSize: 15 }}>Loading…</p>}

      {roster && roster.students.length === 0 && (
        <div style={box}>
          <p style={{ margin: 0, opacity: 0.65 }}>No students have joined this class yet.</p>
        </div>
      )}
      {roster && roster.students.length > 0 && (
        <RosterList
          students={roster.students}
          busy={busy}
          onStudent={(userId) => onOpenStudent(roster.classId, userId)}
        />
      )}
    </div>
  );
}

/**
 * The teacher's own account Settings, rendered *inside* the school dashboard so
 * the profile chip no longer bounces to the Raya-scaffolded /account page. Same
 * cards as /account: theme, identity/auth (email link, recovery key), billing.
 */
function ProfSettings({ account, classes }: { account: StaffAccount | null; classes: AdminClass[] }) {
  const { t } = useSchoolStyles();
  if (!account) {
    return (
      <p style={{ color: t.muted, fontSize: 15 }}>
        <Link href="/account" style={{ color: t.link, fontWeight: 600 }}>Open account settings →</Link>
      </p>
    );
  }
  return (
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <SectionHeader title="Settings" />
      <SettingsThemeCard />
      <SettingsLanguageCard />
      <TeachingPreferencesCard classes={classes} />
      <AuthPanel
        user={account.user}
        profile={account.profile}
        recoveryKey={account.recoveryKey}
        maxWidth={700}
      />
      <WhoPaysNote />
      <StudentBillingCard />
    </div>
  );
}

/**
 * Draws the billing boundary in plain words so the teacher understands the
 * personal-Raya crossing is a choice, not a paywall on their work: teaching lives
 * in this dashboard (school-covered), personal Raya is their own account. Keeps
 * the fallback honest rather than abrupt or forced.
 */
function WhoPaysNote() {
  const { t } = useSchoolStyles();
  return (
    <div
      style={{
        border: `1px solid ${t.cardBorder}`,
        background: t.cardBg2,
        borderRadius: 12,
        padding: "12px 14px",
        marginTop: 14,
        fontSize: 14,
        lineHeight: 1.5,
        color: t.muted,
      }}
    >
      <div style={{ fontWeight: 700, color: t.text, marginBottom: 4 }}>What your school covers</div>
      Your teaching tools — classes, Focus, Prepare, reports and <RayaName /> for <SchoolsName /> — are part of your
      school&apos;s plan; you never pay for them. Your <strong style={{ color: t.text }}>personal <RayaName /></strong>{" "}
      (solo chat, Tools, your own Kernel) is your own account, on the free plan unless you choose to
      upgrade it.
    </div>
  );
}

type TeachPrefs = {
  defaultClassId: string | null;
  defaultSubjectId: string | null;
  reportTone: string | null;
  examFocusWeakConcepts: boolean;
};
const TONES = ["", "neutral", "encouraging", "formal", "concise"];

/**
 * Teaching preferences that tailor the teacher's tools: a default class/subject
 * to preselect, the tone of generated reports, and whether Prepare should aim
 * material at the class's weakest concepts. Persisted per staff membership.
 */
function TeachingPreferencesCard({ classes }: { classes: AdminClass[] }) {
  const { t, box, input, btn } = useSchoolStyles();
  const [prefs, setPrefs] = useState<TeachPrefs | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        getJson<{ prefs: TeachPrefs }>("/api/school/preferences", "school:preferences"),
        getJson<{ subjects: { id: string; name: string }[] }>(
          "/api/school/subjects",
          "school:subjects",
        ),
      ]);
      // Unreachable with nothing cached: fall back to defaults so the card is
      // usable rather than stuck on a spinner.
      setPrefs(
        p?.prefs ?? {
          defaultClassId: null,
          defaultSubjectId: null,
          reportTone: null,
          examFocusWeakConcepts: true,
        },
      );
      if (Array.isArray(s?.subjects)) setSubjects(s.subjects);
    })();
  }, []);

  async function save() {
    if (!prefs || busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = await postJson("/api/school/preferences", { prefs }, "PATCH");
      invalidateCached("school:preferences");
      setPrefs(d.prefs as TeachPrefs);
      setMsg("Saved ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) return <div style={box}><p style={{ margin: 0, color: t.muted, fontSize: 15 }}>Loading preferences…</p></div>;

  const set = (patch: Partial<TeachPrefs>) => setPrefs((p) => (p ? { ...p, ...patch } : p));

  return (
    <div style={box}>
      <h3 style={{ margin: "0 0 0.85rem", fontSize: "1.05rem" }}>Teaching preferences</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Default class
          <select
            style={{ ...input, width: "100%", marginTop: 4 }}
            value={prefs.defaultClassId ?? ""}
            onChange={(e) => set({ defaultClassId: e.target.value || null })}
            disabled={busy}
          >
            <option value="">None</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Default subject
          <select
            style={{ ...input, width: "100%", marginTop: 4 }}
            value={prefs.defaultSubjectId ?? ""}
            onChange={(e) => set({ defaultSubjectId: e.target.value || null })}
            disabled={busy}
          >
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>
          Report tone
          <select
            style={{ ...input, width: "100%", marginTop: 4 }}
            value={prefs.reportTone ?? ""}
            onChange={(e) => set({ reportTone: e.target.value || null })}
            disabled={busy}
          >
            {TONES.map((tone) => (
              <option key={tone || "default"} value={tone}>
                {tone ? tone.charAt(0).toUpperCase() + tone.slice(1) : "Default"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.85rem" }}>
        <input
          type="checkbox"
          checked={prefs.examFocusWeakConcepts}
          onChange={(e) => set({ examFocusWeakConcepts: e.target.checked })}
          disabled={busy}
        />
        Aim prepared material at my class&apos;s weakest concepts
      </label>
      <div style={{ ...formActions, marginTop: "0.9rem" }}>
        {msg && <span style={{ color: "#22c55e", fontSize: "0.85rem", marginRight: "auto" }}>{msg}</span>}
        <button style={{ ...btn, opacity: busy ? 0.7 : 1 }} onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save preferences"}
        </button>
        {error && <span style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</span>}
      </div>
    </div>
  );
}

/**
 * The teacher's "double-hat" banner: makes explicit that this dashboard is Raya
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
          fontSize: 17,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initialsOf(name)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
          {name}
          <span style={{ fontWeight: 500, color: t.muted }}>
            {" "}· Teacher{subjects.length > 0 ? ` of ${subjects.join(", ")}` : ""}
          </span>
        </div>
        <div style={{ fontSize: 14, color: t.mutedLight, marginTop: 2 }}>
          {schoolName} · {classCount} {classCount === 1 ? "class" : "classes"} · your <RayaName />, extended for teaching
        </div>
      </div>
    </div>
  );
}

/** Read-only insights + at-risk feed for a teacher's assigned classes. */
/** Compose a teacher's at-risk list + class insights into a branded Markdown document. */
function profInsightsToDoc(data: ProfInsights, schoolName?: string): BrandedDoc {
  const lines: string[] = ["# At-risk students"];
  if (data.alertsUnavailable) {
    // The PDF outlives the screen it was exported from, so it must not freeze
    // an unknown state into a printed "all clear".
    lines.push("_Kernel unreachable when this was exported — the list is unknown, not empty._");
  } else if (data.alerts.length === 0) {
    lines.push("No students need attention right now.");
  }
  for (const a of data.alerts) {
    lines.push(
      `- **${a.name}** · ${a.className} · ${a.alertTypes?.join(" · ") ?? a.statusLabel ?? "at risk"} · ${pctOrDash(a.avgMastery)}`,
    );
  }
  lines.push("# Class insights");
  if (data.insights.length === 0) lines.push("No certified insights yet.");
  for (const ins of data.insights) {
    lines.push(`## ${ins.className} · ${ins.subjectName} — ${pctOrDash(ins.avgMastery)}`);
    if (ins.topGaps.length > 0) lines.push(`- Top gaps: ${ins.topGaps.join(", ")}`);
    if (ins.topRecommendation) lines.push(`- Recommendation: ${ins.topRecommendation}`);
  }
  return {
    brand: "bluestift",
    title: "Class insights",
    meta: new Date().toLocaleDateString(),
    audience: schoolName,
    body: lines.join("\n"),
  };
}

function ProfInsightsView({ onStudent, schoolName }: { onStudent: (classId: string, userId: string) => void; schoolName?: string }) {
  const { box, ghost } = useSchoolStyles();
  const [data, setData] = useState<ProfInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  /**
   * Acknowledging refetches instead of removing the row locally. The kernel is
   * the record; if the call half-succeeded, an optimistic removal would show a
   * teacher a cleared alert that is still open.
   */
  async function acknowledge(a: ProfAlert) {
    if (!a.alertIds?.length) return;
    setAcking(a.userId);
    setAckError(null);
    try {
      await postJson("/api/school/alerts/resolve", { alertIds: a.alertIds });
      const fresh = await getJson<ProfInsights>("/api/school/prof-insights", "school:profInsights");
      if (fresh) setData(fresh);
    } catch (e) {
      setAckError(e instanceof Error ? e.message : "Could not acknowledge.");
    } finally {
      setAcking(null);
    }
  }

  useEffect(() => {
    (async () => {
      const d = await getJson<ProfInsights>(
        "/api/school/prof-insights",
        "school:profInsights",
        (fresh) => setData(fresh),
      );
      if (d) setData(d);
      else setError("Could not load insights.");
      setLoading(false);
    })();
  }, []);

  /**
   * A teacher with six classes can be looking at forty at-risk students, which
   * is the list they most need to narrow — usually to one class, or to the one
   * name a parent just asked about. Declared above the early returns: the data
   * arrives asynchronously and a hook cannot start existing on the second render.
   */
  const alertSearch = useListSearch(
    data?.alerts ?? [],
    (a) => [a.name, a.className, a.statusLabel, ...(a.alertTypes ?? [])],
    { noun: "students" },
  );

  if (loading) return <p style={{ opacity: 0.6 }}>Loading…</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!data) return null;

  return (
    <div>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, flex: 1 }}>{withCount("At-risk students", data.alerts.length)}</h3>
          {(data.alerts.length > 0 || data.insights.length > 0) && (
            <button style={ghost} onClick={() => downloadBrandedPdf(profInsightsToDoc(data, schoolName))}>
              Download PDF
            </button>
          )}
        </div>
        {data.alertsUnavailable ? (
          // Not the same thing as "nobody needs attention". We don't know, and
          // saying "all clear" when the kernel is unreachable is the one lie a
          // safety panel must never tell.
          <p style={{ color: "#fbbf24", fontSize: "0.85rem", margin: 0 }}>
            Can&apos;t reach the kernel — this list is unknown, not empty. Try again shortly.
          </p>
        ) : data.alerts.length === 0 ? (
          <p style={{ opacity: 0.55, fontSize: "0.85rem", margin: 0 }}>No students need attention right now.</p>
        ) : (
          <>
          <ListToolbar search={alertSearch} style={{ marginTop: 12 }} />
          {alertSearch.visible.map((a) => (
            <div
              key={`${a.classId}:${a.userId}`}
              style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: riskColor(a.riskLevel), flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                {a.name}
                <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>
                  {" "}· {a.className} · {a.alertTypes?.join(" · ") ?? a.statusLabel ?? "at risk"}
                  {a.alertCount && a.alertCount > 1 ? ` · ${a.alertCount} signals` : ""}
                  {a.avgMastery != null ? ` · ${pctOrDash(a.avgMastery)}` : ""}
                </span>
              </span>
              {a.alertIds?.length ? (
                <button
                  style={ghost}
                  disabled={acking === a.userId}
                  title="Mark as seen — it leaves this list, the student's data is untouched."
                  onClick={() => acknowledge(a)}
                >
                  {acking === a.userId ? "…" : "Seen"}
                </button>
              ) : null}
              <button style={ghost} onClick={() => onStudent(a.classId, a.userId)}>Open →</button>
            </div>
          ))}
          <ListNoMatch search={alertSearch} />
          </>
        )}
        {ackError && (
          <p style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.4rem 0 0" }}>{ackError}</p>
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


function SchoolSettings({
  school,
  onUpdated,
}: {
  school: AdminSchool;
  onUpdated: (s: AdminSchool) => void;
}) {
  const { t, box, input, btn } = useSchoolStyles();
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
      const res = await netFetch(
        "/api/school/logo",
        { method: "POST", body: fd },
        { timeoutMs: 60_000 }, // an image upload on a weak school link
      );
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
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <SettingsLanguageCard />
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
            fontSize: 27,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            school.name ? initialsOf(school.name) : "?"
          )}
        </div>
        <FilePicker
          accept="image/*"
          onPick={(files) => uploadLogo(files?.[0] ?? null)}
          disabled={busy}
          resetAfterPick
          label={busy ? "Uploading…" : "Change logo"}
          icon={null}
          buttonStyle={neutralButton(t)}
        />
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

      <div style={{ ...formActions, marginTop: "0.9rem" }}>
        {msg && <span style={{ color: "#22c55e", fontSize: "0.85rem", marginRight: "auto" }}>{msg}</span>}
        <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {error && <span style={{ color: "#f87171", fontSize: "0.85rem" }}>{error}</span>}
      </div>
      </form>
    </div>
  );
}

type DashTab = "overview" | "manage" | "team" | "insights" | "lms" | "raya" | "reports" | "billing" | "settings";
// "lms" (Google Classroom) is intentionally omitted from the reachable set: the
// integration needs a Google OAuth app that isn't provisioned yet, so it's hidden
// from the nav until it's wired. The tab branch + component are kept so re-enabling
// is a one-line change (add "lms" back here and to navItems).
const DASH_TABS: DashTab[] = ["overview", "manage", "team", "insights", "raya", "reports", "billing", "settings"];

function Dashboard({
  dash,
  setDash,
  adminName = "",
  planLabel = null,
  initialTab = null,
}: {
  dash: SchoolDashboard;
  setDash: (d: SchoolDashboard) => void;
  /** Signed-in admin's display name for the sidebar profile chip. */
  adminName?: string;
  /** Active school's plan/forfait, shown under the name in the profile chip. */
  planLabel?: string | null;
  initialTab?: string | null;
}) {
  const { t, box, input, btn, ghost } = useSchoolStyles();
  const router = useRouter();
  const tr = useTranslate();
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
      const data = await getJson<SchoolOverview>(
        "/api/school/overview",
        "school:overview",
        (fresh) => setOverview(fresh),
      );
      if (data) setOverview(data);
      else setError("Could not load the overview.");
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
      const roster = await getJson<ClassRoster>(
        `/api/school/roster?classId=${classId}`,
        `school:roster:${classId}`,
      );
      if (!roster) {
        setError("Could not load the class.");
        return;
      }
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
      const detail = await getJson<StudentDetail>(
        `/api/school/student?classId=${roster.classId}&userId=${userId}`,
        `school:student:${roster.classId}:${userId}`,
      );
      if (!detail) {
        setError("Could not load the student.");
        return;
      }
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
    { key: "overview", label: tr("nav.overview"), icon: <IconOverview /> },
    { key: "manage", label: tr("nav.classesCodes"), icon: <IconClasses /> },
    { key: "team", label: tr("nav.team"), icon: <IconRooms /> },
    { key: "insights", label: tr("nav.insights"), icon: <IconKernel /> },
    // LMS (Google Classroom) hidden until the OAuth integration is provisioned.
    { key: "raya", label: "Raya", icon: <IconChat /> },
    { key: "reports", label: tr("nav.reports"), icon: <IconSummary /> },
    { key: "billing", label: tr("nav.billing"), icon: <IconBilling /> },
    { key: "settings", label: tr("nav.settings"), icon: <IconSettings /> },
  ];
  const goTab = (k: string) => {
    setNav({ mode: "list" });
    if (k === "overview") showOverview();
    else setTab(k as DashTab);
  };

  const tabContent =
    tab === "raya" ? (
      <SchoolRayaChat role="admin_master" staffName={dash.school.name} />
    ) : tab === "settings" ? (
      <SchoolSettings school={dash.school} onUpdated={(school) => setDash({ ...dash, school })} />
    ) : tab === "team" ? (
      <SchoolTeam classes={dash.classes.map((c) => ({ id: c.id, name: c.name }))} />
    ) : tab === "insights" ? (
      <SchoolInsights schoolName={dash.school.name} />
    ) : tab === "lms" ? (
      <SchoolLms classes={dash.classes.map((c) => ({ id: c.id, name: c.name }))} />
    ) : tab === "reports" ? (
      <SchoolReports classes={dash.classes.map((c) => ({ id: c.id, name: c.name }))} schoolName={dash.school.name} />
    ) : tab === "billing" ? (
      <SchoolBilling />
    ) : tab === "overview" ? (
      <OverviewView school={dash.school.name} overview={overview} busy={overviewBusy} onClass={(id) => openClass(id)} />
    ) : (
      <>
        <div style={{ ...box, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, margin: 0, color: t.text }}>{dash.school.name}</h2>
            <p style={{ margin: "4px 0 0", color: t.muted, fontSize: 14 }}>
              {dash.school.currentYearLabel ? `Year ${dash.school.currentYearLabel} · ` : ""}
              {dash.classes.length} {dash.classes.length === 1 ? "class" : "classes"}
            </p>
          </div>
          <button style={ghost} onClick={startNewYear} disabled={busy}>
            New year
          </button>
        </div>

        <form style={box} onSubmit={addClass}>
          <h3 style={{ margin: "0 0 10px", fontSize: 16, color: t.text }}>Add a class</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input style={{ ...input, flex: 2, minWidth: 160 }} placeholder="Class name (e.g. 6th A)" value={className} onChange={(e) => setClassName(e.target.value)} disabled={busy} />
            <input style={{ ...input, flex: 1, minWidth: 110 }} placeholder="Level (optional)" value={level} onChange={(e) => setLevel(e.target.value)} disabled={busy} />
            <input type="number" min={1} max={1000} style={{ ...input, width: 130 }} placeholder="Class size (n)" title="Class size. The cap is n + 5." value={effectif} onChange={(e) => setEffectif(e.target.value)} disabled={busy} />
            <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !className.trim()}>
              Add
            </button>
          </div>
          <p style={{ margin: "8px 0 0", color: t.mutedLight, fontSize: 13 }}>
            The class size is the number you set. Students can join up to <strong>n + 5</strong>.
          </p>
        </form>

        {navBusy && <p style={{ color: t.muted, fontSize: 15 }}>Loading…</p>}

        <ClassesList
          classes={dash.classes}
          onGenCode={genCode}
          onToggleCode={toggleCode}
          onSetEffectif={updateEffectif}
          onOpen={openClass}
        />
      </>
    );

  // The Raya tab is a full-height chat that owns the whole card (its own header,
  // its own right panel) — like the prof dashboard's Raya tab.
  const rayaFlush = nav.mode === "list" && tab === "raya";

  // Header context line under the school name+logo: the drilled element, else the
  // active tab — one short line so the header brands the school without saturating.
  const contextLabel =
    nav.mode === "student"
      ? `${nav.detail.firstName} ${nav.detail.lastName}`.trim() || "Student"
      : nav.mode === "class"
        ? nav.roster.className
        : tab === "raya"
          ? "Raya for Schools"
          : navItems.find((n) => n.key === tab)?.label ?? "";

  let body: React.ReactNode;
  if (nav.mode === "student") {
    body = <StudentDetailView detail={nav.detail} classId={nav.roster.classId} onBack={() => setNav({ mode: "class", roster: nav.roster })} />;
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
  } else if (rayaFlush) {
    body = tabContent;
  } else {
    body = (
      <>
        {error && <p style={{ color: "#f87171", fontSize: 15 }}>{error}</p>}
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
      profileName={adminName || dash.school.name}
      profileSubtitle={planLabel ? `Admin · ${planLabel}` : "Admin"}
      headerTitle={dash.school.name}
      headerSubtitle={contextLabel}
      headerLogoUrl={dash.school.logoUrl}
      contentFlush={rayaFlush}
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
  // Before the early returns: hooks cannot sit behind a loading branch, and this
  // one has two. An absent overview is an empty list, which the hook handles.
  const sortedClasses = sortByName(overview?.classes ?? [], (c) => c.name);
  const search = useListSearch(sortedClasses, (c) => [c.name], { noun: "classes" });

  if (busy && !overview) return <p style={{ color: t.muted, fontSize: 15 }}>Loading overview…</p>;
  if (!overview) return <p style={{ color: t.muted, fontSize: 15 }}>No overview available.</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <KpiTile theme={t} label="Students" value={overview.totals.students} shine />
        <KpiTile theme={t} label="Active (7d)" value={overview.totals.active} shine />
        <KpiTile theme={t} label="Struggling" value={overview.totals.alerts} />
        <KpiTile theme={t} label="Average mastery" value={pctOrDash(overview.totals.avgMastery)} />
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 10px" }}>
        {withCount(`${school} · by class`, overview.classes.length, t)}
      </div>

      {overview.classes.length === 0 ? (
        <div style={box}>
          <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
            No classes. Add one in “Classes &amp; codes”.
          </p>
        </div>
      ) : (
        <>
          <ListToolbar search={search} />
          {search.visible.map((c) => (
            <OverviewClassRow key={c.id} c={c} onOpen={() => onClass(c.id)} />
          ))}
          <ListNoMatch search={search} />
        </>
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
        <div style={{ color: t.mutedLight, fontSize: 14 }}>
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
            fontSize: 13,
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
        <span style={{ color: t.text, fontSize: 14, width: 40, textAlign: "right" }}>{pctOrDash(c.avgMastery)}</span>
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
  const title: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginBottom: 10, color: t.text };
  const insight: React.CSSProperties = { background: t.rowActiveBg, borderRadius: 12, padding: 12, marginBottom: 8 };
  return (
    <RightPanel theme={t} width={300} title="Live snapshot">
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
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            {overview.totals.alerts} student{overview.totals.alerts === 1 ? "" : "s"} struggling
          </div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{overview.totals.active} active over 7 days</div>
        </div>
      </div>
      {weak.length > 0 && (
        <div style={card}>
          <div style={title}>Classes to watch</div>
          {weak.map((c) => (
            <div key={c.id} style={insight}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{c.name}</div>
              <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                Mastery {pctOrDash(c.avgMastery)} · {c.alerts} alert{c.alerts === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}
    </RightPanel>
  );
}

/**
 * The "Classes & codes" list. Its own component only because the search needs a
 * hook, and the tab that used to render this inline is chosen by a ternary —
 * a hook cannot live in a branch.
 *
 * Search covers the access CODES as well as the names, which is the lookup this
 * screen exists for in the other direction: a student calls to say their code
 * does not work and reads it out, and the admin has to find which class it
 * belongs to.
 */
function ClassesList({
  classes,
  onGenCode,
  onToggleCode,
  onSetEffectif,
  onOpen,
}: {
  classes: AdminClass[];
  onGenCode: (classId: string) => void;
  onToggleCode: (classId: string, codeId: string, isActive: boolean) => void;
  onSetEffectif: (classId: string, expectedSize: number | null) => Promise<void>;
  onOpen: (classId: string) => void;
}) {
  const sorted = sortByName(classes, (c) => c.name);
  const search = useListSearch(
    sorted,
    (c) => [c.name, c.level, ...c.codes.map((k) => k.code)],
    { noun: "classes" },
  );

  return (
    <>
      <ListToolbar search={search} />
      {search.visible.map((c) => (
        <ClassCard
          key={c.id}
          c={c}
          onGenCode={onGenCode}
          onToggleCode={onToggleCode}
          onSetEffectif={onSetEffectif}
          onOpen={() => onOpen(c.id)}
        />
      ))}
      <ListNoMatch search={search} />
    </>
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
  const { box, input, btn, ghost } = useSchoolStyles();
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
                // Claims the slack, so Copy/Deactivate land on the card's
                // trailing edge instead of trailing the code by one gap and
                // leaving the rest of the row empty.
                flex: 1,
                minWidth: 0,
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

      {/* The card's primary action, and it was neither blue nor on the edge —
          "Generate code" in the Team tab is both, for the same verb on the same
          object. A ghost button hard left read as a footnote to the code list
          rather than the thing that makes a code. */}
      <div style={{ ...formActions, marginTop: "0.75rem" }}>
        <button
          style={btn}
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
        <RosterList students={roster.students} busy={busy} onStudent={onStudent} />
      )}

      <InstructionsPanel classId={roster.classId} />
    </div>
  );
}


/**
 * A class roster, made navigable: sorted by surname, searchable, and filterable
 * by the one thing a teacher opens the list to find.
 *
 * Rendered in both places a roster appears (the admin's class drill-down and the
 * teacher's "Focus on a student"), because two copies of a filtered list is two
 * chances for them to disagree about what "needs attention" means.
 *
 * Search runs first and the chip counts are taken from its result, so the
 * numbers on the chips always add up to what is on screen — a facet count that
 * silently ignores the active query is a number that lies.
 */
function RosterList({
  students,
  busy,
  onStudent,
}: {
  students: RosterStudent[];
  busy: boolean;
  onStudent: (userId: string) => void;
}) {
  const { t } = useSchoolStyles();
  const [risk, setRisk] = useState("all");

  // Surname first: a class list is read as "who is Kouamé", not "who is Marie",
  // and a school's paperwork is ordered that way everywhere else.
  const sorted = sortByName(students, (s) => `${s.lastName} ${s.firstName}`.trim());
  const search = useListSearch(sorted, (s) => [s.firstName, s.lastName, s.statusLabel], {
    noun: "students",
  });

  const found = search.visible;
  const isAlert = (s: RosterStudent) =>
    s.riskLevel === "high" || s.riskLevel === "medium" || s.riskLevel === "med";
  const hasData = (s: RosterStudent) => s.riskLevel != null;

  const buckets: Record<string, (s: RosterStudent) => boolean> = {
    all: () => true,
    alert: isAlert,
    ok: (s) => hasData(s) && !isAlert(s),
    // Kept as its own chip rather than folded into "On track": a student the
    // Kernel has never seen is not a student who is doing fine, and merging the
    // two is how a class looks healthier than it is.
    none: (s) => !hasData(s),
  };

  const shown = found.filter(buckets[risk] ?? buckets.all);
  const showChips = students.length >= 8;

  return (
    <>
      <ListToolbar search={search}>
        {showChips && (
          <FilterChips
            value={risk}
            onChange={setRisk}
            options={[
              { key: "all", label: "All", count: found.length },
              { key: "alert", label: "Needs attention", count: found.filter(isAlert).length },
              { key: "ok", label: "On track", count: found.filter(buckets.ok).length },
              { key: "none", label: "No data", count: found.filter(buckets.none).length },
            ]}
          />
        )}
      </ListToolbar>

      {shown.map((s) => (
        <RosterRow key={s.userId} s={s} busy={busy} onOpen={() => onStudent(s.userId)} />
      ))}

      <ListNoMatch search={search} />
      {!search.noMatch && shown.length === 0 && found.length > 0 && (
        <p style={{ color: t.muted, fontSize: 15, padding: "8px 2px" }}>
          No students in this filter.{" "}
          <button
            type="button"
            onClick={() => setRisk("all")}
            style={{ background: "none", border: "none", padding: 0, color: t.link, fontSize: 15, fontWeight: 650, fontFamily: "inherit", cursor: "pointer" }}
          >
            Show all
          </button>
        </p>
      )}
    </>
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

function StudentDetailView({
  detail,
  onBack,
  classId,
}: {
  detail: StudentDetail;
  onBack: () => void;
  /** When set, the team-shared follow-up log for this student is shown below. */
  classId?: string;
}) {
  const { t, box, ghost } = useSchoolStyles();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <button style={ghost} onClick={onBack}>
          ← Back to class
        </button>
        {/* FERPA inspect-and-review: what a parent asks the school for. Downloads
            the education record — results, inferred understanding and staff
            notes — but not the student's own conversations with Raya. */}
        {classId && (
          <a
            href={`/api/school/student/record?classId=${classId}&userId=${detail.userId}`}
            style={{ ...ghost, textDecoration: "none", marginLeft: "auto" }}
            title="Download this student's education record (for a parent request)"
          >
            Download record
          </a>
        )}
      </div>

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
            <RayaName /> analysis
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
            No cognitive data yet — it appears once this student works with <RayaName />.
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

      {classId && <FollowupsPanel classId={classId} studentUserId={detail.userId} />}
    </div>
  );
}
