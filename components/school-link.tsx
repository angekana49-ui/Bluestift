"use client";

import { useState } from "react";
import type { SchoolLinkInfo } from "@/lib/school";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";

export function SchoolLink({ initial }: { initial: SchoolLinkInfo | null }) {
  const { theme: t } = useAppTheme();
  const card = panelCard(t);
  const input = textInput(t);
  const btn = ctaButton(t);
  const [link, setLink] = useState<SchoolLinkInfo | null>(initial);
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/school/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, firstName, lastName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setLink(data as SchoolLinkInfo);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>Your school</h2>
        <p style={{ margin: "0 0 4px", color: t.text, fontSize: 15 }}>
          <strong>{link.schoolName ?? "School"}</strong>
          {link.className ? ` · ${link.className}` : ""}
        </p>
        <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>
          Enrolled as {link.firstName} {link.lastName}.
        </p>
        <p style={{ margin: "10px 0 0", color: t.mutedLight, fontSize: 13 }}>
          Your name and class are shared only with your school — not on your public profile.
        </p>
      </div>
    );
  }

  return (
    <form style={card} onSubmit={onSubmit}>
      <h2 style={cardTitle(t)}>Join your school</h2>
      <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 14 }}>
        Enter the class code your teacher gave you. Your name is shared only with your school.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          style={input}
          placeholder="Class code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          disabled={busy}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <input style={input} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={busy} />
          <input style={input} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={busy} />
        </div>
        <button
          type="submit"
          style={{ ...btn, alignSelf: "flex-start", opacity: busy ? 0.7 : 1 }}
          disabled={busy || !code.trim() || !firstName.trim() || !lastName.trim()}
        >
          {busy ? "Linking…" : "Link my account"}
        </button>
      </div>
      {error && <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: 15 }}>{error}</p>}
    </form>
  );
}
