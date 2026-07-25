"use client";

import { useState } from "react";
import type { AppTheme } from "@/components/ui/tokens";
import type { BrandedDoc } from "@/lib/document";

/**
 * Turns a branded document into a public read-only link (POST /api/share) and
 * copies it to the clipboard. Sits next to the TXT/PDF actions so any generated
 * doc — notes, a test result, a progression summary — is shareable.
 */
export function ShareLinkButton({ theme: t, doc }: { theme: AppTheme; doc: BrandedDoc }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);

  async function share() {
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: doc.title, body: doc.body, brand: doc.brand }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data?.error ?? "share failed");
      setUrl(data.url);
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        // clipboard blocked — the link is still shown below
      }
      setState("done");
    } catch {
      setState("error");
    }
  }

  const btn: React.CSSProperties = {
    background: t.cardBg2,
    color: t.text,
    border: `1.5px solid ${t.dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.20)"}`,
    borderRadius: 99,
    padding: "6px 13px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  if (state === "done" && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{ ...btn, textDecoration: "none", color: t.dark ? "#4ade80" : "#15803d" }}>
        ✓ Link copied
      </a>
    );
  }
  return (
    <button style={btn} onClick={share} disabled={state === "busy"} title="Create a public read-only link">
      {state === "busy" ? "…" : state === "error" ? "Retry link" : "🔗 Link"}
    </button>
  );
}
