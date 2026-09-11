"use client";

import { useState } from "react";
import type { SchoolLinkInfo } from "@/lib/school";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch } from "@/lib/net/client-fetch";
import { panelCard, cardTitle, textInput, ctaButton } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";

export function SchoolLink({ initial }: { initial: SchoolLinkInfo | null }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
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
      const res = await netFetch(
        "/api/school/join",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, firstName, lastName }),
        },
        { timeoutMs: 15_000 },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status}).`);
        return;
      }
      setLink(data as SchoolLinkInfo);
    } catch {
      setError(tr("schoolLink.serverUnreachable"));
    } finally {
      setBusy(false);
    }
  }

  if (link) {
    return (
      <div style={card}>
        <h2 style={cardTitle(t)}>{tr("schoolLink.title")}</h2>
        <p style={{ margin: "0 0 4px", color: t.text, fontSize: 16 }}>
          <strong>{link.schoolName ?? tr("schoolLink.schoolFallback")}</strong>
          {link.className ? ` · ${link.className}` : ""}
        </p>
        <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
          {tr("schoolLink.enrolledAs")} {link.firstName} {link.lastName}.
        </p>
        <p style={{ margin: "10px 0 0", color: t.mutedLight, fontSize: 14 }}>
          {tr("schoolLink.privacyNote")}
        </p>
      </div>
    );
  }

  return (
    <form style={card} onSubmit={onSubmit}>
      <h2 style={cardTitle(t)}>{tr("schoolLink.joinTitle")}</h2>
      <p style={{ margin: "0 0 14px", color: t.muted, fontSize: 15 }}>
        {tr("schoolLink.joinIntro")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          style={input}
          placeholder={tr("schoolLink.codePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          disabled={busy}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <input style={input} placeholder={tr("schoolLink.firstNamePlaceholder")} value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={busy} />
          <input style={input} placeholder={tr("schoolLink.lastNamePlaceholder")} value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={busy} />
        </div>
        <button
          type="submit"
          style={{ ...btn, alignSelf: "flex-end", opacity: busy ? 0.7 : 1 }}
          disabled={busy || !code.trim() || !firstName.trim() || !lastName.trim()}
        >
          {busy ? tr("schoolLink.linking") : tr("schoolLink.linkButton")}
        </button>
      </div>
      {error && <p style={{ color: "#f87171", margin: "12px 0 0", fontSize: 16 }}>{error}</p>}
    </form>
  );
}
