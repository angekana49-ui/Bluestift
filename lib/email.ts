import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRealEmail } from "@/lib/auth";

/**
 * Transactional email via Resend's REST API (no SDK dependency — same fetch-only
 * discipline as the payments aggregator). Every send is best-effort and NEVER
 * throws: callers fire-and-forget so a mail hiccup can't break a request. When
 * RESEND_API_KEY is unset the module is a clean no-op (`skipped`), so the app runs
 * unchanged in dev / before the key is provisioned.
 *
 * Config: RESEND_API_KEY, EMAIL_FROM (e.g. "RAYA <no-reply@yourdomain>").
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export type SendResult = { ok: boolean; skipped?: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  // Guard against sending to the synthetic recovery address of email-less accounts.
  if (!hasRealEmail(opts.to)) return { ok: false, skipped: true };
  const from = process.env.EMAIL_FROM ?? "RAYA <no-reply@bluestift.local>";
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/**
 * A minimal branded HTML shell so every transactional email looks consistent.
 * Pure string-building (no deps) — kept simple and email-client-safe (inline
 * styles, table-free, no external assets). `cta` is optional.
 */
export function renderEmail(opts: {
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
}): { html: string; text: string } {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = opts.lines
    .map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${esc(l)}</p>`)
    .join("");
  const button = opts.cta
    ? `<p style="margin:22px 0 0;"><a href="${opts.cta.url}" style="display:inline-block;background:#2f7fe0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">${esc(opts.cta.label)}</a></p>`
    : "";
  const html = `<div style="max-width:520px;margin:0 auto;padding:28px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="font-size:20px;font-weight:800;color:#0b1220;margin-bottom:18px;">RAYA</div>
  <h1 style="font-size:18px;font-weight:700;color:#0b1220;margin:0 0 16px;">${esc(opts.heading)}</h1>
  ${paras}${button}
  <p style="margin:28px 0 0;font-size:11.5px;color:#94a3b8;">You're receiving this because you have a RAYA account.</p>
</div>`;
  const text = [opts.heading, "", ...opts.lines, opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : ""].join("\n");
  return { html, text };
}

/** Resolve a user's real (deliverable) email, or null for email-less accounts. */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    const email = data?.user?.email ?? null;
    return hasRealEmail(email) ? email : null;
  } catch {
    return null;
  }
}

/** The app's public base URL for links inside emails. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://app.bluestift.local";
}
