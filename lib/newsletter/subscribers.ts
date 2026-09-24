import "server-only";
import { createContentAdminClient } from "@/lib/supabase/admin";
import { sendEmail, siteUrl } from "@/lib/email";
import { renderConfirmEmail } from "@/lib/newsletter/render";
import { mintConfirmToken, verifyConfirmToken, verifyUnsubscribeToken } from "@/lib/newsletter/tokens";
import type { Locale } from "@/lib/locale";

/**
 * Newsletter subscriber lifecycle — double opt-in and unsubscribe. PREPARED,
 * NOT WIRED: app/api/content/subscribe still does today's single opt-in insert,
 * and no confirm/unsubscribe route exists yet.
 *
 * Requires supabase/drafts/newsletter_v1.sql (confirmed_at, unsubscribed_at,
 * locale) and NEWSLETTER_SECRET.
 *
 * Every answer to the outside world is the same "check your inbox", whether
 * the address was new, pending, confirmed or unsubscribed — the signup form
 * must not become a way to test whether someone reads our newsletter.
 */

/** Where the future routes will live. One place, so the links and the routes cannot drift. */
export const NEWSLETTER_PATHS = {
  confirm: "/research/newsletter/confirm",
  unsubscribe: "/api/content/unsubscribe",
} as const;

export function confirmUrl(subscriberId: string): string {
  return `${siteUrl("bluestift")}${NEWSLETTER_PATHS.confirm}?token=${encodeURIComponent(mintConfirmToken(subscriberId))}`;
}

type SubscriberRow = {
  id: string;
  email: string;
  confirmed: boolean;
  unsubscribed_at: string | null;
};

/**
 * Start (or restart) a double opt-in. Called AFTER the route's captcha and
 * per-IP limit, exactly where today's insert sits.
 *
 * A confirmed, still-subscribed address gets no mail — re-sending a
 * confirmation to someone already subscribed is how a form gets used to spam
 * a third party. An unsubscribed address gets a fresh confirmation: coming
 * back has to be as deliberate as the first time.
 */
export async function startDoubleOptIn(email: string, locale: Locale): Promise<{ ok: boolean }> {
  const admin = createContentAdminClient();
  const { data: existing, error: readError } = await admin
    .from("research_subscribers")
    .select("id, email, confirmed, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  if (readError) return { ok: false };

  const row = existing as SubscriberRow | null;
  if (row && row.confirmed && !row.unsubscribed_at) return { ok: true };

  let id = row?.id;
  if (!id) {
    const { data, error } = await admin
      .from("research_subscribers")
      .insert({ email, confirmed: false, locale })
      .select("id")
      .single();
    if (error || !data) return { ok: false };
    id = (data as { id: string }).id;
  }

  const mail = renderConfirmEmail(confirmUrl(id));
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  return { ok: sent.ok || sent.skipped === true };
}

/** The confirm link. Idempotent: a second click on a valid link is still a success. */
export async function confirmSubscription(token: string): Promise<{ ok: boolean }> {
  const id = verifyConfirmToken(token);
  if (!id) return { ok: false };
  const { error } = await createContentAdminClient()
    .from("research_subscribers")
    .update({ confirmed: true, confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq("id", id);
  return { ok: !error };
}

/**
 * The unsubscribe link and the RFC 8058 one-click POST. The row is KEPT
 * (unsubscribed_at set) rather than deleted, so a later send cannot re-mail
 * the address from a stale export; erasure on request is a separate delete.
 */
export async function unsubscribe(token: string): Promise<{ ok: boolean }> {
  const id = verifyUnsubscribeToken(token);
  if (!id) return { ok: false };
  const { error } = await createContentAdminClient()
    .from("research_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", id)
    .is("unsubscribed_at", null);
  return { ok: !error };
}
