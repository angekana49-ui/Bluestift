"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch } from "@/lib/net/client-fetch";
import { panelCard, cardTitle, textInput, ctaButton, linkText } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";

type Staff = { schoolName: string; role: string };

/**
 * Teacher/founder surface inside Raya (where every user is): join a school with a
 * staff invite code, or go set one up. Already-staff users see their school, the
 * dashboard link, and the way to set up another.
 *
 * Creating a school no longer happens in this card. It happens in the layer at
 * /school/enter, where it comes with a plan, a declared headcount and the pilot
 * those start — an inline "name + city + Create" here would be a way around all
 * three, which are the point.
 */
export function TeacherLink({
  initial,
  hasEmail = true,
}: {
  initial: Staff | null;
  /** Whether the account has a verified email. Teacher/admin actions require one
   *  (anonymous accounts are for basic learners); false shows the add-email gate. */
  hasEmail?: boolean;
}) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const card = panelCard(t);
  const input = { ...textInput(t), letterSpacing: "0.05em" };
  const btn = ctaButton(t);
  const link = linkText(t);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "joined" | "requested">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await netFetch(
        "/api/school/join-team",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        },
        { timeoutMs: 15_000 },
      );
      const d = await res.json();
      if (!res.ok) {
        setError(d?.error ?? `Request failed (${res.status}).`);
        return;
      }
      const where = d.schoolName ? ` ${d.schoolName}` : "";
      if (d.status === "requested") {
        setDone("requested");
        setMsg(`${tr("teacherLink.requestSentA")}${where}${tr("teacherLink.requestSentB")}`);
      } else {
        setDone("joined");
        setMsg(`${tr("teacherLink.joinedA")}${where}.`);
      }
    } catch {
      setError(tr("teacherLink.serverUnreachable"));
    } finally {
      setBusy(false);
    }
  }

  // ---- Email gate: staff (teacher/admin) accounts require a verified email ----
  // Anonymous accounts stay fine for basic learning; this is the deliberate line
  // for adult staff accounts.
  if (!hasEmail && !initial) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>{tr("teacherLink.headline")}</h2>
        <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 16, lineHeight: 1.6 }}>
          {tr("teacherLink.emailGateA")} <strong style={{ color: t.text }}>{tr("teacherLink.emailGateStrong")}</strong>{" "}
          {tr("teacherLink.emailGateB")}
        </p>
        <Link href="/account" style={{ ...btn, display: "inline-block", textDecoration: "none" }}>
          {tr("teacherLink.addEmailCta")}
        </Link>
      </div>
    );
  }

  // ---- Already staff ----
  if (initial) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>{tr("teacherLink.teamTitle")}</h2>
        <p style={{ margin: "0 0 10px", color: t.text, fontSize: 16 }}>
          {tr(initial.role === "admin_master" ? "teacherLink.youAreAdminPrefix" : "teacherLink.youAreTeacherPrefix")}{" "}
          <strong>{initial.schoolName}</strong>.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/school" style={link}>
            {tr("teacherLink.openDashboard")}
          </Link>
          <Link href="/school/enter?as=admin&new=1" style={link}>
            {tr("teacherLink.createAnother")}
          </Link>
        </div>
      </div>
    );
  }

  // ---- Joined / requested confirmation ----
  if (done) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>{tr("teacherLink.teachTitle")}</h2>
        <p style={{ margin: 0, color: "#22c55e", fontSize: 16 }}>{msg}</p>
        {done === "joined" && (
          <Link href="/school" style={{ ...link, display: "inline-block", marginTop: 10 }}>
            {tr("teacherLink.openDashboard")}
          </Link>
        )}
      </div>
    );
  }

  // ---- Not staff yet: join by code, or set up a school ----
  return (
    <form style={card} onSubmit={submit}>
      <h2 style={cardTitle(t)}>{tr("teacherLink.headline")}</h2>
      <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 15 }}>
        {tr("teacherLink.joinIntro2")}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200, width: "auto" }}
          placeholder={tr("teacherLink.invitePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          disabled={busy}
        />
        <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !code.trim()}>
          {busy ? tr("teacherLink.joining") : tr("teacherLink.joinButton")}
        </button>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 15, color: t.muted }}>
        {tr("teacherLink.noCodeQuestion")}{" "}
        <Link href="/school/enter?as=admin" style={link}>
          {tr("teacherLink.createSchoolLink")}
        </Link>
        {" · "}
        <Link href="/school/enter?as=teacher" style={link}>
          {tr("layer.teacher.askTitle")}
        </Link>
      </p>
      {error && <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: 16 }}>{error}</p>}
    </form>
  );
}
