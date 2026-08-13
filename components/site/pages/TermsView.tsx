"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, h2, li, link, note, p, ul } from "./legal-chrome";

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
  return (
    <LegalShell
      active="Privacy"
      section="Terms"
      signedIn={signedIn}
      title="Terms of"
      accent="service."
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            These terms cover your use of Bluestift and <RayaName />. Using the product means
            you accept them. If you are using Bluestift through your school, your school&apos;s
            agreement with us also applies and takes precedence where the two differ.
          </p>

          <h2 style={h2(t)}>1. Who can use Bluestift</h2>
          <ul style={ul}>
            <li style={li(t)}>
              <strong>13 and over</strong> — you can open an account yourself. If you are under
              18 you should have your parent or guardian&apos;s permission.
            </li>
            <li style={li(t)}>
              <strong>Under 13</strong> — only through a school that has enrolled you. We do
              not open accounts for under-13s who sign up on their own; see the{" "}
              <Link href="/privacy" style={link(t)}>
                privacy policy
              </Link>{" "}
              for why.
            </li>
            <li style={li(t)}>
              We ask everyone their year of birth and act on the answer. Giving a false one to
              get past that is a breach of these terms.
            </li>
          </ul>

          <h2 style={h2(t)}>2. Your account</h2>
          <p style={p(t)}>
            You are responsible for what happens under your account. If you use an anonymous
            account, the <strong>recovery key is the only way back in</strong> — we cannot
            restore it for you, and anyone holding it has full access. Keep it private, and
            add an email if you would rather not carry that risk.
          </p>

          <h2 style={h2(t)}>3. What Raya is, and is not</h2>
          <p style={p(t)}>
            <RayaName /> is an AI tutor. It teaches by asking rather than answering, and{" "}
            <strong>it can be wrong</strong>. Check anything that matters — a grade, an exam
            answer, a fact you are about to rely on. It is not a substitute for a teacher, and
            it is not professional advice of any kind: not medical, not legal, not financial,
            not psychological.
          </p>
          <p style={p(t)}>
            If a conversation ever suggests a student is at risk of harm, please involve a
            responsible adult. <RayaName /> is a study tool, not a crisis service.
          </p>

          <h2 style={h2(t)}>4. Acceptable use</h2>
          <p style={p(t)}>Do not use Bluestift to:</p>
          <ul style={ul}>
            <li style={li(t)}>break the law, or help anyone else do so;</li>
            <li style={li(t)}>
              cheat where your school forbids it — a tutor that does your homework for you is
              not what this is, and your school sets that rule, not us;
            </li>
            <li style={li(t)}>
              harass anyone, or upload content that is abusive, hateful or sexual, especially
              involving minors;
            </li>
            <li style={li(t)}>
              upload material you have no right to share, or someone else&apos;s personal data
              without a reason to;
            </li>
            <li style={li(t)}>
              attack, scrape or overload the service, evade rate limits, or attempt to reach
              another user&apos;s data.
            </li>
          </ul>

          <h2 style={h2(t)}>5. Your content</h2>
          <p style={p(t)}>
            What you write and upload stays yours. You give us the permission we need to store
            it, process it and show it back to you — and to send it to a model provider so
            that <RayaName /> can reply. Nothing more.
          </p>
          <p style={p(t)}>
            We do not use your content to improve our models unless you switch that on in your
            settings, and the option is not offered on accounts belonging to under-18s.
          </p>

          <h2 style={h2(t)}>6. School accounts</h2>
          <p style={p(t)}>
            If you join through a class code, your school sees your name, your class and your
            results. It does not see your conversations with <RayaName />. Your school
            administers your access and can remove it. The terms we operate under are in the{" "}
            <Link href="/dpa" style={link(t)}>
              data processing addendum
            </Link>
            .
          </p>

          <h2 style={h2(t)}>7. Paid plans</h2>
          <p style={p(t)}>
            Prices and what each plan includes are on the{" "}
            <Link href="/pricing" style={link(t)}>
              pricing page
            </Link>
            . Subscriptions renew for the term you chose until cancelled, and cancelling stops
            the next renewal rather than refunding the current one. Where consumer law gives
            you a right of withdrawal, that right applies and overrides this paragraph. School
            plans are billed per seat under the school&apos;s own agreement.
          </p>
          <p style={p(t)}>
            We may change prices. Existing subscribers keep their price until the end of the
            term they have paid for.
          </p>

          <h2 style={h2(t)}>8. Availability</h2>
          <p style={p(t)}>
            We work to keep Bluestift running but do not promise it will never be down. We may
            change or discontinue features. If we discontinue something a school is paying
            for, we will refund the unused balance.
          </p>

          <h2 style={h2(t)}>9. Ending it</h2>
          <p style={p(t)}>
            You can delete your account at any time from{" "}
            <Link href="/account" style={link(t)}>
              your settings
            </Link>
            . It is immediate and cannot be undone. We may suspend or close an account that
            breaches these terms, or that puts other users or the service at risk — and where
            we can, we will say why first.
          </p>

          <h2 style={h2(t)}>10. Liability</h2>
          <p style={p(t)}>
            Bluestift is provided as it is. To the extent the law allows, we are not liable for
            indirect or consequential loss, or for decisions taken on the strength of something{" "}
            <RayaName /> said — see §3. Nothing here limits liability that cannot legally be
            limited, including for death or personal injury caused by negligence, or for
            fraud. Where our liability is capped, it is capped at what you paid us in the
            twelve months before the claim.
          </p>

          <h2 style={h2(t)}>11. Changes</h2>
          <p style={p(t)}>
            We will update these terms as the product changes and revise the date above. For
            material changes we will give notice in the product or by email before they take
            effect.
          </p>

          <h2 style={h2(t)}>12. Governing law</h2>
          <p style={p(t)}>
            Bluestift is established in the United States, and these terms are governed by
            the law of the US state in which it is established, whose courts have jurisdiction
            — except that consumers keep the protection of the mandatory laws of the country
            where they live, and may bring proceedings there. We will name that state here as
            soon as the company is formally incorporated.
          </p>

          <div style={note(t)}>
            Questions about any of this:{" "}
            <a href="mailto:hello@thebluestift.com" style={link(t)}>
              hello@thebluestift.com
            </a>
            . For data protection specifically:{" "}
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
