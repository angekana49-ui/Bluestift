"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, h2, li, link, note, p, ul } from "./legal-chrome";

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
  return (
    <LegalShell
      active="Privacy"
      section="Schools DPA"
      signedIn={signedIn}
      title="Data processing"
      accent="addendum."
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            This addendum applies whenever a school, district or other education institution
            uses Bluestift with its students. It forms part of the agreement between us and
            sets out what we do with student data, and what we will never do with it.
          </p>

          <div style={note(t)}>
            Short version: the school owns the data, we only process it to run the service, we
            do not sell it, we do not use it to build a profile for any purpose other than
            tutoring that student, and we give it back or destroy it when the school says so.
          </div>

          {/* -------------------------------------------------------- roles --- */}
          <h2 style={h2(t)}>1. Who is who</h2>
          <p style={p(t)}>
            The <strong>school is the controller</strong> of its students&apos; personal data
            and decides what is collected and why. <strong>We are the processor</strong> and
            act only on the school&apos;s documented instructions — using the service as
            configured counts as those instructions.
          </p>
          <p style={p(t)}>
            For students who sign up on their own, outside any school, we are the controller
            and our{" "}
            <Link href="/privacy" style={link(t)}>
              privacy policy
            </Link>{" "}
            governs instead.
          </p>

          {/* -------------------------------------------------------- scope --- */}
          <h2 style={h2(t)}>2. What we process</h2>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>Subject matter:</strong> providing an AI tutor and a staff dashboard.
            </li>
            <li style={li(t)}>
              <strong>Duration:</strong> the term of the school&apos;s subscription, plus the
              deletion window in §9.
            </li>
            <li style={li(t)}>
              <strong>Data subjects:</strong> the school&apos;s students and its staff.
            </li>
            <li style={li(t)}>
              <strong>Categories:</strong> identity (name, class, year), account data, work
              submitted to the tutor, assessment results, and the learning signals derived
              from them.
            </li>
          </ul>

          {/* ------------------------------------------------------- ferpa --- */}
          <h2 style={h2(t)}>3. FERPA — we act as a school official</h2>
          <p style={p(t)}>
            The school designates us a <strong>school official with a legitimate educational
            interest</strong> in student education records under 34 CFR § 99.31(a)(1). On that
            basis we commit that:
          </p>
          <ul style={ul}>
            <li style={li(t)}>
              We perform a function the school would otherwise perform with its own staff.
            </li>
            <li style={li(t)}>
              We are under the school&apos;s <strong>direct control</strong> with respect to
              the use and maintenance of education records.
            </li>
            <li style={li(t)}>
              We use education records <strong>only</strong> for the purpose the school engaged
              us for, and <strong>do not re-disclose</strong> them to anyone else except as
              §5 permits.
            </li>
            <li style={li(t)}>
              We maintain a record of disclosures of a student&apos;s record, which the school
              can request.
            </li>
          </ul>
          <p style={p(t)}>
            <strong>Inspect and review.</strong> A parent or eligible student exercises that
            right with the school. Staff can produce a student&apos;s record from the dashboard
            at any time. That record covers identity, enrolment, results, inferred
            understanding and staff notes — but not the student&apos;s own conversations with{" "}
            <RayaName />, for the reason set out in §7.
          </p>

          {/* ------------------------------------------------------- coppa --- */}
          <h2 style={h2(t)}>4. COPPA — consent for under-13s</h2>
          <p style={p(t)}>
            We do not open accounts for children under 13 who arrive on their own; they are
            stopped at the age question. Under-13s reach <RayaName /> only through a school.
          </p>
          <p style={p(t)}>
            By enrolling students under 13, <strong>the school confirms that it consents on
            behalf of their parents</strong> for the school&apos;s educational use, as the
            COPPA school-consent exception permits (16 CFR § 312.5(c)(6)), and that it has
            given parents notice of what we collect. We collect from children only what the
            service needs, never condition participation on more, and never use a child&apos;s
            data for advertising or profiling outside tutoring. On a parent&apos;s request,
            relayed by the school, we delete a child&apos;s data.
          </p>

          {/* ------------------------------------------------- sub-processors --- */}
          <h2 style={h2(t)}>5. Sub-processors</h2>
          <p style={p(t)}>
            We use the providers listed on our{" "}
            <Link href="/subprocessors" style={link(t)}>
              sub-processors page
            </Link>
            , which also states, honestly, which of those agreements are already signed and
            which are still being put in place — we have only just launched. Whatever their
            status, we remain responsible to you for what those providers do.
          </p>
          <p style={p(t)}>
            We update that page and notify school administrators before a new sub-processor
            starts handling school data. A school may object on reasonable data protection
            grounds within 30 days; if we cannot offer an alternative, the school may
            terminate the affected part of the service and be refunded the unused balance.
          </p>

          {/* ---------------------------------------------------- security --- */}
          <h2 style={h2(t)}>6. Security</h2>
          <ul style={ul}>
            <li style={li(t)}>
              Data is encrypted in transit and at rest by our infrastructure provider.
            </li>
            <li style={li(t)}>
              Access is enforced in the database itself with row-level security, so a teacher
              reaches their own classes and no others — not merely because the interface hides
              the rest.
            </li>
            <li style={li(t)}>
              Staff access is scoped by role, and privileged operations run server-side only.
            </li>
            <li style={li(t)}>Everyone with access is bound to confidentiality.</li>
          </ul>
          <p style={p(t)}>
            <strong>Breach notification.</strong> If we suffer a personal data breach affecting
            a school&apos;s data, we notify that school without undue delay and in any event
            within 72 hours of becoming aware, with what we know and what we are doing about
            it.
          </p>

          {/* --------------------------------------------------------- use --- */}
          <h2 style={h2(t)}>7. What we will not do</h2>
          <ul style={ul}>
            <li style={li(t)}>We do not sell student data. There is no circumstance in which we would.</li>
            <li style={li(t)}>We do not serve advertising, and we do not build advertising profiles.</li>
            <li style={li(t)}>
              We do not use student content to train models unless the account holder
              explicitly opted in — and that option is not available to under-18s, which is
              every student in a school setting below sixth form.
            </li>
            <li style={li(t)}>
              We do not give staff a student&apos;s private tutoring conversations. A student
              who believes their tutor is being read stops asking the questions that make
              tutoring work, so the staff record covers what the student produced and what the
              system inferred, not the transcript. The student, or a parent through the
              student, can export the transcript in full.
            </li>
          </ul>

          {/* ------------------------------------------------------ rights --- */}
          <h2 style={h2(t)}>8. Helping the school meet its obligations</h2>
          <p style={p(t)}>
            We assist the school with data subject requests (access, correction, deletion,
            portability), with data protection impact assessments, and with regulator
            enquiries. Most requests are answerable directly from the dashboard; where they are
            not, write to{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            . If a data subject comes to us directly, we refer them to the school rather than
            acting on our own.
          </p>
          <p style={p(t)}>
            We make available the information needed to demonstrate compliance with these
            obligations and allow for audits, on reasonable notice and without disrupting the
            service for other schools.
          </p>

          {/* --------------------------------------------------- deletion --- */}
          <h2 style={h2(t)}>9. Return and deletion</h2>
          <p style={p(t)}>
            At any time during the term the school can export its students&apos; records. When
            the contract ends, we delete school data within{" "}
            <strong>90 days</strong> at the school&apos;s choice of deletion or return, except
            where a law requires us to keep something — payment records being the usual case.
          </p>
          <p style={p(t)}>
            Deletion is real. It reaches the learning content, the uploads, the assessment
            results and the inferred learning model, including the parts held in systems that
            no automatic cascade would have reached.
          </p>

          {/* ------------------------------------------------- transfers --- */}
          <h2 style={h2(t)}>10. International transfers</h2>
          <p style={p(t)}>
            Where a sub-processor operates outside the EEA or the UK, transfers must be
            covered by the European Commission&apos;s Standard Contractual Clauses or an
            adequacy decision. The location of each provider, and the current status of that
            cover, is on the{" "}
            <Link href="/subprocessors" style={link(t)}>
              sub-processors page
            </Link>
            .
          </p>

          <div style={note(t)}>
            This page states the commitments we make to every school on the same terms. It is
            not legal advice. A school that needs a countersigned document, or its own
            paperwork on top of this, should write to{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>{" "}
            and we will arrange it.
          </div>
        </>
      )}
    </LegalShell>
  );
}
