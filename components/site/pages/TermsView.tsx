"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, h2, li, link, note, p, ul } from "./legal-chrome";
import { useTranslate } from "@/components/ui/locale";

const UPDATED = "13 August 2026";

/**
 * Terms of service.
 *
 * §12 does not name a US state yet, because incorporation hasn't happened and
 * the governing law follows from it — inventing one would be worse than saying
 * so. Pin it the day the company is formed; the sentence is written so that
 * only the state name has to be dropped in.
 */
export function TermsView({ signedIn }: { signedIn: boolean }) {
  const tr = useTranslate();
  return (
    <LegalShell
      active="Privacy"
      section="Terms"
      signedIn={signedIn}
      title={tr("terms.title.a")}
      accent={tr("terms.title.em")}
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            {tr("terms.intro.a")} <RayaName />
            {tr("terms.intro.b")}
          </p>

          <h2 style={h2(t)}>{tr("terms.s1.h2")}</h2>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>{tr("terms.s1.li1.strong")}</strong> {tr("terms.s1.li1.body")}
            </li>
            <li style={li(t)}>
              <strong>{tr("terms.s1.li2.strong")}</strong> {tr("terms.s1.li2.a")}{" "}
              <Link href="/privacy" style={link(t)}>
                {tr("terms.s1.li2.link")}
              </Link>{" "}
              {tr("terms.s1.li2.b")}
            </li>
            <li style={li(t)}>{tr("terms.s1.li3")}</li>
          </ul>

          <h2 style={h2(t)}>{tr("terms.s2.h2")}</h2>
          <p style={p(t)}>
            {tr("terms.s2.a")} <strong>{tr("terms.s2.strong")}</strong> {tr("terms.s2.b")}
          </p>

          <h2 style={h2(t)}>{tr("terms.s3.h2")}</h2>
          <p style={p(t)}>
            <RayaName /> {tr("terms.s3.p1.a")}{" "}
            <strong>{tr("terms.s3.p1.strong")}</strong>. {tr("terms.s3.p1.b")}
          </p>
          <p style={p(t)}>
            {tr("terms.s3.p2.a")} <RayaName /> {tr("terms.s3.p2.b")}
          </p>

          <h2 style={h2(t)}>{tr("terms.s4.h2")}</h2>
          <p style={p(t)}>{tr("terms.s4.intro")}</p>
          <ul style={ul}>
            <li style={li(t)}>{tr("terms.s4.li1")}</li>
            <li style={li(t)}>{tr("terms.s4.li2")}</li>
            <li style={li(t)}>{tr("terms.s4.li3")}</li>
            <li style={li(t)}>{tr("terms.s4.li4")}</li>
            <li style={li(t)}>{tr("terms.s4.li5")}</li>
          </ul>

          <h2 style={h2(t)}>{tr("terms.s5.h2")}</h2>
          <p style={p(t)}>
            {tr("terms.s5.p1.a")} <RayaName /> {tr("terms.s5.p1.b")}
          </p>
          <p style={p(t)}>{tr("terms.s5.p2")}</p>

          <h2 style={h2(t)}>{tr("terms.s6.h2")}</h2>
          <p style={p(t)}>
            {tr("terms.s6.a")} <RayaName />
            {tr("terms.s6.b")}{" "}
            <Link href="/dpa" style={link(t)}>
              {tr("terms.s6.link")}
            </Link>
            .
          </p>

          <h2 style={h2(t)}>{tr("terms.s7.h2")}</h2>
          <p style={p(t)}>
            {tr("terms.s7.p1.a")}{" "}
            <Link href="/pricing" style={link(t)}>
              {tr("terms.s7.p1.link")}
            </Link>
            {tr("terms.s7.p1.b")}
          </p>
          <p style={p(t)}>{tr("terms.s7.p2")}</p>

          <h2 style={h2(t)}>{tr("terms.s8.h2")}</h2>
          <p style={p(t)}>{tr("terms.s8.body")}</p>

          <h2 style={h2(t)}>{tr("terms.s9.h2")}</h2>
          <p style={p(t)}>
            {tr("terms.s9.a")}{" "}
            <Link href="/account" style={link(t)}>
              {tr("terms.s9.link")}
            </Link>
            {tr("terms.s9.b")}
          </p>

          <h2 style={h2(t)}>{tr("terms.s10.h2")}</h2>
          <p style={p(t)}>
            {tr("terms.s10.a")} <RayaName /> {tr("terms.s10.b")}
          </p>

          <h2 style={h2(t)}>{tr("terms.s11.h2")}</h2>
          <p style={p(t)}>{tr("terms.s11.body")}</p>

          <h2 style={h2(t)}>{tr("terms.s12.h2")}</h2>
          <p style={p(t)}>{tr("terms.s12.body")}</p>

          <div style={note(t)}>
            {tr("terms.contact.a")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            {tr("terms.contact.b")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            .
          </div>
        </>
      )}
    </LegalShell>
  );
}
