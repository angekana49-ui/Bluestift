"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";

type Share = {
  token: string;
  title: string | null;
  brand: string;
  createdAt: string;
  url: string;
};

/**
 * Settings "Shared links" card.
 *
 * Sharing a document mints a public URL that anyone holding it can read, with no
 * expiry. Until now the revoke endpoint existed but nothing called it, so a
 * student could publish their work and had no way to take it back — on a product
 * whose users are largely minors, that is the wrong default to leave standing.
 *
 * Loaded on demand rather than server-rendered into /account: most visits to
 * Settings are not about shares, and the list is one round trip when it matters.
 */
export function SettingsSharesCard() {
  const { theme: t } = useAppTheme();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/share");
      const data = (await res.json().catch(() => null)) as
        | { shares?: Share[]; error?: string }
        | null;
      if (!res.ok) {
        setErr(data?.error ?? "Could not load your shared links.");
        setShares([]);
        return;
      }
      setShares(data?.shares ?? []);
    } catch {
      setErr("Could not load your shared links.");
      setShares([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(token: string) {
    setRevoking(token);
    setErr(null);
    try {
      const res = await fetch(`/api/share?token=${encodeURIComponent(token)}`, { method: "DELETE" });
      if (!res.ok) {
        setErr("Could not revoke that link. Try again.");
        return;
      }
      // Drop it locally rather than refetch: the row is gone from the live set,
      // and a refetch would blank the list for a beat on a slow connection.
      setShares((prev) => (prev ?? []).filter((s) => s.token !== token));
    } catch {
      setErr("Could not revoke that link. Check your connection.");
    } finally {
      setRevoking(null);
    }
  }

  async function copy(url: string, token: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  // Nothing shared and nothing to say: an empty card in Settings is noise.
  if (shares !== null && shares.length === 0 && !err) return null;

  const pill: React.CSSProperties = {
    background: t.cardBg2,
    color: t.text,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 99,
    padding: "4px 11px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <SettingsCard theme={t}>
      <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Shared links</div>
      <div style={{ fontSize: 13, color: t.muted, marginTop: 2, marginBottom: 12, lineHeight: 1.6 }}>
        Anyone with one of these links can read that document — they don&apos;t expire on their own.
        Revoking one takes it offline immediately.
      </div>

      {shares === null ? (
        <div style={{ fontSize: 14, color: t.muted }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shares.map((s) => (
            <div
              key={s.token}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                border: `1px solid ${t.cardBorder}`,
                borderRadius: 10,
                padding: "10px 12px",
                background: t.cardBg2,
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: t.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title || "Untitled document"}
                </div>
                <div style={{ fontSize: 12, color: t.mutedLight, marginTop: 2 }}>
                  Shared {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button type="button" style={pill} onClick={() => copy(s.url, s.token)}>
                {copied === s.token ? "Copied ✓" : "Copy link"}
              </button>
              <button
                type="button"
                style={{ ...pill, opacity: revoking === s.token ? 0.5 : 1 }}
                onClick={() => revoke(s.token)}
                disabled={revoking === s.token}
              >
                {revoking === s.token ? "Revoking…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}

      {err && <p style={{ fontSize: 13, color: t.muted, margin: "10px 0 0" }}>{err}</p>}
    </SettingsCard>
  );
}
