"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { useResolvedTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";
import { status } from "@/components/ui/tokens";

type Profile = {
  username: string | null;
  display_name: string | null;
  account_type: string;
  account_state: string;
  recovery_code: string | null;
  profile_picture_url: string | null;
} | null;

type Props = {
  user: { id: string; email: string | null; isAnonymous: boolean } | null;
  profile: Profile;
};

export function AuthPanel({ user, profile }: Props) {
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
    if (!recoveryCode.trim()) return;
    if (!captchaToken) return setMsg("Complete the CAPTCHA first.");
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: recoveryCode.trim(), captchaToken }),
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
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: t.text }}>{value}</div>
    </div>
  );

  // ---- Signed out (/login) ----
  if (!user) {
    const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: t.text, margin: "0 0 8px" };
    return (
      <div style={{ ...card, maxWidth: 560 }}>
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
          <input style={input} type="text" placeholder="Recovery key" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
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

        {msg && <p style={{ marginTop: 12, color: t.muted, fontSize: 12.5 }}>{msg}</p>}
      </div>
    );
  }

  // ---- Signed in (/account) ----
  return (
    <div style={{ ...card, maxWidth: 560 }}>
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
            fontSize: 18,
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}
        >
          {profile?.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profile_picture_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{profile?.display_name ?? "—"}</div>
          <div style={{ fontSize: 11.5, color: t.muted }}>@{profile?.username ?? "—"}</div>
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
        <RecoveryKeyCard code={profile?.recovery_code ?? null} />


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
              <span style={{ fontSize: 15 }} aria-hidden>
                ⚠️
              </span>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>Your progress isn&apos;t safe yet</div>
            </div>
            {/* Loss aversion, honestly framed — this is literally true for an
                anonymous account: no linked email means one cleared browser or
                one lost recovery key wipes everything. */}
            <p style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
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
          style={{ marginTop: 4, alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontSize: 11.5, color: status.danger, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>

      {msg && <p style={{ marginTop: 12, color: t.muted, fontSize: 12.5 }}>{msg}</p>}
    </div>
  );
}

/**
 * Recovery key panel: the single credential that lets an email-less account get
 * back in, so it must be *seen once, copied, and hidden*. Masked by default
 * (shoulder-surfing / screen-share safe), a Reveal toggle shows it, and a Copy
 * button lets the user stash it in a password manager without ever typing it.
 */
function RecoveryKeyCard({ code }: { code: string | null }) {
  const { theme: t } = useResolvedTheme();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const pill: React.CSSProperties = {
    background: t.cardBg2,
    color: t.text,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 99,
    padding: "5px 12px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };

  const masked = "•".repeat(code ? Math.min(code.length, 16) : 12);

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
        <span style={{ fontSize: 15 }} aria-hidden>
          🔑
        </span>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text, flex: 1 }}>Recovery key</div>
      </div>
      <p style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
        This key is the <strong style={{ color: t.text }}>only way back into this account</strong> if you
        lose access. Copy it somewhere safe (a password manager), then hide it. We can&apos;t recover it for you.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <code
          style={{
            flex: 1,
            minWidth: 160,
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            letterSpacing: shown ? "0.12em" : "0.24em",
            color: t.text,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            userSelect: shown ? "all" : "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {code ? (shown ? code : masked) : "—"}
        </code>
        <button type="button" style={pill} onClick={() => setShown((s) => !s)} disabled={!code}>
          {shown ? "Hide" : "Reveal"}
        </button>
        <button type="button" style={pill} onClick={copy} disabled={!code}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
