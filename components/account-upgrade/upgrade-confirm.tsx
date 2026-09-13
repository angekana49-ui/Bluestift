"use client";

import { useState } from "react";
import Link from "next/link";
import { netFetch } from "@/lib/net/client-fetch";
import { AuthSplit, heading, sub, primaryBtn } from "@/components/ui/auth-chrome";
import { FormAlert } from "@/components/ui/form-alert";
import { useTranslate } from "@/components/ui/locale";
import type { UpgradeConfirmError } from "@/lib/account-upgrade-shared";
import type { MessageKey } from "@/lib/i18n";

const ERROR_KEYS: Record<UpgradeConfirmError, { text: MessageKey; hint: MessageKey }> = {
  invalid: { text: "upgrade.confirm.err.invalid", hint: "upgrade.confirm.err.retryHint" },
  expired: { text: "upgrade.confirm.err.expired", hint: "upgrade.confirm.err.retryHint" },
  email_taken: { text: "upgrade.confirm.err.emailTaken", hint: "upgrade.confirm.err.retryHint" },
  already_verified: { text: "upgrade.confirm.err.alreadyVerified", hint: "upgrade.confirm.err.signInHint" },
  rate_limited: { text: "upgrade.err.rateLimited", hint: "upgrade.confirm.err.laterHint" },
  unavailable: { text: "upgrade.err.unavailable", hint: "upgrade.confirm.err.laterHint" },
};

/**
 * The last step of anonymous → verified: one button, then "you're verified".
 * Everything the account holds stays where it is — the page says so, because
 * "confirm your email" alone reads like the start of a new account.
 */
export function UpgradeConfirm({
  token,
  email,
  initialError,
}: {
  token: string;
  email: string | null;
  initialError: UpgradeConfirmError | null;
}) {
  const tr = useTranslate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UpgradeConfirmError | "network" | null>(initialError);
  const [done, setDone] = useState<{ dest: string; signedIn: boolean } | null>(null);

  async function confirm() {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const res = await netFetch(
        "/api/account/upgrade/confirm",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        },
        { timeoutMs: 20_000 },
      );
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; dest?: string; signedIn?: boolean; code?: UpgradeConfirmError }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.code ?? "unavailable");
        return;
      }
      setDone({ dest: data.dest ?? "/login", signedIn: Boolean(data.signedIn) });
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthSplit>
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 14 }} aria-hidden>
          ✅
        </div>
        <h1 style={heading}>{tr("upgrade.confirm.doneHeading")}</h1>
        <p style={sub}>{tr("upgrade.confirm.doneSub")}</p>
        <button
          style={primaryBtn}
          // A full navigation: this device just received a session, and every
          // cached payload on the page predates it.
          onClick={() => window.location.assign(done.dest)}
        >
          {done.signedIn ? tr("upgrade.confirm.continue") : tr("upgrade.confirm.signIn")}
        </button>
      </AuthSplit>
    );
  }

  // A link that cannot be used: say why, and give the way back.
  if (!email || (error && error !== "network" && error !== "unavailable" && error !== "rate_limited")) {
    const keys = ERROR_KEYS[(error && error !== "network" ? error : "invalid") as UpgradeConfirmError];
    return (
      <AuthSplit>
        <h1 style={heading}>{tr("upgrade.confirm.heading")}</h1>
        <FormAlert text={tr(keys.text)} hint={tr(keys.hint)} />
        <Link href="/account" style={{ ...primaryBtn, display: "block", textAlign: "center", textDecoration: "none", marginTop: 16 }}>
          {tr("upgrade.confirm.back")}
        </Link>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <h1 style={heading}>{tr("upgrade.confirm.heading")}</h1>
      <p style={sub}>
        {tr("upgrade.confirm.sub.a")} <strong style={{ color: "#0b1220", wordBreak: "break-all" }}>{email}</strong>{" "}
        {tr("upgrade.confirm.sub.b")}
      </p>
      <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={confirm} disabled={busy}>
        {busy ? "…" : tr("upgrade.confirm.button")}
      </button>
      {error && (
        <FormAlert
          text={error === "network" ? tr("upgrade.err.network") : tr(ERROR_KEYS[error].text)}
          hint={tr("upgrade.confirm.err.laterHint")}
        />
      )}
      <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginTop: 16 }}>{tr("upgrade.confirm.keyNote")}</p>
    </AuthSplit>
  );
}
