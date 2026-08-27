"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, h2, li, link, note, p, ul } from "./legal-chrome";
import { useTranslate } from "@/components/ui/locale";

const UPDATED = "13 August 2026";

/**
 * The data processing addendum a school agrees to. It carries three regimes at
 * once, because a school buying an AI tutor is exposed to all three:
 *
 *  - GDPR art. 28, which requires a written processor contract with specific
 *    clauses (instructions, confidentiality, security, sub-processors, audit,
 *    deletion, assistance).
 *  - FERPA's school-official exception, which is what lets a school disclose
 *    education records to a vendor at all.
 *  - COPPA's school-consent exception, which is what lets an under-13 use the
 *    product without us verifying a parent ourselves.
 *
 * Written as commitments in plain language rather than defined-term prose. A
 * school administrator with no counsel on hand should be able to read it.
 */
export function DpaView({ signedIn }: { signedIn: boolean }) {
  const tr = useTranslate();
  return (
    <LegalShell
      active="Privacy"
      section="Schools DPA"
      signedIn={signedIn}
      title={tr("dpa.title.a")}
      accent={tr("dpa.title.em")}
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>{tr("dpa.intro")}</p>

          <div style={note(t)}>{tr("dpa.shortVersion")}</div>

          {/* -------------------------------------------------------- roles --- */}
          <h2 style={h2(t)}>{tr("dpa.s1.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s1.p1.a")} <strong>{tr("dpa.s1.p1.strong1")}</strong> {tr("dpa.s1.p1.b")}{" "}
            <strong>{tr("dpa.s1.p1.strong2")}</strong> {tr("dpa.s1.p1.c")}
          </p>
          <p style={p(t)}>
            {tr("dpa.s1.p2.a")}{" "}
            <Link href="/privacy" style={link(t)}>
              {tr("dpa.s1.p2.link")}
            </Link>{" "}
            {tr("dpa.s1.p2.b")}
          </p>

          {/* -------------------------------------------------------- scope --- */}
          <h2 style={h2(t)}>{tr("dpa.s2.h2")}</h2>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>{tr("dpa.s2.li1.strong")}</strong> {tr("dpa.s2.li1.body")}
            </li>
            <li style={li(t)}>
              <strong>{tr("dpa.s2.li2.strong")}</strong> {tr("dpa.s2.li2.body")}
            </li>
            <li style={li(t)}>
              <strong>{tr("dpa.s2.li3.strong")}</strong> {tr("dpa.s2.li3.body")}
            </li>
            <li style={li(t)}>
              <strong>{tr("dpa.s2.li4.strong")}</strong> {tr("dpa.s2.li4.body")}
            </li>
          </ul>

          {/* ------------------------------------------------------- ferpa --- */}
          <h2 style={h2(t)}>{tr("dpa.s3.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s3.p1.a")} <strong>{tr("dpa.s3.p1.strong")}</strong> {tr("dpa.s3.p1.b")}
          </p>
          <ul style={ul}>
            <li style={li(t)}>{tr("dpa.s3.li1")}</li>
            <li style={li(t)}>
              {tr("dpa.s3.li2.a")} <strong>{tr("dpa.s3.li2.strong")}</strong> {tr("dpa.s3.li2.b")}
            </li>
            <li style={li(t)}>
              {tr("dpa.s3.li3.a")} <strong>{tr("dpa.s3.li3.strong1")}</strong> {tr("dpa.s3.li3.b")}{" "}
              <strong>{tr("dpa.s3.li3.strong2")}</strong> {tr("dpa.s3.li3.c")}
            </li>
            <li style={li(t)}>{tr("dpa.s3.li4")}</li>
          </ul>
          <p style={p(t)}>
            <strong>{tr("dpa.s3.p2.strong")}</strong> {tr("dpa.s3.p2.a")}{" "}
            <RayaName />
            {tr("dpa.s3.p2.b")}
          </p>

          {/* ------------------------------------------------------- coppa --- */}
          <h2 style={h2(t)}>{tr("dpa.s4.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s4.p1.a")} <RayaName /> {tr("dpa.s4.p1.b")}
          </p>
          <p style={p(t)}>
            {tr("dpa.s4.p2.a")} <strong>{tr("dpa.s4.p2.strong")}</strong> {tr("dpa.s4.p2.b")}
          </p>

          {/* ------------------------------------------------- sub-processors --- */}
          <h2 style={h2(t)}>{tr("dpa.s5.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s5.p1.a")}{" "}
            <Link href="/subprocessors" style={link(t)}>
              {tr("dpa.s5.p1.link")}
            </Link>
            {tr("dpa.s5.p1.b")}
          </p>
          <p style={p(t)}>{tr("dpa.s5.p2")}</p>

          {/* ---------------------------------------------------- security --- */}
          <h2 style={h2(t)}>{tr("dpa.s6.h2")}</h2>
          <ul style={ul}>
            <li style={li(t)}>{tr("dpa.s6.li1")}</li>
            <li style={li(t)}>{tr("dpa.s6.li2")}</li>
            <li style={li(t)}>{tr("dpa.s6.li3")}</li>
            <li style={li(t)}>{tr("dpa.s6.li4")}</li>
          </ul>
          <p style={p(t)}>
            <strong>{tr("dpa.s6.p1.strong")}</strong> {tr("dpa.s6.p1.body")}
          </p>

          {/* --------------------------------------------------------- use --- */}
          <h2 style={h2(t)}>{tr("dpa.s7.h2")}</h2>
          <ul style={ul}>
            <li style={li(t)}>{tr("dpa.s7.li1")}</li>
            <li style={li(t)}>{tr("dpa.s7.li2")}</li>
            <li style={li(t)}>{tr("dpa.s7.li3")}</li>
            <li style={li(t)}>{tr("dpa.s7.li4")}</li>
          </ul>

          {/* ------------------------------------------------------ rights --- */}
          <h2 style={h2(t)}>{tr("dpa.s8.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s8.p1.a")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            {tr("dpa.s8.p1.b")}
          </p>
          <p style={p(t)}>{tr("dpa.s8.p2")}</p>

          {/* --------------------------------------------------- deletion --- */}
          <h2 style={h2(t)}>{tr("dpa.s9.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s9.p1.a")} <strong>{tr("dpa.s9.p1.strong")}</strong> {tr("dpa.s9.p1.b")}
          </p>
          <p style={p(t)}>{tr("dpa.s9.p2")}</p>

          {/* ------------------------------------------------- transfers --- */}
          <h2 style={h2(t)}>{tr("dpa.s10.h2")}</h2>
          <p style={p(t)}>
            {tr("dpa.s10.a")}{" "}
            <Link href="/subprocessors" style={link(t)}>
              {tr("dpa.s10.link")}
            </Link>
            .
          </p>

          <div style={note(t)}>
            {tr("dpa.footer.a")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>{" "}
            {tr("dpa.footer.b")}
          </div>
        </>
      )}
    </LegalShell>
  );
}
