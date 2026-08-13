"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearLocalData } from "@/lib/net/local-data";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { useResolvedTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";
import { status } from "@/components/ui/tokens";
import { avatarInitials } from "@/lib/name";
import {
  downloadRecoveryKey,
  formatRecoveryKey,
  isValidRecoveryKey,
  maskedRecoveryKey,
  normalizeRecoveryKey,
} from "@/lib/recovery-key";

type Profile = {
  username: string | null;
  display_name: string | null;
  account_type: string;
  account_state: string;
  profile_picture_url: string | null;
} | null;

/** What the server can say about the key WITHOUT being able to read it. */
export type RecoveryKeyInfo = { hasKey: boolean; issuedAt: string | null };

type Props = {
  user: { id: string; email: string | null; isAnonymous: boolean } | null;
  profile: Profile;
  recoveryKey?: RecoveryKeyInfo;
  /** Card width cap. Defaults to 560 (login); the Settings column passes a wider
   *  value so the card fills its centred column instead of hugging the left. */
  maxWidth?: number;
};

export function AuthPanel({
  user,
  profile,
  recoveryKey = { hasKey: false, issuedAt: null },
  maxWidth = 560,
}: Props) {
  const { theme: t } = useResolvedTheme();
  const supabase = createClient();
  const router = useRouter();
  const turnstileRef = useRef<TurnstileHandle>(null);

  const card = panelCard(t);
  const btn = ctaButton(t);
  const ghost = { ...ctaButton(t), background: t.cardBg2, color: t.text, border: `1px solid ${t.cardBorder}` };
  const input = { ...textInput(t), width: "auto" as const, flex: 1, minWidth: 200 };

  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=/account`
      : undefined;

  function resetCaptcha() {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }

  async function startAnonymous() {
    if (!captchaToken) return setMsg("Complete the CAPTCHA first.");
    setBusy(true);
    setMsg(null);
    try {
      // Server-side: creates the anonymous account, makes it recoverable, and
      // re-mints the session (attaching the recovery credential revokes it).
      const res = await fetch("/api/auth/anon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ captchaToken }),
      });
      const data = await res.json().catch(() => null);
      resetCaptcha();
      if (!res.ok) return setMsg(data?.error ?? "Couldn't start. Try again.");
      router.refresh();
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmailLink() {
    if (!email) return;
    if (!user?.isAnonymous && !captchaToken) return setMsg("Complete the CAPTCHA first.");
    setBusy(true);
    setMsg(null);
    const { error } = user?.isAnonymous
      ? await supabase.auth.updateUser({ email }, { emailRedirectTo })
      : await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo,
            shouldCreateUser: true,
            captchaToken: captchaToken ?? undefined,
          },
        });
    setBusy(false);
    resetCaptcha();
    if (error) return setMsg(error.message);
    setMsg(`Link sent to ${email}. Check your inbox.`);
  }

  async function recoverWithKey() {
    // Accept the key however it was written down — grouped, spaced, lowercase.
    const code = normalizeRecoveryKey(recoveryCode);
    if (!code) return;
    if (!captchaToken) return setMsg("Complete the CAPTCHA first.");
    if (!isValidRecoveryKey(code)) {
      return setMsg("A recovery key is 16 characters. Check for a missing one.");
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, captchaToken }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        resetCaptcha();
        return setMsg(data?.error ?? "Recovery failed.");
      }
      if (data.status === "recovered") {
        // Session cookies were set on the response — go straight in.
        setMsg("Good to see you again — signing in…");
        router.refresh();
        router.push("/account");
        return;
      }
      resetCaptcha();
      if (data.status === "sent")
        setMsg("If that key is valid, a sign-in link was sent to the account. Check your inbox.");
      else setMsg("That recovery key isn't valid.");
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    // Shared machines: wipe locally retained user data before switching users.
    await clearLocalData();
    await supabase.auth.signOut();
    setBusy(false);
    router.refresh();
  }

  async function uploadAvatar(file: File | null) {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return setMsg("Choose an image.");
    setBusy(true);
    setMsg(null);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const up = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) {
        setBusy(false);
        return setMsg(up.error.message);
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      const busted = `${publicUrl}?v=${Date.now()}`;
      const { error } = await supabase
        .from("users")
        .update({ profile_picture_url: busted })
        .eq("id", user.id);
      setBusy(false);
      if (error) return setMsg(error.message);
      setMsg("Profile picture updated.");
      router.refresh();
    } catch {
      setBusy(false);
      setMsg("Couldn't upload the picture.");
    }
  }

  const infoRow = (label: string, value: React.ReactNode) => (
    <div style={{ borderTop: `1px solid ${t.cardBorder}`, paddingTop: 12 }}>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: t.text }}>{value}</div>
    </div>
  );

  // ---- Signed out (/login) ----
  if (!user) {
    const label: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: t.text, margin: "0 0 8px" };
    return (
      <div style={{ ...card, width: "100%", maxWidth }}>
        <h2 style={cardTitle(t)}>Sign in or get started</h2>

        <div style={{ margin: "14px 0" }}>
          <Turnstile ref={turnstileRef} onVerify={setCaptchaToken} />
        </div>

        {/* Returning users: an email link signs you back into your existing account. */}
        <p style={label}>Already have an account? Sign in by email</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input style={input} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button style={{ ...btn, opacity: busy || !email || !captchaToken ? 0.5 : 1 }} onClick={sendEmailLink} disabled={busy || !email || !captchaToken}>
            Send the link
          </button>
        </div>

        {/* Recovery key: emails a fresh link to the account on file. */}
        <p style={{ ...label, marginTop: 16 }}>Lost access? Use your recovery key</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input
            style={{ ...input, textTransform: "uppercase" }}
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
          />
          <button style={{ ...ghost, opacity: busy || !recoveryCode.trim() || !captchaToken ? 0.5 : 1 }} onClick={recoverWithKey} disabled={busy || !recoveryCode.trim() || !captchaToken}>
            Recover
          </button>
        </div>

        <div style={{ borderTop: `1px solid ${t.cardBorder}`, margin: "20px 0 16px" }} />

        {/* New users. */}
        <p style={label}>New here?</p>
        <button style={{ ...btn, opacity: busy || !captchaToken ? 0.5 : 1 }} onClick={startAnonymous} disabled={busy || !captchaToken}>
          Start anonymously
        </button>

        {msg && <p style={{ marginTop: 12, color: t.muted, fontSize: 15 }}>{msg}</p>}
      </div>
    );
  }

  // ---- Signed in (/account) ----
  return (
    <div style={{ ...card, width: "100%", maxWidth }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            overflow: "hidden",
            background: status.aiIndigo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 21,
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}
        >
          {profile?.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profile_picture_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            avatarInitials(profile?.display_name || profile?.username)
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{profile?.display_name ?? "—"}</div>
          <div style={{ fontSize: 14, color: t.muted }}>@{profile?.username ?? "—"}</div>
        </div>
        <label style={{ ...ghost, display: "inline-block" }}>
          Change photo
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadAvatar(e.target.files?.[0] ?? null)} disabled={busy} />
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {infoRow(
          "Email",
          <>
            {user.email ?? "—"} {user.isAnonymous && <em style={{ color: t.mutedLight }}>(anonymous)</em>}
          </>,
        )}
        {infoRow("Account type", <code>{profile?.account_type ?? "?"}</code>)}
        <RecoveryKeyCard hasKey={recoveryKey.hasKey} issuedAt={recoveryKey.issuedAt} />


        {user.isAnonymous && (
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${t.dark ? "rgba(245,158,11,0.35)" : "rgba(245,158,11,0.5)"}`,
              background: "rgba(245,158,11,0.08)",
              padding: 16,
              marginTop: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 17 }} aria-hidden>
                ⚠️
              </span>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Your progress isn&apos;t safe yet</div>
            </div>
            {/* Loss aversion, honestly framed — this is literally true for an
                anonymous account: no linked email means one cleared browser or
                one lost recovery key wipes everything. */}
            <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
              This account lives only on this device. If you clear your browser or lose your recovery key,
              your <strong style={{ color: t.text }}>conversations, self-tests and Kernel profile disappear for good</strong>.
              Link an email now to keep them.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <input style={input} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button
                style={{ ...btn, opacity: busy || !email ? 0.5 : 1 }}
                onClick={sendEmailLink}
                disabled={busy || !email}
              >
                Keep my progress
              </button>
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          disabled={busy}
          style={{ marginTop: 4, alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontSize: 14, color: status.danger, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>

      {msg && <p style={{ marginTop: 12, color: t.muted, fontSize: 15 }}>{msg}</p>}
    </div>
  );
}

/**
 * Recovery key panel.
 *
 * There is no "reveal" any more, and that absence is the feature: only a SHA-256
 * of the key is stored, so the server genuinely cannot show it again. What the
 * card offers instead is a replacement — generated on demand, displayed once in
 * this component's state, and never persisted anywhere we can read back.
 *
 * The freshly generated key is still masked by default. It is on screen at the
 * exact moment a child is most likely to be screen-sharing or sitting in a
 * classroom, so Reveal stays an explicit act.
 */
function RecoveryKeyCard({
  hasKey,
  issuedAt,
}: {
  hasKey: boolean;
  issuedAt: string | null;
}) {
  const { theme: t } = useResolvedTheme();
  const [code, setCode] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    // Replacing a key the user still holds is destructive, so the second press
    // is the confirmation. Nothing to confirm when no key has ever been issued.
    if (hasKey && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/recovery-key", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { code?: string; error?: string; warning?: string }
        | null;
      if (!res.ok || !data?.code) {
        setErr(data?.error ?? "Could not generate a key. Try again.");
        return;
      }
      setCode(data.code);
      setShown(true); // it exists only now — hiding it on arrival helps nobody
      setConfirming(false);
      if (data.warning) setErr(data.warning);
    } catch {
      setErr("Could not generate a key. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatRecoveryKey(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    if (!code) return;
    downloadRecoveryKey(code);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const pill: React.CSSProperties = {
    background: t.cardBg2,
    color: t.text,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 99,
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  const masked = maskedRecoveryKey(code);

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${t.dark ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.35)"}`,
        background: t.dark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.06)",
        padding: 16,
        marginTop: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 17 }} aria-hidden>
          🔑
        </span>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, flex: 1 }}>Recovery key</div>
      </div>
      <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
        {code ? (
          <>
            Here is your new key. <strong style={{ color: t.text }}>This is the only time it will be
            shown</strong> — save it now. Any older key has stopped working.
          </>
        ) : hasKey ? (
          <>
            Your key is the <strong style={{ color: t.text }}>only way back into this account</strong> if
            you lose access. We store only a fingerprint of it, so we genuinely can&apos;t show it to you
            again — if you&apos;ve lost it, generate a new one and the old one stops working.
          </>
        ) : (
          <>
            You don&apos;t have a recovery key yet. It is the{" "}
            <strong style={{ color: t.text }}>only way back into this account</strong> if you lose access
            to this device.
          </>
        )}
      </p>

      {code && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <code
            style={{
              flex: 1,
              minWidth: 160,
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 15,
              letterSpacing: shown ? "0.12em" : "0.24em",
              color: t.text,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              userSelect: shown ? "all" : "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {shown ? formatRecoveryKey(code) : masked}
          </code>
          <button type="button" style={pill} onClick={() => setShown((s) => !s)}>
            {shown ? "Hide" : "Reveal"}
          </button>
          <button type="button" style={pill} onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button type="button" style={pill} onClick={download}>
            {saved ? "Saved ✓" : "Download"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={{ ...pill, opacity: busy ? 0.5 : 1 }} onClick={generate} disabled={busy}>
          {busy
            ? "Generating…"
            : confirming
              ? "Yes, replace my key"
              : hasKey
                ? "Generate a new key"
                : "Generate my key"}
        </button>
        {confirming && !busy && (
          <>
            <span style={{ fontSize: 13, color: t.muted }}>Your current key will stop working.</span>
            <button
              type="button"
              style={{ ...pill, border: "none", background: "none", color: t.muted }}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        )}
        {!code && issuedAt && !confirming && (
          <span style={{ fontSize: 13, color: t.mutedLight }}>
            Issued {new Date(issuedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {err && <p style={{ fontSize: 13, color: t.muted, margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}
