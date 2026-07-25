"use client";

import SitePage from "@/components/site/SitePage";
import type { Theme } from "@/components/site/theme";

const UPDATED = "25 July 2026";

export function PrivacyView({ signedIn }: { signedIn: boolean }) {
  const h2 = (t: Theme) =>
    ({
      fontFamily: "'IBM Plex Sans',sans-serif",
      fontWeight: 800,
      fontSize: "1.05rem",
      letterSpacing: "-0.01em",
      color: t.text,
      margin: "34px 0 10px",
    }) as const;

  const p = (t: Theme) =>
    ({ fontSize: 15, color: t.text, lineHeight: 1.75, margin: "0 0 12px" }) as const;

  const li = (t: Theme) =>
    ({ fontSize: 15, color: t.text, lineHeight: 1.7, marginBottom: 7 }) as const;

  return (
    <SitePage active="Privacy" section="Privacy" signedIn={signedIn}>
      {(t) => (
        <section style={{ position: "relative", zIndex: 1, overflow: "hidden", padding: "150px 24px 0" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box", paddingBottom: 96 }}>
            <h1
              style={{
                fontFamily: "'IBM Plex Sans',sans-serif",
                fontWeight: 900,
                fontSize: "clamp(1.6rem,4vw,2.4rem)",
                letterSpacing: "-0.02em",
                margin: "0 0 10px",
                color: t.text,
              }}
            >
              Privacy{" "}
              <em style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", color: t.wordmarkB }}>
                policy.
              </em>
            </h1>
            <p style={{ fontSize: 14, color: t.muted, margin: "0 0 26px" }}>Last updated {UPDATED}</p>

            <p style={p(t)}>
              BlueStift builds Raya, an AI tutor for students and a companion dashboard for schools. We try to
              collect as little as possible, to be clear about what we do collect, and to let you use the product
              without handing over more than you want to. This page explains what we hold and why.
            </p>

            <h2 style={h2(t)}>The short version</h2>
            <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
              <li style={li(t)}>You can start anonymously — no email required to try Raya.</li>
              <li style={li(t)}>Analytics is <strong>opt-in</strong>: nothing is measured until you accept the banner, and declining changes nothing about how the product works.</li>
              <li style={li(t)}>We don&apos;t show ads, and we don&apos;t sell your data.</li>
            </ul>

            <h2 style={h2(t)}>What we collect</h2>
            <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
              <li style={li(t)}>
                <strong>Account.</strong> Raya can be used with an anonymous account (a random identifier, no
                personal details). If you add an email — for account recovery, a school invitation, or receipts —
                we store it.
              </li>
              <li style={li(t)}>
                <strong>What you create.</strong> Your conversations with Raya, documents you upload, and the
                study material generated for you (summaries, quizzes, mind maps, exam prep). This is stored so the
                product can remember your progress and you can come back to it.
              </li>
              <li style={li(t)}>
                <strong>Learning signals.</strong> To personalise tutoring, Raya keeps a model of what a student
                has worked on and where they struggle. For school accounts, staff see aggregated performance for
                their own classes.
              </li>
              <li style={li(t)}>
                <strong>Product analytics.</strong> Only if you consent — see below.
              </li>
              <li style={li(t)}>
                <strong>Basic technical data.</strong> Standard server logs and a coarse network signal used only
                to limit spam and abuse.
              </li>
            </ul>

            <h2 style={h2(t)}>How we use it</h2>
            <p style={p(t)}>
              To run the tutor and the school dashboard, to remember your progress, to keep the service secure and
              free of abuse, and — where you&apos;ve agreed — to understand which features are useful so we can
              improve them. We do not use your content to advertise to you.
            </p>

            <h2 style={h2(t)}>Analytics &amp; cookies</h2>
            <p style={p(t)}>
              Product analytics is provided by <strong>PostHog</strong> and is strictly opt-in. Until you accept
              the consent banner, no analytics events are captured — on your device or on our servers. If you
              accept, we record page views and a few product actions (for example, that a document was generated
              or a room created), tied to your account identifier so we can measure real usage and retention. You
              can decline and still use everything.
            </p>
            <p style={p(t)}>
              Cookies we set are minimal: one to keep you signed in, and one to remember your analytics choice so
              we don&apos;t ask again. We use no advertising or cross-site tracking cookies.
            </p>

            <h2 style={h2(t)}>Who processes data for us</h2>
            <p style={p(t)}>
              We rely on a small set of service providers, each only for what it&apos;s named for:
            </p>
            <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
              <li style={li(t)}><strong>Supabase</strong> — database, authentication, and file storage.</li>
              <li style={li(t)}><strong>PostHog</strong> — product analytics (only with your consent).</li>
              <li style={li(t)}><strong>AI model providers</strong> — the text you send to Raya is processed by large-language-model providers to generate replies. It isn&apos;t used to train their public models under our configuration.</li>
              <li style={li(t)}><strong>Cloudflare Turnstile</strong> — bot/abuse protection on public forms.</li>
              <li style={li(t)}><strong>Email &amp; payment providers</strong> — to send account emails and, for paid plans, to process payments. We never store full card numbers.</li>
            </ul>

            <h2 style={h2(t)}>How long we keep it</h2>
            <p style={p(t)}>
              We keep your account and content while your account is active. School records follow the contracted
              archive window. You can ask us to delete your account and associated data at any time (see below);
              some records may be retained briefly where required for security or legal reasons.
            </p>

            <h2 style={h2(t)}>Your choices</h2>
            <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
              <li style={li(t)}>Change or withdraw analytics consent at any time by clearing site data, which brings the banner back.</li>
              <li style={li(t)}>Ask for a copy of your data, or its deletion, by contacting us.</li>
              <li style={li(t)}>Use Raya anonymously if you&apos;d rather not share an email.</li>
            </ul>

            <h2 style={h2(t)}>Students &amp; schools</h2>
            <p style={p(t)}>
              Raya is used by K-12 students, often through their school. When a school adopts BlueStift, the school
              is responsible for the appropriate consent for its students, and staff only see data for their own
              classes. If you&apos;re a parent or school and have a question about a student&apos;s data, contact
              us and we&apos;ll help.
            </p>

            <h2 style={h2(t)}>Changes &amp; contact</h2>
            <p style={p(t)}>
              We&apos;ll update this page when our practices change and revise the date above. Questions, requests,
              or concerns:{" "}
              <a href="mailto:hello@thebluestift.com" style={{ color: t.wordmarkB, fontWeight: 600, textDecoration: "none" }}>
                hello@thebluestift.com
              </a>
              .
            </p>
          </div>
        </section>
      )}
    </SitePage>
  );
}
