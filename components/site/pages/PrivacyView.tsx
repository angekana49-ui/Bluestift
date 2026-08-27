"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, Table, h2, h3, li, link, note, p, ul } from "./legal-chrome";
import { useTranslate } from "@/components/ui/locale";

const UPDATED = "13 August 2026";

/**
 * The privacy notice. Written to satisfy GDPR art. 13/14 (which asks for the
 * legal basis, the retention period and the recipients — not just a list of
 * data), plus the COPPA and FERPA disclosures the product's users need.
 *
 * Everything here is a claim about how the code behaves. When the code changes,
 * this changes with it — a notice that describes a system you no longer run is
 * worse than no notice.
 */
export function PrivacyView({ signedIn }: { signedIn: boolean }) {
  const tr = useTranslate();
  return (
    <LegalShell
      active="Privacy"
      section="Privacy"
      signedIn={signedIn}
      title={tr("privacy.title.a")}
      accent={tr("privacy.title.em")}
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            {tr("privacy.intro.a")} <RayaName />
            {tr("privacy.intro.b")}
          </p>

          <h2 style={h2(t)}>{tr("privacy.short.h2")}</h2>
          <ul style={ul}>
            <li style={li(t)}>
              {tr("privacy.short.li1.a")} <RayaName />.
            </li>
            <li style={li(t)}>
              {tr("privacy.short.li2.a")} <strong>{tr("privacy.short.li2.strong")}</strong>{tr("privacy.short.li2.b")}
            </li>
            <li style={li(t)}>
              {tr("privacy.short.li3.a")} <strong>{tr("privacy.short.li3.strong")}</strong> {tr("privacy.short.li3.b")}
            </li>
            <li style={li(t)}>
              {tr("privacy.short.li4.a")} <strong>{tr("privacy.short.li4.strong")}</strong>{tr("privacy.short.li4.b")}
            </li>
            <li style={li(t)}>{tr("privacy.short.li5")}</li>
            <li style={li(t)}>
              {tr("privacy.short.li6.a")}{" "}
              <Link href="/account" style={link(t)}>
                {tr("privacy.short.li6.link")}
              </Link>{" "}
              {tr("privacy.short.li6.b")}
            </li>
          </ul>

          {/* ------------------------------------------------------------- age --- */}
          <h2 style={h2(t)}>{tr("privacy.age.h2")}</h2>
          <p style={p(t)}>{tr("privacy.age.p1")}</p>
          <p style={p(t)}>
            <strong>{tr("privacy.age.under13.strong")}</strong> {tr("privacy.age.under13.body")}
          </p>
          <p style={p(t)}>
            <strong>{tr("privacy.age.under18.strong")}</strong> {tr("privacy.age.under18.body")}
          </p>
          <p style={p(t)}>
            <strong>{tr("privacy.age.parents.strong")}</strong> {tr("privacy.age.parents.a")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>{" "}
            {tr("privacy.age.parents.b")}
          </p>

          {/* --------------------------------------------------------- what/why --- */}
          <h2 style={h2(t)}>{tr("privacy.collect.h2")}</h2>
          <p style={p(t)}>
            {tr("privacy.collect.intro.a")} <em>{tr("privacy.collect.intro.contract")}</em>{tr("privacy.collect.intro.b")}{" "}
            <em>{tr("privacy.collect.intro.consent")}</em>{tr("privacy.collect.intro.c")}
          </p>
          <Table
            t={t}
            head={[tr("privacy.collect.table.what"), tr("privacy.collect.table.why"), tr("privacy.collect.table.basis")]}
            rows={[
              [tr("privacy.collect.r1.what"), tr("privacy.collect.r1.why"), tr("privacy.collect.r1.basis")],
              [tr("privacy.collect.r2.what"), tr("privacy.collect.r2.why"), tr("privacy.collect.r2.basis")],
              [tr("privacy.collect.r3.what"), tr("privacy.collect.r3.why"), tr("privacy.collect.r3.basis")],
              [tr("privacy.collect.r4.what"), tr("privacy.collect.r4.why"), tr("privacy.collect.r4.basis")],
              [tr("privacy.collect.r5.what"), tr("privacy.collect.r5.why"), tr("privacy.collect.r5.basis")],
              [tr("privacy.collect.r6.what"), tr("privacy.collect.r6.why"), tr("privacy.collect.r6.basis")],
              [tr("privacy.collect.r7.what"), tr("privacy.collect.r7.why"), tr("privacy.collect.r7.basis")],
              [tr("privacy.collect.r8.what"), tr("privacy.collect.r8.why"), tr("privacy.collect.r8.basis")],
              [tr("privacy.collect.r9.what"), tr("privacy.collect.r9.why"), tr("privacy.collect.r9.basis")],
              [tr("privacy.collect.r10.what"), tr("privacy.collect.r10.why"), tr("privacy.collect.r10.basis")],
            ]}
          />
          <p style={p(t)}>{tr("privacy.collect.footer")}</p>

          <h3 style={h3(t)}>{tr("privacy.kernel.h3")}</h3>
          <p style={p(t)}>
            {tr("privacy.kernel.a")} <RayaName /> {tr("privacy.kernel.b")}
          </p>

          {/* ------------------------------------------------------- analytics --- */}
          <h2 style={h2(t)}>{tr("privacy.analytics.h2")}</h2>
          <p style={p(t)}>
            {tr("privacy.analytics.p1.a")} <strong>{tr("privacy.analytics.p1.strong")}</strong> {tr("privacy.analytics.p1.b")}
          </p>
          <p style={p(t)}>
            {tr("privacy.analytics.p2.a")}{" "}
            <Link href="/account" style={link(t)}>
              {tr("privacy.analytics.p2.link")}
            </Link>
            {tr("privacy.analytics.p2.b")}
          </p>
          <p style={p(t)}>{tr("privacy.analytics.p3")}</p>

          {/* ---------------------------------------------------------- who --- */}
          <h2 style={h2(t)}>{tr("privacy.who.h2")}</h2>
          <p style={p(t)}>
            {tr("privacy.who.p1.a")}{" "}
            <Link href="/subprocessors" style={link(t)}>
              {tr("privacy.who.p1.link")}
            </Link>
            {tr("privacy.who.p1.b")}
          </p>
          <p style={p(t)}>
            {tr("privacy.who.p2.a")} <RayaName /> {tr("privacy.who.p2.b")}
          </p>
          <p style={p(t)}>
            {tr("privacy.who.p3.a")}{" "}
            <Link href="/subprocessors" style={link(t)}>
              {tr("privacy.who.p3.link")}
            </Link>{" "}
            {tr("privacy.who.p3.b")}
          </p>

          {/* ------------------------------------------------------ retention --- */}
          <h2 style={h2(t)}>{tr("privacy.retention.h2")}</h2>
          <Table
            t={t}
            head={[tr("privacy.retention.table.what"), tr("privacy.retention.table.howLong")]}
            rows={[
              [tr("privacy.retention.r1.what"), tr("privacy.retention.r1.how")],
              [tr("privacy.retention.r2.what"), tr("privacy.retention.r2.how")],
              [tr("privacy.retention.r3.what"), tr("privacy.retention.r3.how")],
              [tr("privacy.retention.r4.what"), tr("privacy.retention.r4.how")],
              [tr("privacy.retention.r5.what"), tr("privacy.retention.r5.how")],
            ]}
          />
          <p style={p(t)}>{tr("privacy.retention.footer")}</p>

          {/* --------------------------------------------------------- rights --- */}
          <h2 style={h2(t)}>{tr("privacy.rights.h2")}</h2>
          <p style={p(t)}>{tr("privacy.rights.p1")}</p>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>{tr("privacy.rights.li1.strong")}</strong> {tr("privacy.rights.li1.a")}{" "}
              <Link href="/account" style={link(t)}>
                {tr("privacy.rights.li1.link")}
              </Link>
              .
            </li>
            <li style={li(t)}>
              <strong>{tr("privacy.rights.li2.strong")}</strong> {tr("privacy.rights.li2.body")}
            </li>
          </ul>
          <p style={p(t)}>
            {tr("privacy.rights.contact.a")}{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            {tr("privacy.rights.contact.b")}
          </p>

          {/* -------------------------------------------------------- schools --- */}
          <h2 style={h2(t)}>{tr("privacy.schools.h2")}</h2>
          <p style={p(t)}>
            {tr("privacy.schools.p1.a")} <strong>{tr("privacy.schools.p1.strong1")}</strong>{" "}
            {tr("privacy.schools.p1.b")}{" "}
            <strong>{tr("privacy.schools.p1.strong2")}</strong>{" "}
            {tr("privacy.schools.p1.c")}{" "}
            <Link href="/dpa" style={link(t)}>
              {tr("privacy.schools.p1.link")}
            </Link>
            .
          </p>
          <p style={p(t)}>{tr("privacy.schools.p2")}</p>
          <p style={p(t)}>
            {tr("privacy.schools.p3.a")} <RayaName />. {tr("privacy.schools.p3.b")}
          </p>

          <div style={note(t)}>{tr("privacy.disclaimer")}</div>

          {/* ------------------------------------------------------- contact --- */}
          <h2 style={h2(t)}>{tr("privacy.changes.h2")}</h2>
          <p style={p(t)}>
            {tr("privacy.changes.a")}{" "}
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
