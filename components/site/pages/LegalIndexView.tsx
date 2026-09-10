"use client";

import Link from "next/link";
import type { Theme } from "@/components/site/theme";
import { LegalShell, h2, li, link, p, ul } from "./legal-chrome";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

/**
 * /legal — one door to the four documents.
 *
 * They existed and were reachable only from the home page footer, which means a
 * student sitting inside the app, looking at a row about their data, had no way
 * to get to them: the app has no marketing footer. Every "Privacy"-ish control
 * in Settings now points here, so the answer to "what exactly are you doing with
 * my work" is one click from where the question is asked rather than a search.
 *
 * Deliberately an index and not a fifth document. Adding a summary of four legal
 * texts creates a fifth statement that can drift out of agreement with them, and
 * when it does it is the one people will have read.
 *
 * The index itself is translated (this file); the four documents it links to
 * are not — a legal text drifting between four independently-worded copies is
 * a worse outcome than making a visitor read the authoritative one.
 */

const DOCS: { href: string; titleKey: MessageKey; blurbKey: MessageKey }[] = [
  { href: "/privacy", titleKey: "legal.index.doc.privacy.title", blurbKey: "legal.index.doc.privacy.blurb" },
  { href: "/terms", titleKey: "legal.index.doc.terms.title", blurbKey: "legal.index.doc.terms.blurb" },
  { href: "/dpa", titleKey: "legal.index.doc.dpa.title", blurbKey: "legal.index.doc.dpa.blurb" },
  { href: "/subprocessors", titleKey: "legal.index.doc.subprocessors.title", blurbKey: "legal.index.doc.subprocessors.blurb" },
];

export function LegalIndexView({ signedIn }: { signedIn: boolean }) {
  const tr = useTranslate();
  return (
    <LegalShell
      active="Privacy"
      section="Legal"
      signedIn={signedIn}
      title={tr("legal.index.title")}
      accent={tr("legal.index.accent")}
      updated="6 September 2026"
    >
      {(t: Theme) => (
        <>
          <p style={p(t)}>{tr("legal.index.intro")}</p>

          <div style={{ display: "grid", gap: 12, margin: "28px 0 0" }}>
            {DOCS.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                style={{
                  display: "block",
                  textDecoration: "none",
                  border: `1px solid ${t.footerBorder}`,
                  borderRadius: 14,
                  padding: "16px 18px",
                  background: t.sectionAltBg,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-plex),'IBM Plex Sans',sans-serif",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    color: t.link,
                    marginBottom: 4,
                  }}
                >
                  {tr(d.titleKey)} →
                </div>
                <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.65 }}>{tr(d.blurbKey)}</div>
              </Link>
            ))}
          </div>

          <h2 style={h2(t)}>{tr("legal.index.doingHeading")}</h2>
          <p style={p(t)}>{tr("legal.index.doingIntro")}</p>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>{tr("legal.index.li.download.lead")}</strong>
              {tr("legal.index.li.download.rest")}
            </li>
            <li style={li(t)}>
              <strong>{tr("legal.index.li.analytics.lead")}</strong>
              {tr("legal.index.li.analytics.rest")}
            </li>
            <li style={li(t)}>
              <strong>{tr("legal.index.li.delete.lead")}</strong>
              {tr("legal.index.li.delete.rest")}
            </li>
          </ul>
          <p style={p(t)}>
            {signedIn ? (
              <Link href="/account#data" style={link(t)}>
                {tr("legal.index.openControls")}
              </Link>
            ) : (
              <Link href="/login" style={link(t)}>
                {tr("legal.index.signInControls")}
              </Link>
            )}
          </p>

          <h2 style={h2(t)}>{tr("legal.index.under18Heading")}</h2>
          <p style={p(t)}>
            {tr("legal.index.under18Body.a")}{" "}
            <Link href="/privacy" style={link(t)}>
              {tr("legal.index.under18Body.linkText")}
            </Link>{" "}
            {tr("legal.index.under18Body.b")}
          </p>
        </>
      )}
    </LegalShell>
  );
}
