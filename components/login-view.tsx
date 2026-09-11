"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { passwordProblem } from "@/lib/password";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import {
  AuthSplit,
  RayaName,
  SchoolsName,
  heading,
  sub,
  fieldLabel,
  fieldInput,
  primaryBtn,
  secondaryBtn,
} from "@/components/ui/auth-chrome";
import { useTranslate } from "@/components/ui/locale";
import { LinkSentDialog } from "@/components/ui/link-sent-dialog";
import { PasswordField } from "@/components/ui/password-field";

/**
 * Sign-in surface (/login) — full-screen split, styled to match onboarding
 * (shared chrome in ui/auth-chrome). Light-only, outside the themed app shell.
 * Auth logic mirrors components/auth-panel.tsx.
 *
 * FOUR ways in, and they are not interchangeable:
 *   · email + password — the one people expect, and the only one that works
 *     with no inbox to hand (a shared school machine, a phone with the mail app
 *     signed in as someone else);
 *   · a magic link — no password to remember, which for a twelve-year-old is
 *     the difference between having an account next term and not;
 *   · a recovery key — the way back for an account that never had an email;
 *   · anonymous — the front door of the product, kept last so it reads as the
 *     alternative to signing up rather than as the fallback from failing to.
 */
export function LoginView({
  initialError,
  pendingSetup = false,
}: {
  initialError?: string;
  /** A signed-in account that never finished onboarding is sitting on this page.
   *  It can resume, or pick a different sign-in method — in which case we drop
   *  that session first so the new flow starts clean. */
  pendingSetup?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const tr = useTranslate();
  const turnstileRef = useRef<TurnstileHandle>(null);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    initialError === "auth" ? tr("login.err.invalidLink") : null,
  );
  /**
   * "A link is out there, waiting to be opened." Separate from `msg` — which is
   * one slot shared by every error on this form — because this is not a status
   * line: it is a state the page is IN, and it stays open watching for the
   * sign-in that will happen in another window.
   *
   * `dest` is where THIS tab goes once that happens, and it differs by flow: a
   * sign-in link means "come in", a password-reset link means "come and finish
   * choosing the password" — following the first one for the second would land
   * the person home with the reset half-done in another tab.
   */
  const [pending, setPending] = useState<{ email?: string; dest: string } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const emailRedirectTo = origin ? `${origin}/auth/callback?next=/account` : undefined;

  // Shown live under the field while creating an account, so the rule arrives
  // before the submit does — but not while signing in, where the password is an
  // existing one and our policy has no business grading it.
  const pwProblem = mode === "signup" && password ? passwordProblem(password, email) : null;
  const credentialsReady =
    Boolean(email && password && captchaToken) && (mode === "signin" || !pwProblem);

  function resetCaptcha() {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  /**
   * Changing your mind mid-setup must actually change something: sign the
   * half-finished session out before starting another flow, otherwise the old
   * cookie survives and every route keeps sending you back to /onboarding.
   * The abandoned account isn't deleted — it stays reachable by recovery key.
   */
  async function clearPendingSession() {
    if (!pendingSetup) return;
    await supabase.auth.signOut();
  }

  async function leaveSetup() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    setMsg(tr("login.msg.signedOut"));
    router.refresh();
  }

  /**
   * A full navigation rather than router.push, on every path that ends in a
   * session: the cookies were written outside React's knowledge, so every RSC
   * payload cached on this page predates them. /auth/continue then resolves the
   * one destination the flow gate allows (onboarding, or home).
   */
  function enterApp() {
    window.location.assign("/auth/continue");
  }

  async function startAnonymous() {
    if (!captchaToken) return setMsg(tr("auth.err.captcha"));
    setBusy(true);
    setMsg(null);
    try {
      await clearPendingSession();
      const res = await netFetch(
        "/api/auth/anon",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ captchaToken }),
        },
        { timeoutMs: 15_000 },
      );
      const data = await res.json().catch(() => null);
      resetCaptcha();
      if (!res.ok) return setMsg(data?.error ?? tr("auth.err.startFailed"));
      router.refresh();
    } catch {
      setMsg(tr("auth.err.network"));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword() {
    if (!credentialsReady) return;
    setBusy(true);
    setMsg(null);
    await clearPendingSession();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken ?? undefined },
    });
    setBusy(false);
    resetCaptcha();
    // Supabase answers "Invalid login credentials" to a wrong password AND to an
    // address that has no password at all — which on this product is the common
    // case, because most accounts start anonymous or magic-link only. Say so,
    // and point at the two doors that do work, rather than leaving someone
    // retyping a password they never set.
    if (error) return setMsg(tr("login.err.badCredentials"));
    enterApp();
  }

  async function signUpWithPassword() {
    if (!credentialsReady) return;
    setBusy(true);
    setMsg(null);
    await clearPendingSession();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo, captchaToken: captchaToken ?? undefined },
    });
    setBusy(false);
    resetCaptcha();
    if (error) return setMsg(error.message);
    // A session comes back only when the project has email confirmation turned
    // off. With it on — how this one ships — there is no session yet and the
    // account is not usable until the link is opened, so we wait for it here.
    if (data.session) return enterApp();
    setPending({ email, dest: "/auth/continue" });
  }

  async function sendEmailLink() {
    if (!email) return;
    if (!captchaToken) return setMsg(tr("auth.err.captcha"));
    setBusy(true);
    setMsg(null);
    await clearPendingSession();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo, shouldCreateUser: true, captchaToken: captchaToken ?? undefined },
    });
    setBusy(false);
    resetCaptcha();
    if (error) return setMsg(error.message);
    setPending({ email, dest: "/auth/continue" });
  }

  async function forgotPassword() {
    if (!email) return setMsg(tr("login.err.emailFirst"));
    if (!captchaToken) return setMsg(tr("auth.err.captcha"));
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: origin ? `${origin}/auth/callback?next=/reset` : undefined,
      captchaToken: captchaToken ?? undefined,
    });
    setBusy(false);
    resetCaptcha();
    if (error) return setMsg(error.message);
    // Both tabs end up on /reset — the one the person is looking at can finish
    // the job, whichever that turns out to be.
    setPending({ email, dest: "/reset" });
  }

  async function recoverWithKey() {
    if (!recoveryCode.trim()) return;
    if (!captchaToken) return setMsg(tr("auth.err.captcha"));
    setBusy(true);
    setMsg(null);
    try {
      await clearPendingSession();
      const res = await netFetch(
        "/api/auth/recover",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: recoveryCode.trim(), captchaToken }),
        },
        { timeoutMs: 15_000 },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        resetCaptcha();
        return setMsg(data?.error ?? tr("auth.err.recoveryFailed"));
      }
      if (data.status === "recovered") {
        setMsg(tr("auth.msg.recovered"));
        router.refresh();
        router.push("/account");
        return;
      }
      resetCaptcha();
      // Same wait, same dialog — the account's address is not ours to show to
      // whoever typed the key, so the dialog falls back to "if that key is
      // valid…" rather than naming it.
      if (data.status === "sent") setPending({ dest: "/auth/continue" });
      else setMsg(tr("auth.err.keyInvalid"));
    } catch {
      setMsg(tr("auth.err.network"));
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <div style={{ marginBottom: 8 }}>
      <Link href="/" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
        {tr("login.backToSite")}
      </Link>
    </div>
  );

  const tab = (value: "signin" | "signup", label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setMsg(null);
      }}
      aria-pressed={mode === value}
      style={{
        flex: 1,
        border: "none",
        borderRadius: 99,
        padding: "9px 12px",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        background: mode === value ? "#ffffff" : "transparent",
        color: mode === value ? "#0b1220" : "#64748b",
        boxShadow: mode === value ? "0 1px 3px rgba(11,18,32,0.12)" : "none",
      }}
    >
      {label}
    </button>
  );

  const linkish: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 14,
    fontWeight: 600,
    color: "#2f7fe0",
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <AuthSplit back={back}>
      <h1 style={heading}>
        {tr("login.heading")} <RayaName /> &amp; <SchoolsName />
      </h1>
      <p style={sub}>{tr("login.sub")}</p>

      {/* Half-finished setup: resume it, or walk away and choose another method. */}
      {pendingSetup && (
        <div
          style={{
            border: "1px solid #f3d9a4",
            background: "#fffaf0",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: 15, lineHeight: 1.6, color: "#7c5b16" }}>
            {tr("login.pending.note")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/onboarding"
              style={{ ...secondaryBtn, padding: "9px 14px", fontSize: 14, textDecoration: "none", display: "inline-block" }}
            >
              {tr("login.pending.continue")}
            </Link>
            <button
              style={{ ...secondaryBtn, padding: "9px 14px", fontSize: 14, opacity: busy ? 0.5 : 1 }}
              onClick={leaveSetup}
              disabled={busy}
            >
              {tr("login.pending.switchMethod")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", margin: "0 0 20px" }}>
        <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} />
      </div>

      {/* Sign in / create — one pair of fields, because they take the same two
          things and a person who picks the wrong tab should not have to retype
          anything to fix it. */}
      <div style={{ display: "flex", gap: 4, background: "#eef3f9", borderRadius: 99, padding: 4, marginBottom: 18 }}>
        {tab("signin", tr("login.tab.signIn"))}
        {tab("signup", tr("login.tab.signUp"))}
      </div>

      <label htmlFor="login-email" style={fieldLabel}>
        {tr("login.emailField")}
      </label>
      <input
        id="login-email"
        style={{ ...fieldInput, marginBottom: 14 }}
        type="email"
        autoComplete="email"
        placeholder={tr("auth.login.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <PasswordField
        value={password}
        onChange={setPassword}
        label={tr("pw.label")}
        placeholder={mode === "signup" ? tr("pw.placeholder") : undefined}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        hint={mode === "signup" ? tr("pw.hint") : undefined}
        problem={pwProblem ? tr(pwProblem) : null}
        disabled={busy}
        onEnter={mode === "signup" ? signUpWithPassword : signInWithPassword}
      />

      <button
        style={{ ...primaryBtn, opacity: busy || !credentialsReady ? 0.5 : 1 }}
        onClick={mode === "signup" ? signUpWithPassword : signInWithPassword}
        disabled={busy || !credentialsReady}
      >
        {mode === "signup" ? tr("login.signUpBtn") : tr("login.signInBtn")}
      </button>

      {/* The passwordless routes, kept one tap away rather than behind a second
          screen: they are the ones this product's youngest users rely on. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
        <button style={{ ...linkish, opacity: busy || !email || !captchaToken ? 0.5 : 1 }} onClick={sendEmailLink} disabled={busy || !email || !captchaToken}>
          {tr("login.magicInstead")}
        </button>
        {mode === "signin" && (
          <button style={{ ...linkish, color: "#64748b", opacity: busy ? 0.5 : 1 }} onClick={forgotPassword} disabled={busy}>
            {tr("login.forgot")}
          </button>
        )}
      </div>

      {/* Recovery key. */}
      <label htmlFor="login-recovery" style={{ ...fieldLabel, marginTop: 22 }}>
        {tr("auth.login.recoveryLabel")}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="login-recovery"
          style={{ ...fieldInput, marginBottom: 0, flex: 1, letterSpacing: "0.08em" }}
          type="text"
          placeholder={tr("login.recoveryPlaceholder")}
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
        />
        <button
          style={{ ...secondaryBtn, padding: "12px 16px", opacity: busy || !recoveryCode.trim() || !captchaToken ? 0.5 : 1 }}
          onClick={recoverWithKey}
          disabled={busy || !recoveryCode.trim() || !captchaToken}
        >
          {tr("auth.login.recoverBtn")}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 16px" }}>
        <span style={{ flex: 1, height: 1, background: "#e6ecf3" }} />
        <span style={{ fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{tr("login.newHereDivider")}</span>
        <span style={{ flex: 1, height: 1, background: "#e6ecf3" }} />
      </div>

      <button
        style={{ ...secondaryBtn, width: "100%", opacity: busy || !captchaToken ? 0.5 : 1 }}
        onClick={startAnonymous}
        disabled={busy || !captchaToken}
      >
        {tr("login.startAnonymous")}
      </button>

      {msg && <p style={{ marginTop: 14, color: "#475569", fontSize: 15, textAlign: "center" }}>{msg}</p>}

      {pending && (
        <LinkSentDialog
          supabase={supabase}
          email={pending.email}
          onClose={() => setPending(null)}
          onConfirmed={() => window.location.assign(pending.dest)}
        />
      )}
    </AuthSplit>
  );
}
