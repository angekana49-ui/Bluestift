import "server-only";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { fromHeader, replyTo, siteUrl } from "@/lib/email";
import { isPlatformOwner } from "@/lib/ops";
import { chunk, renderIssueEmail, unsubscribeHeaders } from "@/lib/newsletter/render";
import { mintUnsubscribeToken } from "@/lib/newsletter/tokens";
import { NEWSLETTER_PATHS } from "@/lib/newsletter/subscribers";

/**
 * Send one newsletter issue to every confirmed subscriber. PREPARED, NOT
 * WIRED: no route or cron calls this, and it refuses unless
 * NEWSLETTER_SENDING_ENABLED=1 — a second switch, separate from the secret,
 * so configuring the links does not also arm the mass send.
 *
 * Resumable and idempotent. Each recipient gets a row in
 * content.newsletter_deliveries (unique per issue + subscriber) and a rerun
 * skips everyone already marked `sent`, so a timeout halfway through a list is
 * finished by running it again, never by mailing the first half twice. The
 * issue moves draft → sending → sent; `sending` is also the resume state.
 *
 * Requires supabase/drafts/newsletter_v1.sql, NEWSLETTER_SECRET, RESEND_API_KEY.
 */

const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
/** Resend's batch ceiling. */
const BATCH_SIZE = 100;
/** Page size for the audience read — under PostgREST's default max_rows. */
const PAGE = 1000;

export type SendIssueResult =
  | { ok: false; reason: "disabled" | "forbidden" | "not_found" | "not_sendable" | "no_body" | "error" }
  | { ok: true; audience: number; alreadySent: number; sent: number; failed: number; dryRun: boolean };

type Issue = { id: string; title: string; issue_number: string; body_md: string | null; status: string };
type Recipient = { id: string; email: string };

export function newsletterSendingEnabled(): boolean {
  return process.env.NEWSLETTER_SENDING_ENABLED === "1" && !!process.env.RESEND_API_KEY;
}

export async function sendIssue(
  issueId: string,
  opts: { actorId: string; dryRun?: boolean },
): Promise<SendIssueResult> {
  if (!newsletterSendingEnabled()) return { ok: false, reason: "disabled" };
  // The actor comes from the caller's verified session, like every ops tool.
  if (!(await isPlatformOwner(opts.actorId))) return { ok: false, reason: "forbidden" };

  const admin = createContentAdminClient();
  const { data: issueData } = await admin
    .from("newsletter_issues")
    .select("id, title, issue_number, body_md, status")
    .eq("id", issueId)
    .maybeSingle();
  const issue = issueData as Issue | null;
  if (!issue) return { ok: false, reason: "not_found" };
  if (issue.status !== "draft" && issue.status !== "sending") return { ok: false, reason: "not_sendable" };
  if (!issue.body_md?.trim()) return { ok: false, reason: "no_body" };

  try {
    const audience = await loadAudience();
    const done = await loadDelivered(issue.id);
    const pending = audience.filter((r) => !done.has(r.id));
    if (opts.dryRun) {
      return { ok: true, audience: audience.length, alreadySent: done.size, sent: 0, failed: 0, dryRun: true };
    }

    // Claim the issue. Conditional on its status, so two concurrent sends
    // cannot both move it out of `draft`; a resume finds it in `sending`.
    await admin.from("newsletter_issues").update({ status: "sending" }).eq("id", issue.id).in("status", ["draft", "sending"]);

    let sent = 0;
    let failed = 0;
    for (const batch of chunk(pending, BATCH_SIZE)) {
      const outcome = await sendBatch(issue, batch);
      const rows = batch.map((r, i) => ({
        issue_id: issue.id,
        subscriber_id: r.id,
        status: outcome.ok ? "sent" : "failed",
        provider_id: outcome.ok ? (outcome.ids[i] ?? null) : null,
        error: outcome.ok ? null : outcome.error.slice(0, 500),
      }));
      await admin.from("newsletter_deliveries").upsert(rows, { onConflict: "issue_id,subscriber_id" });
      if (outcome.ok) sent += batch.length;
      else failed += batch.length;
    }

    if (failed === 0) {
      await admin
        .from("newsletter_issues")
        // published_at becomes the real send date, which is what the archive shows.
        .update({ status: "sent", sent_at: new Date().toISOString(), published_at: new Date().toISOString() })
        .eq("id", issue.id);
    }
    return { ok: true, audience: audience.length, alreadySent: done.size, sent, failed, dryRun: false };
  } catch {
    return { ok: false, reason: "error" };
  }
}

async function loadAudience(): Promise<Recipient[]> {
  const admin = createContentAdminClient();
  const out: Recipient[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("research_subscribers")
      .select("id, email")
      .eq("confirmed", true)
      .is("unsubscribed_at", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Recipient[]));
    if (!data || data.length < PAGE) return out;
  }
}

async function loadDelivered(issueId: string): Promise<Set<string>> {
  const admin = createContentAdminClient();
  const done = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("newsletter_deliveries")
      .select("subscriber_id")
      .eq("issue_id", issueId)
      .eq("status", "sent")
      .order("subscriber_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ subscriber_id: string }>) done.add(r.subscriber_id);
    if (!data || data.length < PAGE) return done;
  }
}

async function sendBatch(
  issue: Issue,
  recipients: Recipient[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const base = siteUrl("bluestift");
  const from = fromHeader("bluestift");
  const payload = recipients.map((r) => {
    const unsubscribeUrl = `${base}${NEWSLETTER_PATHS.unsubscribe}?token=${encodeURIComponent(mintUnsubscribeToken(r.id))}`;
    const mail = renderIssueEmail({
      title: issue.title,
      issueNumber: issue.issue_number,
      bodyMd: issue.body_md ?? "",
      unsubscribeUrl,
      webUrl: `${base}/research?tab=newsletter`,
    });
    return {
      from,
      to: [r.email],
      reply_to: replyTo(),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: unsubscribeHeaders(unsubscribeUrl),
    };
  });
  try {
    const res = await fetch(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null;
    return { ok: true, ids: (json?.data ?? []).map((d) => d.id ?? "") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
