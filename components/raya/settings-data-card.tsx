"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch } from "@/lib/net/client-fetch";
import { SettingsCard } from "@/components/raya/raya-app";
import { getConsent, setConsent } from "@/lib/analytics/consent";
import { disableAnalytics, enableAnalytics } from "@/lib/analytics/posthog-lazy";
import { useTranslate } from "@/components/ui/locale";

/**
 * Settings "Your data" — the data-subject rights, exercised here instead of by
 * writing to an inbox and waiting a month. Four things, in the order they
 * matter:
 *
 *  - Download everything we hold (GDPR art. 15 / 20).
 *  - Withdraw analytics consent. The privacy policy used to say "clear your
 *    site data", which is not a withdrawal mechanism — art. 7(3) wants it to be
 *    as easy to withdraw as it was to give.
 *  - Choose whether your content helps improve Raya. ON by default for solo
 *    adults, OFF until chosen on a school-linked account (the DPA's promise),
 *    switchable either way, and not offered at all to a minor.
 *  - See what a linked school can and cannot read — the B2B2C boundary, stated
 *    where the student is rather than only in the policy.
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
  const tr = useTranslate();
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
      const res = await netFetch(
        "/api/account/training-consent",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consent: next }),
        },
        { timeoutMs: 15_000 },
      );
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setTraining(previous);
        setError(d.error ?? tr("raya.settings.data.errCouldntSave"));
      }
    } catch {
      setTraining(previous);
      setError(tr("kernel.memory.serverUnreachable"));
    }
  }

  async function deleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    setMsg(null);
    try {
      // Erasing every table an account touches can take a moment — matched to
      // the route's own 60s budget rather than the client default of 10s.
      const res = await netFetch(
        "/api/account/delete",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm }),
        },
        { timeoutMs: 65_000 },
      );
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? tr("raya.settings.data.errDeletionFailed"));
        return;
      }
      // The account no longer exists — leave for a page that doesn't need one.
      router.replace("/");
      router.refresh();
    } catch {
      setError(tr("kernel.memory.serverUnreachable"));
    } finally {
      setDeleting(false);
    }
  }

  const label = { fontSize: 17, fontWeight: 700, color: t.text } as const;
  const desc = { fontSize: 14, color: t.muted, marginTop: 2, lineHeight: 1.55 } as const;
  const legalLink = {
    color: t.link,
    fontWeight: 650,
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  };
  const row = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 0",
    borderTop: `1px solid ${t.inputBorder}`,
  } as const;

  return (
    <SettingsCard theme={t} id="data">
      <div style={{ paddingBottom: 4 }}>
        <div style={label}>{tr("raya.settings.data.title")}</div>
        <div style={desc}>
          {tr("raya.settings.data.desc")}{" "}
          {/* The app has no marketing footer, so until this link existed a student
              reading a row about their own data had no route to the document
              describing it. The controls are here; the reasoning is there. */}
          <Link href="/legal" style={legalLink}>
            {tr("raya.settings.data.policyLink")}
          </Link>
        </div>
      </div>

      {/* ---------------------------------------------------------- export --- */}
      <div style={row}>
        <div>
          <div style={{ ...label, fontSize: 16 }}>{tr("raya.settings.data.downloadTitle")}</div>
          <div style={desc}>{tr("raya.settings.data.downloadDesc")}</div>
        </div>
        <a
          href="/api/account/export"
          style={{
            flex: "none",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: 10,
            padding: "9px 14px",
            fontSize: 15,
            fontWeight: 600,
            color: t.text,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {tr("attachment.download")}
        </a>
      </div>

      {/* --------------------------------------------------------- consents --- */}
      {isMinor ? (
        <div style={row}>
          <div>
            <div style={{ ...label, fontSize: 16 }}>{tr("raya.settings.data.minorTitle")}</div>
            <div style={desc}>{tr("raya.settings.data.minorDesc")}</div>
          </div>
        </div>
      ) : (
        <>
          <div style={row}>
            <div>
              <div style={{ ...label, fontSize: 16 }}>{tr("raya.settings.data.analyticsTitle")}</div>
              <div style={desc}>{tr("raya.settings.data.analyticsDesc")}</div>
            </div>
            <Switch on={analytics === "granted"} onChange={toggleAnalytics} theme={t} />
          </div>

          <div style={row}>
            <div>
              <div style={{ ...label, fontSize: 16 }}>{tr("raya.settings.data.trainingTitle")}</div>
              <div style={desc}>
                {schoolLinked
                  ? tr("raya.settings.data.trainingDescLinked")
                  : tr("raya.settings.data.trainingDescUnlinked")}
              </div>
            </div>
            <Switch on={training} onChange={toggleTraining} theme={t} />
          </div>
        </>
      )}

      {/* ------------------------------------------------ what a school sees --- */}
      {/* Named explicitly rather than buried in the privacy policy: whether a
          teacher can see your work is the question a student actually has, and
          the honest answer differs entirely depending on one fact about their
          account. */}
      <div style={row}>
        <div>
          <div style={{ ...label, fontSize: 16 }}>
            {schoolLinked
              ? tr("raya.settings.data.visibilityTitleLinked")
              : tr("raya.settings.data.visibilityTitleUnlinked")}
          </div>
          <div style={desc}>
            {schoolLinked
              ? tr("raya.settings.data.visibilityDescLinked")
              : tr("raya.settings.data.visibilityDescUnlinked")}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- delete --- */}
      <div style={{ ...row, display: "block" }}>
        <div style={{ ...label, fontSize: 16, color: "#dc2626" }}>{tr("raya.settings.data.deleteTitle")}</div>
        <div style={desc}>
          {schoolLinked
            ? tr("raya.settings.data.deleteDescLinked")
            : tr("raya.settings.data.deleteDescUnlinked")}
        </div>
        {/* The confirmation word is checked literally in code below (never
            localized — see deleteAccount), so it has to survive on screen
            exactly as typed even when the browser's own translate tool is
            running over an already-translated page. `translate="no"` +
            `notranslate` is belt-and-suspenders (either alone satisfies most
            engines) and is applied to the word everywhere it's visible: here,
            and on the input itself so its placeholder isn't rewritten either. */}
        <div style={{ ...desc, marginTop: 8 }}>
          {tr("raya.settings.data.deleteInstructionA")}{" "}
          <span translate="no" className="notranslate" style={{ fontWeight: 700, color: t.text }}>
            DELETE
          </span>{" "}
          {tr("raya.settings.data.deleteInstructionB")}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={tr("raya.settings.data.deletePlaceholder")}
            aria-label={tr("raya.settings.data.deleteAriaLabel")}
            translate="no"
            className="notranslate"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 15,
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
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              opacity: deleting || confirm.trim().toUpperCase() !== "DELETE" ? 0.5 : 1,
            }}
          >
            {deleting ? tr("raya.settings.data.deleteButtonBusy") : tr("raya.settings.data.deleteButton")}
          </button>
        </div>
      </div>

      {msg && <p style={{ color: t.muted, fontSize: 15, margin: "12px 0 0" }}>{msg}</p>}
      {error && <p style={{ color: "#dc2626", fontSize: 15, margin: "12px 0 0" }}>{error}</p>}
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
