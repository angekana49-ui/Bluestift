"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, Table, h2, h3, li, link, note, p, ul } from "./legal-chrome";

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
  return (
    <LegalShell
      active="Privacy"
      section="Privacy"
      signedIn={signedIn}
      title="Privacy"
      accent="policy."
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            Bluestift builds <RayaName />, an AI tutor for students, and a companion dashboard
            for schools. This page explains what we hold, why we are allowed to hold it, how
            long we keep it, and what you can do about it. It is written to be read, not to be
            survived.
          </p>

          <h2 style={h2(t)}>The short version</h2>
          <ul style={ul}>
            <li style={li(t)}>
              You can start anonymously — no email required to try <RayaName />.
            </li>
            <li style={li(t)}>
              Analytics is <strong>opt-in</strong>, and switched off entirely for anyone under
              18. Declining changes nothing about how the product works.
            </li>
            <li style={li(t)}>
              On an adult account, your work <strong>is</strong> used to improve our models
              unless you switch that off — one toggle in your settings, effective immediately.
              For under-18s it is never used, and the option isn&apos;t offered at all.
            </li>
            <li style={li(t)}>
              If your account is <strong>linked to a school</strong>, your progress is visible
              to your teachers. If it is linked to nobody, nothing about your learning leaves
              your account.
            </li>
            <li style={li(t)}>No ads. No selling data. No cross-site tracking.</li>
            <li style={li(t)}>
              You can download everything we hold, or delete your account outright, from{" "}
              <Link href="/account" style={link(t)}>
                your settings
              </Link>{" "}
              — no request form, no waiting.
            </li>
          </ul>

          {/* ------------------------------------------------------------- age --- */}
          <h2 style={h2(t)}>Children and age</h2>
          <p style={p(t)}>
            We ask everyone the year they were born. We store the year, never a full date of
            birth, and we ask it neutrally rather than as &ldquo;are you over 13?&rdquo; — a
            question phrased that way just tells a child which answer opens the door.
          </p>
          <p style={p(t)}>
            <strong>Under 13.</strong> We do not knowingly open accounts for children under 13
            on their own. We operate no verifiable parental consent mechanism of our own, so
            the only route in is a school: a school that adopts Bluestift consents on the
            parent&apos;s behalf for school use, which is the exception COPPA provides at 16
            CFR § 312.5(c)(6). A child who signs up alone is stopped at the age question, and
            we hold nothing but the year they gave us until the account is deleted.
          </p>
          <p style={p(t)}>
            <strong>Under 18.</strong> Optional processing is off and cannot be switched on:
            no product analytics, and no use of their content to improve models. That is
            stricter than the law strictly requires in some countries — GDPR art. 8 sets the
            age of digital consent between 13 and 16 depending on the member state — and we
            would rather be too careful with a 17-year-old than not careful enough with a
            13-year-old.
          </p>
          <p style={p(t)}>
            <strong>Parents.</strong> You can ask to see, correct or delete your child&apos;s
            data. If they use Bluestift through a school, the fastest route is the school,
            which can produce their record directly. Either way, write to{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>{" "}
            and we will help.
          </p>

          {/* --------------------------------------------------------- what/why --- */}
          <h2 style={h2(t)}>What we collect, why, and on what basis</h2>
          <p style={p(t)}>
            &ldquo;Legal basis&rdquo; is the GDPR term for what entitles us to hold something
            at all. Where it says <em>contract</em>, the product cannot work without it. Where
            it says <em>consent</em>, you chose it and can un-choose it.
          </p>
          <Table
            t={t}
            head={["What", "Why", "Legal basis"]}
            rows={[
              [
                "Account — a random identifier, a username, a display name, and an email if you add one",
                "To have an account at all, and to get you back into it",
                "Contract",
              ],
              [
                "Year of birth",
                "To apply the age rules above",
                "Legal obligation",
              ],
              [
                "Your conversations, uploads and generated study material",
                "To tutor you, and to let you come back to your work",
                "Contract",
              ],
              [
                "Learning signals — what you've worked on and where you struggle",
                "To adapt the tutoring, and to show your teachers class-level progress",
                "Contract",
              ],
              [
                "School enrolment — your real name, class and year, held for your school",
                "So your school can identify you in its own dashboard",
                "Contract (with your school)",
              ],
              [
                "Product analytics",
                "To see which features actually help",
                "Consent — off until you accept, never for under-18s",
              ],
              [
                "Using your content to improve our models",
                "To make the tutor better",
                "Consent — on by default on adult accounts, switchable off at any time; never for under-18s",
              ],
              [
                "Sending your progress to your school",
                "So your teachers can see who is stuck and on what",
                "Contract (with your school) — only while your account is linked to one",
              ],
              [
                "Server logs and a coarse network signal",
                "To stop spam, abuse and runaway automated sign-ups",
                "Legitimate interests",
              ],
              ["Payment records", "To take payment and keep the books", "Contract / legal obligation"],
            ]}
          />
          <p style={p(t)}>
            We do not use your content to advertise to you, and we do not sell or share
            personal information in the sense US state privacy laws give those words.
          </p>

          <h3 style={h3(t)}>What Raya keeps about how you learn</h3>
          <p style={p(t)}>
            To tutor properly, <RayaName /> maintains a model of your understanding — which
            concepts you have grasped, how confidently, and how you tend to approach
            difficulty. You do not see this model in the interface, which is exactly why it is
            included in full in the data export below. It is yours to look at.
          </p>

          {/* ------------------------------------------------------- analytics --- */}
          <h2 style={h2(t)}>Analytics &amp; cookies</h2>
          <p style={p(t)}>
            Product analytics is provided by <strong>PostHog</strong> and is strictly opt-in.
            Until you accept the banner, the analytics library is never even downloaded — no
            events, on your device or on our servers. If you accept, we record page views and
            a few product actions tied to your account identifier, so we can measure real
            usage. You can decline and use everything.
          </p>
          <p style={p(t)}>
            You can withdraw that consent whenever you like from{" "}
            <Link href="/account" style={link(t)}>
              your settings
            </Link>
            , with one switch. It is as easy to withdraw as it was to give, which is what art.
            7(3) asks for.
          </p>
          <p style={p(t)}>
            Cookies are minimal: one to keep you signed in, one to remember your analytics
            choice so we stop asking, and one to remember which school you are looking at if
            you belong to several. There are no advertising or cross-site tracking cookies.
          </p>

          {/* ---------------------------------------------------------- who --- */}
          <h2 style={h2(t)}>Who processes data for us</h2>
          <p style={p(t)}>
            A short list, each one only for what it is named for. The current sub-processors,
            with what they hold and where, are on the{" "}
            <Link href="/subprocessors" style={link(t)}>
              sub-processors page
            </Link>
            , which we keep up to date as they change.
          </p>
          <p style={p(t)}>
            Text you send to <RayaName /> is processed by large-language-model providers to
            generate a reply. We use them on their API terms, which do not feed that content
            into training of their public models.
          </p>
          <p style={p(t)}>
            Some of these providers operate outside the EEA and the UK. Those transfers need
            to be covered by the European Commission&apos;s Standard Contractual Clauses or an
            adequacy decision, and we are working through that provider by provider as a newly
            launched company. The{" "}
            <Link href="/subprocessors" style={link(t)}>
              sub-processors page
            </Link>{" "}
            says where we are rather than claiming it is finished.
          </p>

          {/* ------------------------------------------------------ retention --- */}
          <h2 style={h2(t)}>How long we keep it</h2>
          <Table
            t={t}
            head={["What", "How long"]}
            rows={[
              ["Your account and its content", "While the account is active"],
              [
                "Anonymous accounts that are never used",
                "Deactivated after 60 days of inactivity, deleted after 180",
              ],
              [
                "School records",
                "For the school's contracted term, then returned or destroyed at its instruction",
              ],
              ["Payment records", "As long as accounting and tax rules require"],
              [
                "The log that a data request happened",
                "Kept after the data itself is deleted — it is the proof we deleted it",
              ],
            ]}
          />
          <p style={p(t)}>
            When you delete your account, we delete the account, your conversations, your
            uploads, your results and the cognitive profile — including the parts of it held
            in systems that no automatic cascade would have reached. Payment records survive,
            because art. 17(3)(b) requires them to.
          </p>

          {/* --------------------------------------------------------- rights --- */}
          <h2 style={h2(t)}>Your rights</h2>
          <p style={p(t)}>
            If you are in the EU, the UK or a US state with a privacy law, you have rights of
            access, correction, deletion, portability, and objection to certain processing,
            and you may withdraw consent at any time. Two of those are wired straight into the
            product:
          </p>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>Access &amp; portability.</strong> Download everything we hold as a JSON
              file from{" "}
              <Link href="/account" style={link(t)}>
                your settings
              </Link>
              .
            </li>
            <li style={li(t)}>
              <strong>Erasure.</strong> Delete your account from the same page. It is
              immediate and cannot be undone.
            </li>
          </ul>
          <p style={p(t)}>
            For anything else — a correction, an objection, a question about the year of birth
            on file — write to{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            . We do not charge for any of this, and we do not treat you differently for asking.
            If you are in the EEA or the UK you can also complain to your national data
            protection authority.
          </p>

          {/* -------------------------------------------------------- schools --- */}
          <h2 style={h2(t)}>Schools, students and staff</h2>
          <p style={p(t)}>
            When a school adopts Bluestift, the <strong>school</strong> decides what is
            collected about its students and we act on its instructions — it is the
            controller, we are the processor. In US terms we act as a{" "}
            <strong>school official</strong> with a legitimate educational interest under FERPA
            (34 CFR § 99.31(a)(1)): we use student data only to provide the service, we do not
            re-disclose it, and we return or destroy it when the contract ends. The terms are
            set out in the{" "}
            <Link href="/dpa" style={link(t)}>
              data processing addendum
            </Link>
            .
          </p>
          <p style={p(t)}>
            Staff see their own classes, not the school at large. A parent exercising the
            FERPA right to inspect and review their child&apos;s record asks the school, which
            can produce it from its dashboard.
          </p>
          <p style={p(t)}>
            One thing that record deliberately leaves out: a student&apos;s own conversations
            with <RayaName />. A tutor you believe is being read over your shoulder is a tutor
            you stop asking real questions of, and the tutoring stops working. Those
            conversations are available in full through the student&apos;s own export.
          </p>

          <div style={note(t)}>
            This page describes what our systems do. It is not legal advice, and it is not a
            substitute for the contract your school signs with us.
          </div>

          {/* ------------------------------------------------------- contact --- */}
          <h2 style={h2(t)}>Changes &amp; contact</h2>
          <p style={p(t)}>
            We will update this page when our practices change and revise the date above.
            Questions, requests, or concerns:{" "}
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
