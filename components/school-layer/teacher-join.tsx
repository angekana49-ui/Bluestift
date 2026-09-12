"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { netFetch } from "@/lib/net/client-fetch";
import { useTranslate } from "@/components/ui/locale";
import { fieldInput, fieldLabel, heading, primaryBtn, secondaryBtn, sub } from "@/components/ui/auth-chrome";
import { AllSetCard, LayerShell } from "./layer-shell";

type Outcome =
  | { kind: "joined"; schoolName: string | null }
  | { kind: "requested"; schoolName: string | null }
  | { kind: "asked" };

/**
 * The teacher's form of the layer between onboarding and Schools: only what it
 * takes to be linked to a school.
 *
 * Two ways in. The invite code from the school's admin, which joins at once or
 * files a request depending on how the admin minted it. Or, with no code, the
 * school's or the admin's email, which files a request the admin approves in the
 * same queue (/api/school/request-access). Plus the one thing the admin needs to
 * recognise who is asking: the name they will see.
 */
export function TeacherJoin({ displayName, email }: { displayName: string; email: string }) {
  const tr = useTranslate();
  const [name, setName] = useState(displayName);
  const [code, setCode] = useState("");
  const [askEmail, setAskEmail] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<null | "join" | "ask">(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  /**
   * The name is saved before either request goes out, because the admin reads
   * it from the profile when the request lands. Only when it changed, and on
   * the column users may write (display_name).
   */
  async function saveName(): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(tr("layer.teacher.err.name"));
      return false;
    }
    if (trimmed === displayName) return true;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error: e } = await supabase.from("users").update({ display_name: trimmed.slice(0, 80) }).eq("id", user.id);
    if (e) {
      setError(e.message);
      return false;
    }
    return true;
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy("join");
    setError(null);
    try {
      if (!(await saveName())) return;
      const res = await netFetch(
        "/api/school/join-team",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        },
        { timeoutMs: 15_000 },
      );
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error ?? tr("layer.err.generic"));
        return;
      }
      setOutcome(
        d.status === "requested"
          ? { kind: "requested", schoolName: d.schoolName ?? null }
          : { kind: "joined", schoolName: d.schoolName ?? null },
      );
    } catch {
      setError(tr("layer.err.network"));
    } finally {
      setBusy(null);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !askEmail.trim()) return;
    setBusy("ask");
    setError(null);
    try {
      if (!(await saveName())) return;
      const res = await netFetch(
        "/api/school/request-access",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: askEmail.trim() }),
        },
        { timeoutMs: 15_000 },
      );
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error ?? tr("layer.err.generic"));
        return;
      }
      setOutcome({ kind: "asked" });
    } catch {
      setError(tr("layer.err.network"));
    } finally {
      setBusy(null);
    }
  }

  if (outcome) {
    if (outcome.kind === "joined") {
      return (
        <LayerShell maxWidth={560}>
          <AllSetCard
            title={tr("layer.allSet.title")}
            body={
              <>
                {tr("layer.teacher.joinedBody")}
                {outcome.schoolName && (
                  <>
                    {" "}
                    <strong style={{ color: "#0b1220" }}>{outcome.schoolName}</strong>
                  </>
                )}
                .
              </>
            }
            cta={tr("layer.teacher.openDashboard")}
            onCta={() => window.location.assign("/school")}
          />
        </LayerShell>
      );
    }
    // A request is not a membership. Same card, honest words, and the way on is
    // Raya — the one home a teacher without a school has.
    return (
      <LayerShell maxWidth={560}>
        <AllSetCard
          title={tr("layer.teacher.requestedTitle")}
          body={
            outcome.kind === "requested" && outcome.schoolName ? (
              <>
                {tr("layer.teacher.requestedBodyA")} <strong style={{ color: "#0b1220" }}>{outcome.schoolName}</strong>{" "}
                {tr("layer.teacher.requestedBodyB")}
              </>
            ) : (
              tr("layer.teacher.askedBody")
            )
          }
          cta={tr("layer.teacher.goRaya")}
          onCta={() => window.location.assign("/chat")}
        />
      </LayerShell>
    );
  }

  const switchLink = (
    <Link href="/school/enter?as=admin" style={{ fontSize: 15, fontWeight: 600, color: "#334155", textDecoration: "none" }}>
      {tr("layer.switch.toAdmin")}
    </Link>
  );

  return (
    <LayerShell maxWidth={520} top={switchLink}>
      <h1 style={heading}>{tr("layer.teacher.heading")}</h1>
      <p style={sub}>{tr("layer.teacher.sub")}</p>

      <label htmlFor="teacher-name" style={fieldLabel}>
        {tr("layer.teacher.name")}
      </label>
      <input
        id="teacher-name"
        style={{ ...fieldInput, marginBottom: 4 }}
        value={name}
        maxLength={80}
        autoComplete="name"
        onChange={(e) => setName(e.target.value)}
        disabled={busy !== null}
      />
      <p style={{ margin: "0 0 18px", fontSize: 14, color: "#64748b" }}>
        {tr("layer.teacher.signedInAs")} <strong style={{ color: "#334155" }}>{email}</strong>
      </p>

      <form onSubmit={join}>
        <label htmlFor="teacher-code" style={fieldLabel}>
          {tr("layer.teacher.code")}
        </label>
        <input
          id="teacher-code"
          style={{ ...fieldInput, letterSpacing: "0.12em", textTransform: "uppercase" }}
          placeholder={tr("layer.teacher.codePlaceholder")}
          value={code}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={busy !== null}
        />
        <button
          type="submit"
          disabled={busy !== null || !code.trim()}
          style={{ ...primaryBtn, marginTop: 0, opacity: busy !== null || !code.trim() ? 0.55 : 1 }}
        >
          {busy === "join" ? tr("layer.teacher.joining") : tr("layer.teacher.join")}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 14px" }}>
        <span style={{ flex: 1, height: 1, background: "#e6ecf3" }} />
        <span style={{ fontSize: 14, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {tr("layer.teacher.noCode")}
        </span>
        <span style={{ flex: 1, height: 1, background: "#e6ecf3" }} />
      </div>

      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} disabled={busy !== null} style={{ ...secondaryBtn, width: "100%" }}>
          {tr("layer.teacher.askTitle")}
        </button>
      ) : (
        <form onSubmit={ask}>
          <p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.6, color: "#475569" }}>{tr("layer.teacher.askSub")}</p>
          <input
            style={fieldInput}
            type="email"
            autoComplete="off"
            placeholder={tr("layer.teacher.askPlaceholder")}
            value={askEmail}
            maxLength={160}
            onChange={(e) => setAskEmail(e.target.value)}
            disabled={busy !== null}
          />
          <button
            type="submit"
            disabled={busy !== null || !askEmail.trim()}
            style={{ ...secondaryBtn, width: "100%", opacity: busy !== null || !askEmail.trim() ? 0.55 : 1 }}
          >
            {busy === "ask" ? tr("layer.teacher.sending") : tr("layer.teacher.askSend")}
          </button>
        </form>
      )}

      {error && <p style={{ color: "#dc2626", textAlign: "center", marginTop: 16, fontSize: 15 }}>{error}</p>}
    </LayerShell>
  );
}
