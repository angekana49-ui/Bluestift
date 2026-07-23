"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AuthSplit,
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

/**
 * First-run account setup for BlueStift — the umbrella brand over RAYA (the
 * tutor) and Schools. Full-screen split (shared chrome in ui/auth-chrome).
 *
 * Shape:
 * - TWO differentiated tracks chosen up front: RAYA (learn) and Schools
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

const RAYA_STEPS = ["path", "name", "level", "subjects", "goal"] as const;
const SCHOOL_STEPS = ["path", "name", "srole", "focus", "ready"] as const;

const LEVELS = [
  { value: "middle_school", label: "Middle school" },
  { value: "high_school", label: "High school" },
  { value: "university", label: "University" },
  { value: "other", label: "Other" },
];

const SUBJECTS = [
  "Maths",
  "Physics",
  "Chemistry",
  "Biology",
  "History & Geography",
  "Languages",
  "Economics",
  "Computer science",
  "Philosophy",
  "Other",
];

const DEFAULT_GOAL = "Understand my lessons more deeply and feel ready for exams.";

export function OnboardingForm({
  userId,
  emailVerified,
  isAnonymous,
  recoveryCode,
  initialUsername,
  initialDisplayName,
}: {
  userId: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  recoveryCode: string | null;
  initialUsername: string;
  initialDisplayName: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [track, setTrack] = useState<Track | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<"steps" | "email" | "welcome">("steps");

  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [level, setLevel] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [schoolRole, setSchoolRole] = useState<SchoolRole | null>(null);
  const [focus, setFocus] = useState("");

  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savedKey, setSavedKey] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = track === "schools" ? SCHOOL_STEPS : RAYA_STEPS;
  const stepKey = steps[stepIndex];
  const identityReady = username.trim().length > 0 && displayName.trim().length > 0;

  const totalSteps = isAnonymous ? 6 : 5;
  const stepNumber = phase === "email" ? 6 : stepIndex + 1;
  const progress = Math.round(28 + ((stepNumber - 1) / (totalSteps - 1)) * 67);

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
      setStepIndex(4);
      return;
    }
    if (stepIndex === 0) return;
    if (stepIndex === 1) setTrack(null);
    setStepIndex((i) => i - 1);
  }

  function validate(): string | null {
    switch (stepKey) {
      case "name":
        return identityReady ? null : "Choose a username and a display name.";
      case "level":
        return level ? null : "Pick your level.";
      case "srole":
        return schoolRole ? null : "Tell us how you'll use Schools.";
      default:
        return null;
    }
  }

  async function next() {
    if (busy) return;
    const err = validate();
    if (err) return setError(err);
    setError(null);
    if (stepIndex < 4) return setStepIndex((i) => i + 1);
    await commit();
  }

  async function commit() {
    const u = username.trim();
    const d = displayName.trim();
    if (!u || !d) {
      setStepIndex(1);
      return setError("Choose a username and a display name.");
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
        setStepIndex(1);
        return setError("That username is already taken.");
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
              Welcome to BlueStift, {firstName}.
            </h1>
          </div>
          <p style={{ maxWidth: 400, margin: "16px auto 0", fontSize: 14, lineHeight: 1.7, color: "#475569" }}>
            {track === "schools" ? (
              "Your account is ready. Let's get your school set up."
            ) : (
              <>Your account is ready. <RayaName /> will adapt to how you learn from your very first session.</>
            )}
          </p>

          <button onClick={enterApp} style={{ ...primaryBtn, width: "auto", padding: "14px 28px", marginTop: 26 }}>
            {track === "schools" ? <>Open <SchoolsName /> →</> : "Start learning →"}
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
        style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
      >
        ← Use a different sign-in method
      </button>
    </div>
  );

  // ------------------------------------------------------------- Full screen ---
  return (
    <AuthSplit back={switchMethodLink}>
      {/* Goal-gradient progress — seeded, never 0. */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Step {stepNumber} of {totalSteps}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: WORDMARK_B }}>{progress}% set up</span>
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
          savedKey={savedKey}
          setSavedKey={setSavedKey}
          busy={busy}
          onLink={linkEmail}
          onBack={back}
          onContinue={() => setPhase("welcome")}
        />
      ) : (
        <>
          {stepKey === "path" && (
            <>
              <h1 style={heading}>How will you use BlueStift?</h1>
              <p style={sub}>One account, two ways in — you can do both later.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => pickTrack("raya")} style={roleCard(false)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/raya-mark-black.png" alt="Raya" style={cardLogo} />
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle()}>Learn with <RayaName /></span>
                    <span style={pathDesc()}>Study solo or in rooms with your AI tutor.</span>
                  </span>
                </button>
                <button onClick={() => pickTrack("schools")} style={roleCard(false)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/bluestift-mark-dark.png" alt="BlueStift Schools" style={cardLogo} />
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle()}>Teach or run a school</span>
                    <span style={pathDesc()}>Join a team with a code, or set up your own school.</span>
                  </span>
                </button>
              </div>
            </>
          )}

          {stepKey === "name" && (
            <>
              <h1 style={heading}>What should we call you?</h1>
              <p style={sub}>Your username is unique; your display name is what others see.</p>
              <label style={fieldLabel}>Username (unique)</label>
              <input style={fieldInput} placeholder="e.g. alex_m" value={username} onChange={(e) => setUsername(e.target.value)} />
              <label style={fieldLabel}>Display name</label>
              <input style={fieldInput} placeholder="e.g. Alex" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </>
          )}

          {stepKey === "level" && (
            <>
              <h1 style={heading}>Where are you in school?</h1>
              <p style={sub}>This helps <RayaName /> pitch explanations at the right level.</p>
              <div style={chipRow}>
                {LEVELS.map((l) => (
                  <button key={l.value} onClick={() => setLevel(l.value)} style={chip(level === l.value)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {stepKey === "subjects" && (
            <>
              <h1 style={heading}>What do you want to work on?</h1>
              <p style={sub}>Pick a few — you can change these any time. (Optional)</p>
              <div style={chipRow}>
                {SUBJECTS.map((s) => (
                  <button key={s} onClick={() => toggleSubject(s)} style={chip(subjects.includes(s))}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {stepKey === "goal" && (
            <>
              <h1 style={heading}>What&apos;s your goal?</h1>
              <p style={sub}>A sentence is enough — <RayaName /> keeps it in mind.</p>
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
              <h1 style={heading}>How will you use <SchoolsName />?</h1>
              <p style={sub}>Pick one — you can also do both from one account.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => setSchoolRole("teacher")} style={roleCard(schoolRole === "teacher")}>
                  <Icon on={schoolRole === "teacher"}>{IconTeacher}</Icon>
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle(schoolRole === "teacher")}>I teach at a school</span>
                    <span style={pathDesc(schoolRole === "teacher")}>Join the team with the invite code your admin gave you.</span>
                  </span>
                </button>
                <button onClick={() => setSchoolRole("school")} style={roleCard(schoolRole === "school")}>
                  <Icon on={schoolRole === "school"}>{IconSchool}</Icon>
                  <span style={{ textAlign: "left" }}>
                    <span style={pathTitle(schoolRole === "school")}>I run a school</span>
                    <span style={pathDesc(schoolRole === "school")}>Set up your school, classes and access codes.</span>
                  </span>
                </button>
              </div>
            </>
          )}

          {stepKey === "focus" && (
            <>
              <h1 style={heading}>{schoolRole === "school" ? "What's your school about?" : "What do you teach?"}</h1>
              <p style={sub}>A short note helps us tailor your dashboard. (Optional)</p>
              <input
                style={fieldInput}
                placeholder={schoolRole === "school" ? "e.g. K-12 science academy, Yaoundé" : "e.g. Maths & Physics, high school"}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </>
          )}

          {stepKey === "ready" && (
            <>
              <h1 style={heading}>You&apos;re all set.</h1>
              <p style={sub}>Here&apos;s what happens next.</p>
              <div style={noteBox}>
                {schoolRole === "school"
                  ? "Next: name your school and add classes, access codes and teachers. You'll be its administrator — pricing is shown up front."
                  : "Next: enter your school's invite code to join the teaching team. No code yet? Your admin can send you one."}
              </div>
            </>
          )}

          {stepKey !== "path" && (
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={back} disabled={busy} style={secondaryBtn}>
                Back
              </button>
              <button onClick={next} disabled={busy} style={{ ...primaryBtn, marginTop: 0, flex: 1, opacity: busy ? 0.6 : 1 }}>
                {busy ? "…" : stepIndex === 4 ? "Finish →" : "Continue"}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p style={{ color: "#dc2626", textAlign: "center", marginTop: 16, fontSize: 12 }}>{error}</p>}
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
  savedKey,
  setSavedKey,
  busy,
  onLink,
  onBack,
  onContinue,
}: {
  recoveryCode: string | null;
  email: string;
  setEmail: (v: string) => void;
  emailSent: boolean;
  savedKey: boolean;
  setSavedKey: (v: boolean) => void;
  busy: boolean;
  onLink: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = "•".repeat(recoveryCode ? Math.min(recoveryCode.length, 16) : 12);

  async function copy() {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <h1 style={heading}>Secure your account</h1>
      <p style={sub}>You&apos;re signed in anonymously. Add an email so you never lose access — or keep just your recovery key.</p>

      <label style={fieldLabel}>Email (recommended)</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...fieldInput, marginBottom: 0, flex: 1 }}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || emailSent}
        />
        <button
          onClick={onLink}
          disabled={busy || emailSent || !email.trim()}
          style={{ ...secondaryBtn, padding: "12px 16px", opacity: busy || emailSent || !email.trim() ? 0.6 : 1 }}
        >
          {emailSent ? "Sent ✓" : "Link"}
        </button>
      </div>
      {emailSent && (
        <p style={{ fontSize: 11.5, color: "#047857", margin: "8px 0 0", lineHeight: 1.5 }}>
          Check your inbox to confirm — you can finish setting up now.
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
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0b1220" }}>Your recovery key</span>
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
              fontSize: 13,
              letterSpacing: shown ? "0.12em" : "0.24em",
              color: "#0b1220",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              userSelect: shown ? "all" : "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {recoveryCode ? (shown ? recoveryCode : masked) : "—"}
          </code>
          <button type="button" style={keyPill} onClick={() => setShown((s) => !s)} disabled={!recoveryCode}>
            {shown ? "Hide" : "Reveal"}
          </button>
          <button type="button" style={keyPill} onClick={copy} disabled={!recoveryCode}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#475569", lineHeight: 1.7 }}>
          <li>It is the <strong style={{ color: "#0b1220" }}>only way back in</strong> without an email.</li>
          <li>If you lose it, <strong style={{ color: "#0b1220" }}>we cannot recover it</strong> for you.</li>
          <li>Anyone who has it gets <strong style={{ color: "#0b1220" }}>full access</strong> to your account — its security is minimal, so keep it private.</li>
        </ul>
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, cursor: "pointer", fontSize: 12, color: "#334155" }}>
        <input type="checkbox" checked={savedKey} onChange={(e) => setSavedKey(e.target.checked)} style={{ marginTop: 2 }} />
        I&apos;ve saved my recovery key somewhere safe.
      </label>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button onClick={onBack} disabled={busy} style={secondaryBtn}>
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={busy || (!savedKey && !emailSent)}
          style={{ ...primaryBtn, marginTop: 0, flex: 1, opacity: busy || (!savedKey && !emailSent) ? 0.6 : 1 }}
        >
          Continue →
        </button>
      </div>
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
  fontSize: 11,
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
  fontSize: 13,
  fontWeight: 700,
  color: on ? "#fff" : "#0b1220",
});
const pathDesc = (on = false): React.CSSProperties => ({
  display: "block",
  fontSize: 11.5,
  color: on ? "rgba(255,255,255,0.9)" : "#475569",
});
const noteBox: React.CSSProperties = {
  background: "#f3f6fa",
  border: "1px solid #dde5ee",
  borderRadius: 12,
  padding: 14,
  fontSize: 12,
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
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
