"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { passwordProblem } from "@/lib/password";
import { AuthSplit, heading, sub, primaryBtn } from "@/components/ui/auth-chrome";
import { PasswordField } from "@/components/ui/password-field";
import { useTranslate } from "@/components/ui/locale";

/**
 * The far end of "forgot your password?".
 *
 * Reaching this screen at all IS the authentication: the reset link was
 * exchanged for a session by /auth/callback (or /auth/confirm), and the page
 * behind this refuses to render without one. So there is no old password to
 * ask for — demanding one here would lock out exactly the person the flow
 * exists for.
 *
 * Confirmation field included, because this is the one password entry with no
 * way to find out you mistyped it: a wrong password at sign-in tells you
 * immediately, a wrong password set here tells you next week.
 */
export function ResetPasswordView({ email }: { email: string | null }) {
  const supabase = createClient();
  const tr = useTranslate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problem = password ? passwordProblem(password, email ?? undefined) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = Boolean(password) && !problem && !mismatch && confirm === password;

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    // Full navigation: the credential changed underneath every cached payload
    // on this page, and /auth/continue resolves where this account belongs.
    setTimeout(() => window.location.assign("/auth/continue"), 900);
  }

  return (
    <AuthSplit>
      <h1 style={heading}>{tr("reset.heading")}</h1>
      <p style={sub}>{email ? `${tr("reset.subFor")} ${email}` : tr("reset.sub")}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <PasswordField
          value={password}
          onChange={setPassword}
          label={tr("reset.newLabel")}
          placeholder={tr("pw.placeholder")}
          autoComplete="new-password"
          hint={tr("pw.hint")}
          problem={problem ? tr(problem) : null}
          disabled={busy || done}
        />
        <PasswordField
          value={confirm}
          onChange={setConfirm}
          label={tr("reset.confirmLabel")}
          autoComplete="new-password"
          problem={mismatch ? tr("reset.err.mismatch") : null}
          disabled={busy || done}
          onEnter={save}
        />
      </div>

      <button
        style={{ ...primaryBtn, marginTop: 18, opacity: busy || !ready || done ? 0.5 : 1 }}
        onClick={save}
        disabled={busy || !ready || done}
      >
        {done ? tr("reset.saved") : tr("reset.save")}
      </button>

      {err && <p style={{ marginTop: 14, color: "#b91c1c", fontSize: 15, textAlign: "center" }}>{err}</p>}

      <p style={{ marginTop: 18, textAlign: "center" }}>
        <Link href="/login" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
          {tr("reset.backToLogin")}
        </Link>
      </p>
    </AuthSplit>
  );
}
