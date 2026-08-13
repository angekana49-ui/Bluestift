"use client";

import Link from "next/link";
import { RayaName } from "@/components/ui/brand";
import { LegalShell, Table, h2, li, link, note, p, ul } from "./legal-chrome";

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
  return (
    <LegalShell
      active="Privacy"
      section="Sub-processors"
      signedIn={signedIn}
      title="Sub-"
      accent="processors."
      updated={UPDATED}
    >
      {(t) => (
        <>
          <p style={p(t)}>
            These are the companies that process personal data on our behalf so Bluestift can
            work. Each one is here for a single named purpose and has no right to use the data
            for anything else.
          </p>

          <div style={note(t)}>
            <strong>Where we are today.</strong> Bluestift has just launched. We are working
            through each provider&apos;s data processing agreement, including the standard
            contractual clauses that cover transfers out of the EEA and the UK. Until this page
            says a given agreement is in place, assume it is still in progress — and if that
            matters to your decision, ask us and we&apos;ll tell you exactly where it stands.
            We would rather be checkable than sound finished.
          </div>

          <h2 style={h2(t)}>Current sub-processors</h2>
          <Table
            t={t}
            head={["Provider", "What it does", "Data it sees", "Where"]}
            rows={[
              [
                "Supabase",
                "Database, authentication and file storage — the system of record",
                "Everything stored: accounts, conversations, uploads, learning signals",
                "EU",
              ],
              [
                "Vercel",
                "Application hosting and scheduled jobs",
                "Requests in transit, server logs",
                "EU / US",
              ],
              [
                "Google (Gemini)",
                "Generates Raya's replies",
                "The text of a tutoring turn and the context sent with it",
                "US",
              ],
              [
                "Groq",
                "Fallback model for replies, and speech-to-text for voice",
                "The text of a tutoring turn; recorded audio when voice is used",
                "US",
              ],
              [
                "PostHog",
                "Product analytics — only for accounts that opted in, never under-18s",
                "Page views, a few product events, an account identifier",
                "EU",
              ],
              [
                "Cloudflare",
                "Turnstile bot protection on public forms and sign-up",
                "A challenge token and network metadata",
                "Global",
              ],
              [
                "Resend",
                "Transactional email — invitations, decisions, receipts",
                "Email address and the message content",
                "EU / US",
              ],
              [
                "CinetPay",
                "Card and mobile-money payments",
                "Payment details and the amount. We never store full card numbers",
                "Africa / EU",
              ],
              [
                "Google Classroom",
                "Optional LMS import, only for schools that connect it",
                "Course and roster data the school chooses to share",
                "US",
              ],
            ]}
          />

          <h2 style={h2(t)}>What we require of them</h2>
          <ul style={ul}>
            <li style={li(t)}>
              They process data only on our documented instructions, for the purpose named
              above.
            </li>
            <li style={li(t)}>
              We use model providers on their API terms, which do not feed content into
              training of their public models.
            </li>
            <li style={li(t)}>
              Transfers outside the EEA or the UK must be covered by Standard Contractual
              Clauses or an adequacy decision — see the note above on where we are with that.
            </li>
            <li style={li(t)}>They are bound to confidentiality and to appropriate security.</li>
          </ul>

          <h2 style={h2(t)}>Changes</h2>
          <p style={p(t)}>
            We update this page before a new sub-processor starts handling school data, and
            notify school administrators by email. A school may object on reasonable data
            protection grounds — see the{" "}
            <Link href="/dpa" style={link(t)}>
              data processing addendum
            </Link>
            .
          </p>

          <div style={note(t)}>
            <RayaName /> works without several of these. A school that has not connected
            Google Classroom is never touched by that row; an account that declined analytics
            is never touched by PostHog.
          </div>

          <p style={p(t)}>
            Questions:{" "}
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
