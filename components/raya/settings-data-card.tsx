"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppTheme } from "@/components/ui/theme";
import { SettingsCard } from "@/components/raya/raya-app";
import { getConsent, setConsent } from "@/lib/analytics/consent";
import { disableAnalytics, enableAnalytics } from "@/lib/analytics/posthog-lazy";

/**
 * Settings "Your data" — the data-subject rights, exercised here instead of by
 * writing to an inbox and waiting a month. Four things, in the order they
 * matter:
 *
 *  - Download everything we hold (GDPR art. 15 / 20).
 *  - Withdraw analytics consent. The privacy policy used to say "clear your
 *    site data", which is not a withdrawal mechanism — art. 7(3) wants it to be
 *    as easy to withdraw as it was to give.
 *  - Choose whether your content helps improve Raya. Off unless chosen, and not
 *    offered at all to a minor.
 *  - Delete the account (art. 17), typed confirmation, no undo.
 *
 * Minors see the two consent rows replaced by a statement of why they're
 * absent, rather than a disabled control with no explanation.
 */
export function SettingsDataCard({
  band,
  trainingConsent,
  schoolLinked,
}: {
  band: "child" | "teen" | "adult" | null;
  trainingConsent: boolean;
  schoolLinked: boolean;
}) {
  const { theme: t } = useAppTheme();
  const router = useRouter();
  const isMinor = band !== "adult";

  const [analytics, setAnalytics] = useState<"granted" | "denied" | null>(null);
  const [training, setTraining] = useState(trainingConsent);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read on the client only — the decision lives in localStorage.
  useEffect(() => setAnalytics(getConsent()), []);

  async function toggleAnalytics(next: boolean) {
    setConsent(next ? "granted" : "denied");
    setAnalytics(next ? "granted" : "denied");
    if (next) await enableAnalytics();
    else disableAnalytics();
  }

  async function toggleTraining(next: boolean) {
    setError(null);
    const previous = training;
    setTraining(next); // optimistic; reverted below if the server refuses
    try {
      const res = await fetch("/api/account/training-consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setTraining(previous);
        setError(d.error ?? "Couldn't save that.");
      }
    } catch {
      setTraining(previous);
      setError("Couldn't reach the server.");
    }
  }

  async function deleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? "Deletion failed.");
        return;
      }
      // The account no longer exists — leave for a page that doesn't need one.
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  const label = { fontSize: 16, fontWeight: 700, color: t.text } as const;
  const desc = { fontSize: 13, color: t.muted, marginTop: 2, lineHeight: 1.55 } as const;
  const row = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 0",
    borderTop: `1px solid ${t.inputBorder}`,
  } as const;

  return (
    <SettingsCard theme={t}>
      <div style={{ paddingBottom: 4 }}>
        <div style={label}>Your data</div>
        <div style={desc}>
          What we hold about you, and what you can do with it — right here, no request form.
        </div>
      </div>

      {/* ---------------------------------------------------------- export --- */}
      <div style={row}>
        <div>
          <div style={{ ...label, fontSize: 15 }}>Download a copy</div>
          <div style={desc}>
            Everything on your account as a JSON file, including the model of your learning
            that Raya keeps but never shows you.
          </div>
        </div>
        <a
          href="/api/account/export"
          style={{
            flex: "none",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 10,
            padding: "9px 14px",
            fontSize: 14,
            fontWeight: 600,
            color: t.text,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Download
        </a>
      </div>

      {/* --------------------------------------------------------- consents --- */}
      {isMinor ? (
        <div style={row}>
          <div>
            <div style={{ ...label, fontSize: 15 }}>Analytics &amp; model improvement</div>
            <div style={desc}>
              Both are switched off on this account and can&apos;t be turned on. Accounts
              belonging to under-18s aren&apos;t measured, and their work is never used to
              improve our models.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={row}>
            <div>
              <div style={{ ...label, fontSize: 15 }}>Product analytics</div>
              <div style={desc}>
                Anonymous usage measurement so we can see which features actually help. You
                can switch it off at any time, and nothing about the product changes.
              </div>
            </div>
            <Switch on={analytics === "granted"} onChange={toggleAnalytics} theme={t} />
          </div>

          <div style={row}>
            <div>
              <div style={{ ...label, fontSize: 15 }}>Help improve Raya</div>
              <div style={desc}>
                Let us use your conversations to improve the tutor. Off unless you turn it on.
              </div>
            </div>
            <Switch on={training} onChange={toggleTraining} theme={t} />
          </div>
        </>
      )}

      {/* ---------------------------------------------------------- delete --- */}
      <div style={{ ...row, display: "block" }}>
        <div style={{ ...label, fontSize: 15, color: "#dc2626" }}>Delete this account</div>
        <div style={desc}>
          Permanent. Your conversations, documents, results and cognitive profile are erased,
          and nothing about them can be recovered afterwards.
          {schoolLinked && (
            <>
              {" "}
              You&apos;ll also be removed from your class. Your school keeps its own records
              of your enrolment and results — ask them directly about those.
            </>
          )}{" "}
          Payment receipts are kept, because accounting rules require it.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE"
            aria-label="Type DELETE to confirm"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 14,
              color: t.text,
              outline: "none",
              width: 160,
            }}
          />
          <button
            onClick={deleteAccount}
            disabled={deleting || confirm.trim().toUpperCase() !== "DELETE"}
            style={{
              background: "transparent",
              border: "1px solid #dc2626",
              color: "#dc2626",
              borderRadius: 10,
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: deleting || confirm.trim().toUpperCase() !== "DELETE" ? 0.5 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>

      {msg && <p style={{ color: t.muted, fontSize: 14, margin: "12px 0 0" }}>{msg}</p>}
      {error && <p style={{ color: "#dc2626", fontSize: 14, margin: "12px 0 0" }}>{error}</p>}
    </SettingsCard>
  );
}

function Switch({
  on,
  onChange,
  theme,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  theme: { inputBg: string; inputBorder: string };
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        flex: "none",
        width: 46,
        height: 27,
        borderRadius: 99,
        border: `1px solid ${on ? "#3b6ef5" : theme.inputBorder}`,
        background: on ? "#3b6ef5" : theme.inputBg,
        position: "relative",
        cursor: "pointer",
        padding: 0,
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 21 : 2,
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "#ffffff",
          transition: "left 0.15s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}
