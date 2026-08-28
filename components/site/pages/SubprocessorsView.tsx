"use client";

import Link from "next/link";
import { BluestiftText, RayaName } from "@/components/ui/brand";
import { LegalShell, Table, h2, li, link, note, p, ul } from "./legal-chrome";
import { useTranslate } from "@/components/ui/locale";

const UPDATED = "13 August 2026";

/**
 * The sub-processor list. GDPR art. 28(2) lets a school object to a new
 * sub-processor, which is only meaningful if it can find out about one — hence
 * a public page rather than a clause promising to notify.
 *
 * Every row is a service the code actually calls. Adding a provider to the
 * stack means adding it here in the same change.
 */
export function SubprocessorsView({ signedIn }: { signedIn: boolean }) {
  const tr = useTranslate();
  return (
    <LegalShell
      active="Privacy"
      section="Sub-processors"
      signedIn={signedIn}
      title={tr("subprocessors.title.a")}
      accent={tr("subprocessors.title.em")}
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            <BluestiftText>{tr("subprocessors.intro")}</BluestiftText>
          </p>

          <div style={note(t)}>
            <strong>{tr("subprocessors.today.strong")}</strong> <BluestiftText>{tr("subprocessors.today.body")}</BluestiftText>
          </div>

          <h2 style={h2(t)}>{tr("subprocessors.current.h2")}</h2>
          <Table
            t={t}
            head={[tr("subprocessors.table.provider"), tr("subprocessors.table.what"), tr("subprocessors.table.data"), tr("subprocessors.table.where")]}
            rows={[
              [
                "Supabase",
                tr("subprocessors.row.supabase.purpose"),
                tr("subprocessors.row.supabase.data"),
                tr("subprocessors.loc.eu"),
              ],
              [
                "Vercel",
                tr("subprocessors.row.vercel.purpose"),
                tr("subprocessors.row.vercel.data"),
                tr("subprocessors.loc.euUs"),
              ],
              [
                "Google (Gemini)",
                tr("subprocessors.row.gemini.purpose"),
                tr("subprocessors.row.gemini.data"),
                tr("subprocessors.loc.us"),
              ],
              [
                "Groq",
                tr("subprocessors.row.groq.purpose"),
                tr("subprocessors.row.groq.data"),
                tr("subprocessors.loc.us"),
              ],
              [
                "PostHog",
                tr("subprocessors.row.posthog.purpose"),
                tr("subprocessors.row.posthog.data"),
                tr("subprocessors.loc.eu"),
              ],
              [
                "Cloudflare",
                tr("subprocessors.row.cloudflare.purpose"),
                tr("subprocessors.row.cloudflare.data"),
                tr("subprocessors.loc.global"),
              ],
              [
                "Resend",
                tr("subprocessors.row.resend.purpose"),
                tr("subprocessors.row.resend.data"),
                tr("subprocessors.loc.euUs"),
              ],
              [
                "CinetPay",
                tr("subprocessors.row.cinetpay.purpose"),
                tr("subprocessors.row.cinetpay.data"),
                tr("subprocessors.loc.africaEu"),
              ],
              [
                "Google Classroom",
                tr("subprocessors.row.classroom.purpose"),
                tr("subprocessors.row.classroom.data"),
                tr("subprocessors.loc.us"),
              ],
            ]}
          />

          <h2 style={h2(t)}>{tr("subprocessors.require.h2")}</h2>
          <ul style={ul}>
            <li style={li(t)}>{tr("subprocessors.require.li1")}</li>
            <li style={li(t)}>{tr("subprocessors.require.li2")}</li>
            <li style={li(t)}>{tr("subprocessors.require.li3")}</li>
            <li style={li(t)}>{tr("subprocessors.require.li4")}</li>
          </ul>

          <h2 style={h2(t)}>{tr("subprocessors.changes.h2")}</h2>
          <p style={p(t)}>
            {tr("subprocessors.changes.a")}{" "}
            <Link href="/dpa" style={link(t)}>
              {tr("subprocessors.changes.dpaLink")}
            </Link>
            .
          </p>

          <div style={note(t)}>
            <RayaName /> {tr("subprocessors.worksWithout.a")} {tr("subprocessors.worksWithout.b")}
          </div>

          <p style={p(t)}>
            {tr("subprocessors.questions")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            .
          </p>
        </>
      )}
    </LegalShell>
  );
}
