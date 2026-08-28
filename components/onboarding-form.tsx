"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  downloadRecoveryKey,
  formatRecoveryKey,
  maskedRecoveryKey,
  normalizeRecoveryKey,
  recoveryKeyTail,
} from "@/lib/recovery-key";
import {
  AuthSplit,
  BluestiftName,
  BluestiftText,
  Logo,
  RayaName,
  SchoolsName,
  Flock,
  HAND_FONT,
  WORDMARK_B,
  heading,
  sub,
  fieldLabel,
  fieldInput,
  primaryBtn,
  secondaryBtn,
} from "@/components/ui/auth-chrome";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/**
 * First-run account setup for BlueStift — the umbrella brand over Raya (the
 * tutor) and Schools. Full-screen split (shared chrome in ui/auth-chrome).
 *
 * Shape:
 * - TWO differentiated tracks chosen up front: Raya (learn) and Schools
 *   (teach / run). Same account, different questions + copy.
 * - One question per screen — 5 steps per track, goal-gradient bar.
 * - Anonymous accounts get a 6th screen: continue-with-email + the recovery key
 *   with its constraints (lost = gone, minimal security, holder = full access).
 * - Ends on a landing-style welcome with the handwritten hook + a flock of birds.
 *
 * The account is never locked to a role; the track is a router + a signal only.
 * Logos: the two path cards carry real product marks (the Raya black rosette and
 * the BlueStift bird on blue); everything else keeps the flagship blue bird.
 */

type Track = "raya" | "schools";
type SchoolRole = "teacher" | "school";

// The age question sits second on purpose — right after the path, before we ask
// for a name or anything else. Nothing is collected from a child we're about to
// turn away. It is also phrased neutrally ("what year were you born?") rather
// than as "are you over 13?", which tells a child which answer opens the door.
const RAYA_STEPS = ["path", "age", "name", "level", "subjects", "goal"] as const;
const SCHOOL_STEPS = ["path", "age", "name", "srole", "focus", "ready"] as const;

const LEVELS: { value: string; labelKey: MessageKey }[] = [
  { value: "middle_school", labelKey: "onb.level.middle" },
  { value: "high_school", labelKey: "onb.level.high" },
  { value: "university", labelKey: "onb.level.university" },
  { value: "other", labelKey: "onb.other" },
];

// The stored value is a stable English slug (write-only analytics metadata,
// see onboarding_events — never read back to drive matching), independent of
// the display label so switching UI language doesn't change what gets saved.
const SUBJECTS: { value: string; labelKey: MessageKey }[] = [
  { value: "Maths", labelKey: "onb.subject.maths" },
  { value: "Physics", labelKey: "onb.subject.physics" },
  { value: "Chemistry", labelKey: "onb.subject.chemistry" },
  { value: "Biology", labelKey: "onb.subject.biology" },
  { value: "History & Geography", labelKey: "onb.subject.historyGeo" },
  { value: "Languages", labelKey: "onb.subject.languages" },
  { value: "Economics", labelKey: "onb.subject.economics" },
  { value: "Computer science", labelKey: "onb.subject.cs" },
  { value: "Philosophy", labelKey: "onb.subject.philosophy" },
  { value: "Other", labelKey: "onb.other" },
];

export function OnboardingForm({
  userId,
  emailVerified,
  isAnonymous,
  recoveryCode,
  initialUsername,
  initialDisplayName,
  ageOnly = false,
  startBlocked = false,
}: {
  userId: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  recoveryCode: string | null;
  initialUsername: string;
  initialDisplayName: string;
  /** Account already set up, but with no age on file — ask only that. */
  ageOnly?: boolean;
  /** Already known to be an unauthorised under-13; open on the blocked screen. */
  startBlocked?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const tr = useTranslate();

  const [track, setTrack] = useState<Track | null>(ageOnly ? "raya" : null);
  const [stepIndex, setStepIndex] = useState(ageOnly ? 1 : 0);
  const [phase, setPhase] = useState<"steps" | "email" | "welcome" | "blocked">(
    startBlocked ? "blocked" : "steps",
  );
  const [birthYear, setBirthYear] = useState("");

  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [level, setLevel] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState(() => tr("onb.goal.default"));
  const [schoolRole, setSchoolRole] = useState<SchoolRole | null>(null);
  const [focus, setFocus] = useState("");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = track === "schools" ? SCHOOL_STEPS : RAYA_STEPS;
  const stepKey = steps[stepIndex];
  const lastStep = steps.length - 1;
  const identityReady = username.trim().length > 0 && displayName.trim().length > 0;

  // In age-only mode there is exactly one question, so the counter says so
  // rather than pretending the user is partway through a fresh setup.
  const totalSteps = ageOnly ? 1 : steps.length + (isAnonymous ? 1 : 0);
  const stepNumber = ageOnly ? 1 : phase === "email" ? steps.length + 1 : stepIndex + 1;
  const progress =
    totalSteps > 1 ? Math.round(28 + ((stepNumber - 1) / (totalSteps - 1)) * 67) : 60;

  const dest = track === "schools" ? "/school/enter" : "/chat";

  function toggleSubject(s: string) {
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function pickTrack(t: Track) {
    setError(null);
    setTrack(t);
    setStepIndex(1);
  }

  function back() {
    setError(null);
    if (phase === "email") {
      setPhase("steps");
      setStepIndex(lastStep);
      return;
    }
    if (stepIndex === 0 || ageOnly) return;
    if (stepIndex === 1) setTrack(null);
    setStepIndex((i) => i - 1);
  }

  function validate(): string | null {
    switch (stepKey) {
      case "age":
        return /^\d{4}$/.test(birthYear.trim()) ? null : tr("onb.err.age");
      case "name":
        return identityReady ? null : tr("onb.err.nameRequired");
      case "level":
        return level ? null : tr("onb.err.level");
      case "srole":
        return schoolRole ? null : tr("onb.err.srole");
      default:
        return null;
    }
  }

  /**
   * Send the declared year to the server, which decides the band and stores it.
   * The client is deliberately not trusted with that call: `birth_year` isn't
   * client-writable, so a blocked child can't post their way past this.
   * Returns false when the answer blocks them.
   */
  async function submitAge(): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch("/api/account/age", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ birthYear: Number(birthYear.trim()) }),
      });
      const data = (await res.json()) as { allowed?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? `${tr("onb.err.saveFailed")} (${res.status}).`);
        return false;
      }
      if (!data.allowed) {
        setPhase("blocked");
        return false;
      }
      return true;
    } catch {
      setError(tr("onb.err.network"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (busy) return;
    const err = validate();
    if (err) return setError(err);
    setError(null);

    if (stepKey === "age") {
      const ok = await submitAge();
      if (!ok) return;
      // Nothing else is missing for an existing account — send them on.
      if (ageOnly) {
        router.replace("/chat");
        router.refresh();
        return;
      }
    }

    if (stepIndex < lastStep) return setStepIndex((i) => i + 1);
    await commit();
  }

  async function commit() {
    const u = username.trim();
    const d = displayName.trim();
    // Jump back to whichever index "name" now sits at — it moved when the age
    // question was inserted, and a hard-coded 1 would land on the wrong screen.
    const nameStep = (steps as readonly string[]).indexOf("name");
    if (!u || !d) {
      setStepIndex(nameStep);
      return setError(tr("onb.err.nameRequired"));
    }
    setBusy(true);
    setError(null);

    const isRaya = track !== "schools";
    const roleSignal = isRaya ? "student" : schoolRole ?? "teacher";

    const { error: updErr } = await supabase
      .from("users")
      .update({
        username: u,
        display_name: d,
        school_level: isRaya ? level : null,
        account_state: emailVerified ? "active_verified" : "active_unverified",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updErr) {
      setBusy(false);
      if (updErr.code === "23505") {
        setStepIndex(nameStep);
        return setError(tr("onb.err.usernameTaken"));
      }
      return setError(updErr.message);
    }

    await supabase.from("onboarding_events").insert([
      {
        user_id: userId,
        step: "username_set",
        metadata: isRaya ? { role: "student", track: "raya" } : { role: roleSignal, track: "schools", focus: focus.trim() || null },
      },
      ...(isRaya && level
        ? [
            {
              user_id: userId,
              step: "school_level_set",
              metadata: { subjects, goal: goal.trim() || null },
            },
          ]
        : []),
    ]);

    setBusy(false);
    setPhase(isAnonymous ? "email" : "welcome");
  }

  async function linkEmail() {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true);
    setError(null);
    // Route the confirmation link through /auth/callback (like every other email
    // entry point) so clicking it exchanges the code, records email verification,
    // and lands the user exactly where the flow gate says — onboarding if they
    // haven't finished, their home otherwise. Without this the link falls back to
    // Supabase's Site URL and the redirect (and verification) is lost.
    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/account` : undefined;
    const { error: linkErr } = await supabase.auth.updateUser({ email: e }, { emailRedirectTo });
    setBusy(false);
    if (linkErr) return setError(linkErr.message);
    setEmailSent(true);
  }

  function enterApp() {
    router.push(dest);
    router.refresh();
  }

  // ---------------------------------------------------------------- Blocked ---
  // Under 13 with no school and no recorded parental authorisation. We run no
  // verifiable-parental-consent mechanism of our own, so the only way in is a
  // school vouching for them — anything else would be pretending.
  if (phase === "blocked") {
    return (
      <AuthSplit>
        <BlockedScreen
          onLinked={() => {
            // The school join records the authorisation server-side; reloading
            // re-runs the gate, which now lets them through.
            router.replace("/onboarding");
            router.refresh();
          }}
          onLeave={leaveOnboarding}
          busy={busy}
        />
      </AuthSplit>
    );
  }

  // ---------------------------------------------------------------- Welcome ---
  if (phase === "welcome") {
    const firstName = (displayName.trim().split(" ")[0] || "there").slice(0, 24);
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          background: "linear-gradient(180deg,#eef3f9 0%,#dde8f3 45%,#c9d9ea 100%)",
        }}
      >
        <div style={{ position: "relative", width: "100%", maxWidth: 560, textAlign: "center", padding: "8px 16px" }}>
          <Logo size={44} />

          {/* The flock flies AROUND the welcome sentence (overlay layer). */}
          <div style={{ position: "relative", marginTop: 18, padding: "34px 0" }}>
            <Flock />
            <h1
              style={{
                position: "relative",
                zIndex: 1,
                fontFamily: HAND_FONT,
                fontWeight: 700,
                fontSize: "clamp(2.4rem,7vw,3.4rem)",
                lineHeight: 1,
                margin: 0,
                color: "#0b1220",
                animation: "writeReveal 2.4s cubic-bezier(0.65,0,0.35,1) 0.3s 1 both",
              }}
            >
              {tr("onb.welcome.greeting")} <BluestiftName>BlueStift</BluestiftName>, {firstName}.
            </h1>
          </div>
          <p style={{ maxWidth: 400, margin: "16px auto 0", fontSize: 16, lineHeight: 1.7, color: "#475569" }}>
            {track === "schools" ? (
              tr("onb.welcome.sub.schools")
            ) : (
              <>{tr("onb.welcome.sub.raya.a")} <RayaName /> {tr("onb.welcome.sub.raya.b")}</>
            )}
          </p>

          <button onClick={enterApp} style={{ ...primaryBtn, width: "auto", padding: "14px 28px", marginTop: 26 }}>
            {track === "schools" ? <>{tr("onb.welcome.cta.schools")} <SchoolsName /> →</> : tr("onb.welcome.cta.raya")}
          </button>
        </div>
      </div>
    );
  }

  // Escape hatch: onboarding must never be a one-way door. Signing out here
  // drops the half-finished session so /login stops bouncing you back in and
  // you can pick another sign-in method.
  async function leaveOnboarding() {
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const switchMethodLink = (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={leaveOnboarding}
        disabled={busy}
        style={{ background: "none", border: "none", padding: 0, fontSize: 14, color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
      >
        {tr("onb.switchMethod")}
      </button>
    </div>
  );

  // ------------------------------------------------------------- Full screen ---
  return (
    <AuthSplit back={switchMethodLink}>
      {/* Goal-gradient progress — seeded, never 0. */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tr("onb.stepLabel")} {stepNumber} {tr("onb.of")} {totalSteps}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: WORDMARK_B }}>{progress}% {tr("onb.setUp")}</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "#eef2f8", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, borderRadius: 99, background: "linear-gradient(90deg,#2f7fe0,#6366f1)", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {phase === "email" ? (
        <EmailStep
          recoveryCode={recoveryCode}
          email={email}
          setEmail={setEmail}
          emailSent={emailSent}
          busy={busy}
          onLink={linkEmail}
          onBack={back}
          onContinue={() => setPhase("welcome")}
        />
      ) : (
        <>
          {stepKey === "path" && (
            <>
              <h1 style={heading}>
                <BluestiftText>{tr("onb.path.heading")}</BluestiftText>
              </h1>
              <p style={sub}>{tr("onb.path.sub")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => pickTrack("raya")} style={roleCard(false)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/raya-mark-black.png" alt="Raya" style={cardLogo} />
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle()}>{tr("onb.path.raya.title")} <RayaName /></span>
                    <span style={pathDesc()}>{tr("onb.path.raya.desc")}</span>
                  </span>
                </button>
                <button onClick={() => pickTrack("schools")} style={roleCard(false)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/bluestift-mark-dark.png" alt="BlueStift Schools" style={cardLogo} />
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle()}>{tr("onb.path.schools.title")}</span>
                    <span style={pathDesc()}>{tr("onb.path.schools.desc")}</span>
                  </span>
                </button>
              </div>
            </>
          )}

          {stepKey === "age" && (
            <>
              <h1 style={heading}>{tr("onb.age.heading")}</h1>
              <p style={sub}>{tr("onb.age.sub")}</p>
              <label style={fieldLabel}>{tr("onb.age.label")}</label>
              <input
                style={fieldInput}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder={tr("onb.age.placeholder")}
                value={birthYear}
                // Digits only, so a stray letter can't turn into a silent NaN.
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <p style={{ fontSize: 13, color: "#64748b", margin: "-4px 0 0", lineHeight: 1.6 }}>
                {tr("onb.age.note")}
              </p>
            </>
          )}

          {stepKey === "name" && (
            <>
              <h1 style={heading}>{tr("onb.name.heading")}</h1>
              <p style={sub}>{tr("onb.name.sub")}</p>
              <label style={fieldLabel}>{tr("onb.name.usernameLabel")}</label>
              <input style={fieldInput} placeholder={tr("onb.name.usernamePlaceholder")} value={username} onChange={(e) => setUsername(e.target.value)} />
              <label style={fieldLabel}>{tr("onb.name.displayLabel")}</label>
              <input style={fieldInput} placeholder={tr("onb.name.displayPlaceholder")} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </>
          )}

          {stepKey === "level" && (
            <>
              <h1 style={heading}>{tr("onb.level.heading")}</h1>
              <p style={sub}>{tr("onb.level.sub.a")} <RayaName /> {tr("onb.level.sub.b")}</p>
              <div style={chipRow}>
                {LEVELS.map((l) => (
                  <button key={l.value} onClick={() => setLevel(l.value)} style={chip(level === l.value)}>
                    {tr(l.labelKey)}
                  </button>
                ))}
              </div>
            </>
          )}

          {stepKey === "subjects" && (
            <>
              <h1 style={heading}>{tr("onb.subjects.heading")}</h1>
              <p style={sub}>{tr("onb.subjects.sub")}</p>
              <div style={chipRow}>
                {SUBJECTS.map((s) => (
                  <button key={s.value} onClick={() => toggleSubject(s.value)} style={chip(subjects.includes(s.value))}>
                    {tr(s.labelKey)}
                  </button>
                ))}
              </div>
            </>
          )}

          {stepKey === "goal" && (
            <>
              <h1 style={heading}>{tr("onb.goal.heading")}</h1>
              <p style={sub}>{tr("onb.goal.sub.a")} <RayaName /> {tr("onb.goal.sub.b")}</p>
              <textarea
                style={{ ...fieldInput, resize: "vertical", minHeight: 84 }}
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </>
          )}

          {stepKey === "srole" && (
            <>
              <h1 style={heading}>{tr("onb.srole.heading.a")} <SchoolsName />?</h1>
              <p style={sub}>{tr("onb.srole.sub")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => setSchoolRole("teacher")} style={roleCard(schoolRole === "teacher")}>
                  <Icon on={schoolRole === "teacher"}>{IconTeacher}</Icon>
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle(schoolRole === "teacher")}>{tr("onb.srole.teacher.title")}</span>
                    <span style={pathDesc(schoolRole === "teacher")}>{tr("onb.srole.teacher.desc")}</span>
                  </span>
                </button>
                <button onClick={() => setSchoolRole("school")} style={roleCard(schoolRole === "school")}>
                  <Icon on={schoolRole === "school"}>{IconSchool}</Icon>
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle(schoolRole === "school")}>{tr("onb.srole.school.title")}</span>
                    <span style={pathDesc(schoolRole === "school")}>{tr("onb.srole.school.desc")}</span>
                  </span>
                </button>
              </div>
            </>
          )}

          {stepKey === "focus" && (
            <>
              <h1 style={heading}>{schoolRole === "school" ? tr("onb.focus.heading.school") : tr("onb.focus.heading.teacher")}</h1>
              <p style={sub}>{tr("onb.focus.sub")}</p>
              <input
                style={fieldInput}
                placeholder={schoolRole === "school" ? tr("onb.focus.placeholder.school") : tr("onb.focus.placeholder.teacher")}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </>
          )}

          {stepKey === "ready" && (
            <>
              <h1 style={heading}>{tr("onb.ready.heading")}</h1>
              <p style={sub}>{tr("onb.ready.sub")}</p>
              <div style={noteBox}>
                {schoolRole === "school" ? tr("onb.ready.note.school") : tr("onb.ready.note.teacher")}
              </div>
            </>
          )}

          {stepKey !== "path" && (
            <>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={back} disabled={busy} style={secondaryBtn}>
                  {tr("onb.back")}
                </button>
                <button onClick={next} disabled={busy} style={{ ...primaryBtn, marginTop: 0, flex: 1, opacity: busy ? 0.6 : 1 }}>
                  {busy ? "…" : stepIndex === lastStep ? tr("onb.finishArrow") : tr("onb.continue")}
                </button>
              </div>
              {/* Shown at the step that creates the account, not buried in a
                  footer — this is the moment the agreement is actually made. */}
              {!ageOnly && (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "#64748b",
                    lineHeight: 1.6,
                    textAlign: "center",
                    margin: "14px 0 0",
                  }}
                >
                  {tr("onb.terms.agree")}{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" style={{ color: WORDMARK_B, fontWeight: 600 }}>
                    {tr("onb.terms.termsLink")}
                  </a>{" "}
                  {tr("onb.terms.and")}{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: WORDMARK_B, fontWeight: 600 }}>
                    {tr("onb.terms.privacyLink")}
                  </a>
                  .
                </p>
              )}
            </>
          )}
        </>
      )}

      {error && <p style={{ color: "#dc2626", textAlign: "center", marginTop: 16, fontSize: 14 }}>{error}</p>}
    </AuthSplit>
  );
}

// ------------------------------------------------------------- Email step ---
// Anonymous-only 6th screen: offer a real email + surface the recovery key with
// its hard constraints. Continuing is gated on acknowledging the key.
function EmailStep({
  recoveryCode,
  email,
  setEmail,
  emailSent,
  busy,
  onLink,
  onBack,
  onContinue,
}: {
  recoveryCode: string | null;
  email: string;
  setEmail: (v: string) => void;
  emailSent: boolean;
  busy: boolean;
  onLink: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const tr = useTranslate();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tail, setTail] = useState("");
  const masked = maskedRecoveryKey(recoveryCode);
  const expectedTail = recoveryCode ? recoveryKeyTail(recoveryCode) : "";

  // Proof beats an honour-system tick: retyping the last group means the key
  // really left the screen. If the key failed to generate we have nothing to
  // prove, so don't trap the user behind a check they cannot pass.
  const tailOk = !recoveryCode || normalizeRecoveryKey(tail) === expectedTail;

  async function copy() {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(formatRecoveryKey(recoveryCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    if (!recoveryCode) return;
    downloadRecoveryKey(recoveryCode);
    setSaved(true);
    setShown(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <h1 style={heading}>{tr("onb.email.heading")}</h1>
      <p style={sub}>{tr("onb.email.sub")}</p>

      <label style={fieldLabel}>{tr("onb.email.label")}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...fieldInput, marginBottom: 0, flex: 1 }}
          type="email"
          placeholder={tr("onb.email.placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || emailSent}
        />
        <button
          onClick={onLink}
          disabled={busy || emailSent || !email.trim()}
          style={{ ...secondaryBtn, padding: "12px 16px", opacity: busy || emailSent || !email.trim() ? 0.6 : 1 }}
        >
          {emailSent ? tr("onb.email.sentBtn") : tr("onb.email.linkBtn")}
        </button>
      </div>
      {emailSent && (
        <p style={{ fontSize: 14, color: "#047857", margin: "8px 0 0", lineHeight: 1.5 }}>
          {tr("onb.email.checkInbox")}
        </p>
      )}

      <div
        style={{
          marginTop: 18,
          borderRadius: 14,
          border: "1px solid rgba(99,102,241,0.35)",
          background: "rgba(99,102,241,0.06)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon color="#6366f1">{IconKey}</Icon>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0b1220" }}>{tr("onb.email.recoveryTitle")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <code
            style={{
              flex: 1,
              minWidth: 150,
              background: "#f3f6fa",
              border: "1px solid #dde5ee",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 15,
              letterSpacing: shown ? "0.12em" : "0.24em",
              color: "#0b1220",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              userSelect: shown ? "all" : "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {recoveryCode ? (shown ? formatRecoveryKey(recoveryCode) : masked) : tr("onb.email.alreadyShown")}
          </code>
          <button type="button" style={keyPill} onClick={() => setShown((s) => !s)} disabled={!recoveryCode}>
            {shown ? tr("onb.email.hide") : tr("onb.email.reveal")}
          </button>
          <button type="button" style={keyPill} onClick={copy} disabled={!recoveryCode}>
            {copied ? tr("onb.email.copied") : tr("onb.email.copy")}
          </button>
          {/* A download, not just a clipboard: the clipboard is gone the moment
              the user copies anything else, which on a shared school machine is
              about a minute. A file survives. */}
          <button type="button" style={keyPill} onClick={download} disabled={!recoveryCode}>
            {saved ? tr("onb.email.saved") : tr("onb.email.download")}
          </button>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
          <li>{tr("onb.email.bullet1")}</li>
          <li>{tr("onb.email.bullet2.a")} <strong style={{ color: "#0b1220" }}>{tr("onb.email.bullet2.strong")}</strong> {tr("onb.email.bullet2.b")}</li>
          <li>{tr("onb.email.bullet3")}</li>
        </ul>
      </div>

      {/* Evidence, not an honour-system tick: retyping the last group is proof
          the key actually left this screen. Skipped when there is no key to
          check — a reload lands here (the key is issued once and never stored in
          the clear), and that must not trap someone in onboarding. */}
      {recoveryCode ? (
        <div style={{ marginTop: 14 }}>
          <label style={{ ...fieldLabel, display: "block" }}>
            {tr("onb.email.tailLabel")}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              style={{
                ...fieldInput,
                marginBottom: 0,
                width: 130,
                textTransform: "uppercase",
                letterSpacing: "0.24em",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
              value={tail}
              onChange={(e) => setTail(e.target.value.slice(0, 8))}
              placeholder="••••"
              aria-label={tr("onb.email.tailAria")}
              autoComplete="off"
            />
            {tailOk ? (
              <span style={{ fontSize: 14, fontWeight: 600, color: "#047857" }}>{tr("onb.email.gotIt")}</span>
            ) : (
              <span style={{ fontSize: 14, color: "#64748b" }}>
                {tail.trim() ? tr("onb.email.tailWrong") : tr("onb.email.tailHint")}
              </span>
            )}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 14, lineHeight: 1.6 }}>
          {tr("onb.email.noKey.a")}{" "}
          <strong style={{ color: "#0b1220" }}>{tr("onb.email.noKey.strong")}</strong>.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button onClick={onBack} disabled={busy} style={secondaryBtn}>
          {tr("onb.back")}
        </button>
        <button
          onClick={onContinue}
          disabled={busy || (!tailOk && !emailSent)}
          style={{ ...primaryBtn, marginTop: 0, flex: 1, opacity: busy || (!tailOk && !emailSent) ? 0.6 : 1 }}
        >
          {tr("onb.continueArrow")}
        </button>
      </div>
    </>
  );
}

// ----------------------------------------------------------- Blocked screen ---
/**
 * The under-13 dead end, and the one door out of it.
 *
 * COPPA lets a school consent on a parent's behalf for school use, and that is
 * the only consent mechanism we operate — we do not verify parents ourselves.
 * So the class code is not a convenience here, it is the entire legal basis.
 * Everything else on this screen points at a human.
 */
function BlockedScreen({
  onLinked,
  onLeave,
  busy,
}: {
  onLinked: () => void;
  onLeave: () => void;
  busy: boolean;
}) {
  const tr = useTranslate();
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.trim() && firstName.trim() && lastName.trim();

  async function link() {
    if (linking || !ready) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/school/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim(), firstName, lastName }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `${tr("onb.blocked.err.linkFailed")} (${res.status}).`);
        return;
      }
      onLinked();
    } catch {
      setError(tr("onb.err.network"));
    } finally {
      setLinking(false);
    }
  }

  return (
    <>
      <h1 style={heading}>
        {tr("onb.blocked.heading.a")} <RayaName />.
      </h1>
      <p style={sub}>{tr("onb.blocked.sub")}</p>

      <label style={fieldLabel}>{tr("onb.blocked.codeLabel")}</label>
      <input
        style={fieldInput}
        placeholder={tr("onb.blocked.codePlaceholder")}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoCapitalize="characters"
        disabled={linking}
      />
      <label style={fieldLabel}>{tr("onb.blocked.nameLabel")}</label>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          style={fieldInput}
          placeholder={tr("onb.blocked.firstNamePlaceholder")}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={linking}
        />
        <input
          style={fieldInput}
          placeholder={tr("onb.blocked.lastNamePlaceholder")}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={linking}
        />
      </div>
      <button
        onClick={link}
        disabled={linking || !ready}
        style={{ ...primaryBtn, opacity: linking || !ready ? 0.6 : 1 }}
      >
        {linking ? tr("onb.blocked.linking") : tr("onb.blocked.submit")}
      </button>

      <div style={noteBox}>
        <strong style={{ color: "#0b1220" }}>{tr("onb.blocked.note.strong")}</strong> {tr("onb.blocked.note.a")}{" "}
        <a href="mailto:hello@thebluestift.com" style={{ color: WORDMARK_B, fontWeight: 600 }}>
          hello@thebluestift.com
        </a>{" "}
        {tr("onb.blocked.note.b")}
      </div>
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "12px 0 0" }}>
        {tr("onb.blocked.closed")}
      </p>

      <button
        onClick={onLeave}
        disabled={busy}
        style={{ ...secondaryBtn, marginTop: 16, width: "100%" }}
      >
        {tr("menu.signOut")}
      </button>

      {error && <p style={{ color: "#dc2626", textAlign: "center", marginTop: 14, fontSize: 14 }}>{error}</p>}
    </>
  );
}

// -------------------------------------------------------------- Fragments ---
// Line icons (currentColor) — accent blue when idle, white when a card is
// selected. The two path cards use real product logos instead (see above).
function Icon({ on = false, color, children }: { on?: boolean; color?: string; children: React.ReactNode }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? (on ? "#ffffff" : WORDMARK_B)}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const IconSchool = (
  <>
    <path d="M3 21h18" />
    <path d="M5 21V8l7-4 7 4v13" />
    <path d="M9.5 21v-5h5v5" />
    <path d="M9 10h.01M15 10h.01" />
  </>
);
const IconTeacher = (
  <>
    <rect x="3" y="3.5" width="18" height="12" rx="1.5" />
    <path d="M12 15.5v3M8.5 21h7" />
    <path d="M7 8h6M7 11h4" />
  </>
);
const IconKey = (
  <>
    <circle cx="8" cy="8" r="4.5" />
    <path d="M11.4 11.4 20 20M16 16l2-2M18.5 18.5l1.5-1.5" />
  </>
);

// ----------------------------------------------------------------- Styles ---
const cardLogo: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 };
const keyPill: React.CSSProperties = {
  background: "#ffffff",
  color: "#0b1220",
  border: "1px solid #dde5ee",
  borderRadius: 99,
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const roleCard = (on: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  textAlign: "left",
  background: on ? "#0b1220" : "#f7f9fc",
  border: `1px solid ${on ? "#0b1220" : "#dde5ee"}`,
  borderRadius: 14,
  padding: "13px 15px",
  cursor: "pointer",
});
const pathTitle = (on = false): React.CSSProperties => ({
  display: "block",
  fontSize: 15,
  fontWeight: 700,
  color: on ? "#fff" : "#0b1220",
});
const pathDesc = (on = false): React.CSSProperties => ({
  display: "block",
  fontSize: 14,
  color: on ? "rgba(255,255,255,0.9)" : "#475569",
});
const noteBox: React.CSSProperties = {
  background: "#f3f6fa",
  border: "1px solid #dde5ee",
  borderRadius: 12,
  padding: 14,
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.6,
};
const chipRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
const chip = (on: boolean): React.CSSProperties => ({
  background: on ? "#0b1220" : "#f3f6fa",
  color: on ? "#fff" : "#334155",
  border: `1px solid ${on ? "#0b1220" : "#dde5ee"}`,
  borderRadius: 99,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
});
