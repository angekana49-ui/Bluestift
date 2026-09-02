"use client";

import Link from "next/link";
import type { Theme } from "@/components/site/theme";
import { LegalShell, h2, li, link, p, ul } from "./legal-chrome";

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
 */

const DOCS: { href: string; title: string; blurb: string }[] = [
  {
    href: "/privacy",
    title: "Privacy",
    blurb:
      "What we collect, why, how long we keep it, and who else ever sees it. The one to read if you want a single answer about your own data.",
  },
  {
    href: "/terms",
    title: "Terms of service",
    blurb:
      "Who may open an account, what Raya is and — as importantly — is not, and how an account ends.",
  },
  {
    href: "/dpa",
    title: "Schools DPA",
    blurb:
      "The data-processing agreement a school signs. Written for the person at the school who has to sign it, not for a student.",
  },
  {
    href: "/subprocessors",
    title: "Sub-processors",
    blurb:
      "Every third party that touches your data, what each one does, and where it runs. Named, not summarised.",
  },
];

export function LegalIndexView({ signedIn }: { signedIn: boolean }) {
  return (
    <LegalShell
      active="Privacy"
      section="Legal"
      signedIn={signedIn}
      title="Legal"
      accent="in full"
      updated="3 September 2026"
    >
      {(t: Theme) => (
        <>
          <p style={p(t)}>
            Four documents, no summaries. Each one is written to be read on its own, and this
            page exists only so you can find the right one quickly.
          </p>

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
                  {d.title} →
                </div>
                <div style={{ fontSize: 14, color: t.muted, lineHeight: 1.65 }}>{d.blurb}</div>
              </Link>
            ))}
          </div>

          <h2 style={h2(t)}>Doing something about it</h2>
          <p style={p(t)}>
            Reading a policy and acting on it are different things, and the second one should not
            require writing to anybody. Everything below is a control in your own account
            settings, not a request form:
          </p>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>Download everything we hold</strong> as a JSON file — including the model of
              your learning that Raya keeps but never shows you.
            </li>
            <li style={li(t)}>
              <strong>Switch off product analytics</strong>, and switch off whether your work is
              used to improve Raya. Both take effect immediately, and nothing about the product
              changes when you do.
            </li>
            <li style={li(t)}>
              <strong>Delete the account</strong> outright, with a typed confirmation and no undo.
            </li>
          </ul>
          <p style={p(t)}>
            {signedIn ? (
              <Link href="/account#data" style={link(t)}>
                Open your data controls →
              </Link>
            ) : (
              <Link href="/login" style={link(t)}>
                Sign in to open your data controls →
              </Link>
            )}
          </p>

          <h2 style={h2(t)}>If you are under 18</h2>
          <p style={p(t)}>
            Neither of those two switches applies to you, and not because we forgot them. Accounts
            belonging to under-18s are not measured by analytics and their work is never used to
            improve our models — that is enforced above the setting rather than by it, so there is
            no state of the account in which it can be turned on. The{" "}
            <Link href="/privacy" style={link(t)}>
              privacy policy
            </Link>{" "}
            says how that is decided, and under 13 an account only exists at all because a school
            authorised it.
          </p>
        </>
      )}
    </LegalShell>
  );
}
