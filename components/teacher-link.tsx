"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton, linkText } from "@/components/ui/forms";
import { COUNTRIES } from "@/lib/school-constants";

type Staff = { schoolName: string; role: string };

/**
 * Teacher/founder surface inside Raya (where every user is): join a school with a
 * staff invite code, OR create your own school. Creation lives here — not buried
 * in the Schools app — because this is the shared user home. Already-staff users
 * see their school + the dashboard link, and can still spin up another school.
 */
export function TeacherLink({
  initial,
  startCreate = false,
  hasEmail = true,
}: {
  initial: Staff | null;
  startCreate?: boolean;
  /** Whether the account has a verified email. Teacher/admin actions require one
   *  (anonymous accounts are for basic learners); false shows the add-email gate. */
  hasEmail?: boolean;
}) {
  const { theme: t } = useAppTheme();
  const router = useRouter();
  const card = panelCard(t);
  const input = { ...textInput(t), letterSpacing: "0.05em" };
  const btn = ctaButton(t);
  const link = linkText(t);
  // `startCreate` (from /profile?intent=create, set by onboarding's "run a
  // school" path) opens straight into the create form.
  const [mode, setMode] = useState<"default" | "create">(startCreate ? "create" : "default");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "joined" | "requested">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create-school form fields.
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/school/join-team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d?.error ?? `Request failed (${res.status}).`);
        return;
      }
      const where = d.schoolName ? ` ${d.schoolName}` : "";
      if (d.status === "requested") {
        setDone("requested");
        setMsg(`Request sent to${where}. You'll get access as soon as an admin approves it.`);
      } else {
        setDone("joined");
        setMsg(`You joined${where}.`);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function createSchool(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), city: city.trim(), countryCode }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error ?? `Request failed (${res.status}).`);
        setBusy(false);
        return;
      }
      // The route makes the new school active. Land on Billing so pricing is asked
      // from the start — the deterrent against casual school creation for users who
      // aren't real admins/teachers.
      router.push("/school?tab=billing");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  // ---- Email gate: staff (teacher/admin) accounts require a verified email ----
  // Shown before any join/create surface for a not-yet-staff, email-less account
  // (covers the onboarding create-intent deep link too). Anonymous accounts stay
  // fine for basic learning; this is the deliberate line for adult staff accounts.
  if (!hasEmail && !initial) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>Do you teach at — or run — a school?</h2>
        <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 12.5, lineHeight: 1.6 }}>
          Teacher and admin accounts need a <strong style={{ color: t.text }}>verified email</strong> — it keeps
          school data tied to a real, recoverable account. Anonymous accounts stay perfect for learning solo, but
          to join or run a school, link your email first.
        </p>
        <Link href="/account" style={{ ...btn, display: "inline-block", textDecoration: "none" }}>
          Add your email →
        </Link>
      </div>
    );
  }

  // ---- Create a school (reachable from any state) ----
  if (mode === "create") {
    return (
      <form style={card} onSubmit={createSchool}>
        <h2 style={cardTitle(t)}>Create your school</h2>
        <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 11.5 }}>
          You&apos;ll become its administrator — add classes, access codes and teachers from the
          Schools dashboard.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            style={{ ...textInput(t), flex: 1, minWidth: 200, width: "auto" }}
            placeholder="School name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <input
            style={{ ...textInput(t), width: 150 }}
            placeholder="City (optional)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={busy}
          />
        </div>
        <select
          style={{ ...textInput(t), width: "100%", marginBottom: 12, cursor: "pointer" }}
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          disabled={busy}
        >
          <option value="">Country (optional)</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={{ ...btn, opacity: busy || !name.trim() ? 0.6 : 1 }} disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create school"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("default"); setError(null); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...link }}
          >
            Cancel
          </button>
        </div>
        {error && <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: 12.5 }}>{error}</p>}
      </form>
    );
  }

  // ---- Already staff ----
  if (initial) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>Your school (team)</h2>
        <p style={{ margin: "0 0 10px", color: t.text, fontSize: 12.5 }}>
          You are {initial.role === "admin_master" ? "an administrator" : "a teacher"} at{" "}
          <strong>{initial.schoolName}</strong>.
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/school" style={link}>
            Open the Schools dashboard →
          </Link>
          <button
            type="button"
            onClick={() => setMode("create")}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...link }}
          >
            ＋ Create another school
          </button>
        </div>
      </div>
    );
  }

  // ---- Joined / requested confirmation ----
  if (done) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>Teach at a school</h2>
        <p style={{ margin: 0, color: "#22c55e", fontSize: 12.5 }}>{msg}</p>
        {done === "joined" && (
          <Link href="/school" style={{ ...link, display: "inline-block", marginTop: 10 }}>
            Open the Schools dashboard →
          </Link>
        )}
      </div>
    );
  }

  // ---- Not staff yet: join by code, or create ----
  return (
    <form style={card} onSubmit={submit}>
      <h2 style={cardTitle(t)}>Do you teach at — or run — a school?</h2>
      <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 11.5 }}>
        Enter the invite code your school gave you to join the teaching team.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: 1, minWidth: 200, width: "auto" }}
          placeholder="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          disabled={busy}
        />
        <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1 }} disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 11.5, color: t.muted }}>
        No code — running your own?{" "}
        <button
          type="button"
          onClick={() => { setMode("create"); setError(null); }}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...link }}
        >
          Create a school
        </button>
      </p>
      {error && <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: 12.5 }}>{error}</p>}
    </form>
  );
}
