"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

/**
 * Sign-in surface (/login) — full-screen split, styled to match onboarding
 * (shared chrome in ui/auth-chrome). Light-only, outside the themed app shell.
 * Same three flows as the account panel: email magic-link, recovery key, or a
 * fresh anonymous account. Auth logic mirrors components/auth-panel.tsx.
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

  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    initialError === "auth" ? tr("login.err.invalidLink") : null,
  );

  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/account` : undefined;

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

  async function startAnonymous() {
    if (!captchaToken) return setMsg(tr("auth.err.captcha"));
    setBusy(true);
    setMsg(null);
    try {
      await clearPendingSession();
      const res = await fetch("/api/auth/anon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ captchaToken }),
      });
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
    setMsg(`${tr("auth.msg.linkSent.a")} ${email}. ${tr("auth.msg.linkSent.b")}`);
  }

  async function recoverWithKey() {
    if (!recoveryCode.trim()) return;
    if (!captchaToken) return setMsg(tr("auth.err.captcha"));
    setBusy(true);
    setMsg(null);
    try {
      await clearPendingSession();
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: recoveryCode.trim(), captchaToken }),
      });
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
      if (data.status === "sent")
        setMsg(tr("auth.msg.keySent"));
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

      {/* Returning users: an email link signs you back into your existing account. */}
      <label style={fieldLabel}>{tr("login.emailLabel")}</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <input
          style={{ ...fieldInput, marginBottom: 0, flex: 1 }}
          type="email"
          placeholder={tr("auth.login.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          style={{ ...secondaryBtn, padding: "12px 16px", opacity: busy || !email || !captchaToken ? 0.5 : 1 }}
          onClick={sendEmailLink}
          disabled={busy || !email || !captchaToken}
        >
          {tr("login.sendLink")}
        </button>
      </div>

      {/* Recovery key. */}
      <label style={{ ...fieldLabel, marginTop: 16 }}>{tr("auth.login.recoveryLabel")}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
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
        style={{ ...primaryBtn, marginTop: 0, opacity: busy || !captchaToken ? 0.5 : 1 }}
        onClick={startAnonymous}
        disabled={busy || !captchaToken}
      >
        {tr("login.startAnonymous")}
      </button>

      {msg && <p style={{ marginTop: 14, color: "#475569", fontSize: 15, textAlign: "center" }}>{msg}</p>}
    </AuthSplit>
  );
}
