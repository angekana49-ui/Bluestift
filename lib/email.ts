import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRealEmail } from "@/lib/auth";
import { SITE_URL } from "@/lib/seo";

/**
 * Transactional email via Resend's REST API (no SDK dependency — same fetch-only
 * discipline as the payments aggregator). Every send is best-effort and NEVER
 * throws: callers fire-and-forget so a mail hiccup can't break a request. When
 * RESEND_API_KEY is unset the module is a clean no-op (`skipped`), so the app runs
 * unchanged in dev / before the key is provisioned.
 *
 * Config: RESEND_API_KEY, EMAIL_FROM (e.g. "Raya <no-reply@yourdomain>").
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * One Resend account, one verified sending domain, but three product identities.
 * Bluestift is the parent brand; Raya (personal) and Schools (B2B) are the two
 * products. The sending code always knows which product an email belongs to (a
 * join-request mail is always Schools; a B2C receipt is always Raya), so it passes
 * the brand and we stamp it consistently — same address, product-specific display
 * name + in-email wordmark. `bluestift` is the neutral parent default for anything
 * identity-level or cross-product.
 */
export type EmailBrand = "bluestift" | "raya" | "schools";

const BRANDS: Record<EmailBrand, { fromName: string; product: string | null }> = {
  bluestift: { fromName: "Bluestift", product: null },
  raya: { fromName: "Bluestift Raya", product: "Raya" },
  schools: { fromName: "Bluestift Schools", product: "Schools" },
};

/** Build the From header for a brand: the verified ADDRESS from EMAIL_FROM (its
 *  display name, if any, is ignored) with the product-specific display name. */
export function fromHeader(brand: EmailBrand): string {
  const raw = process.env.EMAIL_FROM ?? "no-reply@bluestift.local";
  const address = raw.match(/<([^>]+)>/)?.[1] ?? raw.trim();
  return `${BRANDS[brand].fromName} <${address}>`;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export type SendResult = { ok: boolean; skipped?: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Product identity for the From header. Defaults to the parent brand. */
  brand?: EmailBrand;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  // Guard against sending to the synthetic recovery address of email-less accounts.
  if (!hasRealEmail(opts.to)) return { ok: false, skipped: true };
  const from = fromHeader(opts.brand ?? "bluestift");
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        reply_to: replyTo(),
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
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

// ---- Published Resend templates ---------------------------------------------

/**
 * The templates designed and published in the Resend dashboard, by id. Their
 * HTML lives there, not here; this module only chooses one and fills it in.
 */
const RESEND_TEMPLATES = {
  pilotStarted: "da4aa2f6-1674-4d81-8dab-765fd7bf9605",
  accountCreated: "ba08106c-4966-43a4-8eb1-22bdd7206950",
  schoolLinked: "c8f32e8d-f55d-468e-a6c1-dd03164aca5e",
} as const;

export type EmailTemplate = keyof typeof RESEND_TEMPLATES;

/**
 * Where a reply goes. Every template ends with "reply to this email", and the
 * From address is a no-reply one, so without this the replies the templates
 * ask for would be sent into nothing.
 */
export function replyTo(): string {
  return process.env.EMAIL_REPLY_TO ?? "hello@thebluestift.com";
}

/**
 * Resend pastes template variables into the HTML AS-IS. Verified on 2026-09-13
 * against the live API: a school named `<b>X</b>` arrived as markup. School
 * and teacher names are typed by users, so every value is escaped here, once,
 * before it can reach an inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Ada Lovelace" → "Ada"; an address's local part as the last resort. */
export function firstNameOf(name: string | null | undefined, email?: string | null): string {
  const fromName = (name ?? "").trim().split(/\s+/)[0];
  if (fromName) return fromName.slice(0, 40);
  const local = (email ?? "").split("@")[0]?.split(/[._+-]+/)[0] ?? "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1, 40) : "there";
}

/**
 * Send a published template.
 *
 * The From header stays the project's (fromHeader), not the template's default,
 * so every email keeps one sending identity. The SUBJECT is sent from here too,
 * in plain text: the template's subject would take the same unescaped variables
 * as the body, and an escaped one would show "&amp;" in the inbox. Values are
 * strings or numbers, as Resend requires. Never throws, like sendEmail.
 */
export async function sendTemplateEmail(opts: {
  to: string;
  template: EmailTemplate;
  subject: string;
  variables: Record<string, string | number>;
  brand?: EmailBrand;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  if (!hasRealEmail(opts.to)) return { ok: false, skipped: true };
  const variables = Object.fromEntries(
    Object.entries(opts.variables).map(([k, v]) => [k, typeof v === "number" ? v : escapeHtml(v)]),
  );
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(opts.brand ?? "bluestift"),
        to: [opts.to],
        reply_to: replyTo(),
        subject: opts.subject,
        template: { id: RESEND_TEMPLATES[opts.template], variables },
      }),
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

/** "27 October 2026" — the templates are written in English. */
function longDate(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Trigger 1 — a school was created and its pilot started. */
export function sendPilotStartedEmail(opts: {
  to: string;
  adminFirstname: string;
  schoolName: string;
  pilotDays: number;
  pilotUntil: string;
}): Promise<SendResult> {
  return sendTemplateEmail({
    to: opts.to,
    template: "pilotStarted",
    brand: "schools",
    subject: `${opts.schoolName} is live on Bluestift`,
    variables: {
      admin_firstname: opts.adminFirstname,
      school_name: opts.schoolName,
      pilot_duration_days: opts.pilotDays,
      pilot_end_date: longDate(opts.pilotUntil),
      dashboard_url: `${siteUrl("schools")}/school`,
    },
  });
}

/** Trigger 2 — a school created a teacher's account and put them on its team. */
export function sendAccountCreatedEmail(opts: {
  to: string;
  firstname: string;
  schoolName: string;
  role: string;
}): Promise<SendResult> {
  return sendTemplateEmail({
    to: opts.to,
    template: "accountCreated",
    brand: "schools",
    subject: "Your Bluestift account is ready",
    variables: {
      firstname: opts.firstname,
      school_name: opts.schoolName,
      role: opts.role,
      email: opts.to,
      login_url: `${siteUrl("schools")}/login`,
    },
  });
}

/** Trigger 3 — an existing account was linked to a school. */
export function sendSchoolLinkedEmail(opts: {
  to: string;
  firstname: string;
  schoolName: string;
  role: string;
}): Promise<SendResult> {
  return sendTemplateEmail({
    to: opts.to,
    template: "schoolLinked",
    brand: "schools",
    subject: `You are now a member of ${opts.schoolName}`,
    variables: {
      firstname: opts.firstname,
      school_name: opts.schoolName,
      role: opts.role,
      dashboard_url: `${siteUrl("schools")}/school`,
    },
  });
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
  /** Which product's wordmark to show. Defaults to the parent brand. */
  brand?: EmailBrand;
}): { html: string; text: string } {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = opts.lines
    .map((l) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${esc(l)}</p>`)
    .join("");
  const button = opts.cta
    ? `<p style="margin:22px 0 0;"><a href="${opts.cta.url}" style="display:inline-block;background:#2f7fe0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">${esc(opts.cta.label)}</a></p>`
    : "";
  // Parent wordmark "Bluestift" + an optional product tag ("Raya" / "Schools").
  const product = BRANDS[opts.brand ?? "bluestift"].product;
  const productTag = product
    ? `<span style="font-size:13px;font-weight:600;color:#2f7fe0;margin-left:8px;">${product}</span>`
    : "";
  const html = `<div style="max-width:520px;margin:0 auto;padding:28px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="margin-bottom:18px;"><span style="font-size:20px;font-weight:800;color:#0b1220;">Bluestift</span>${productTag}</div>
  <h1 style="font-size:18px;font-weight:700;color:#0b1220;margin:0 0 16px;">${esc(opts.heading)}</h1>
  ${paras}${button}
  <p style="margin:28px 0 0;font-size:11.5px;color:#94a3b8;">You're receiving this because you have a Bluestift account.</p>
</div>`;
  const text = [opts.heading, "", ...opts.lines, opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : ""].join("\n");
  return { html, text };
}

/**
 * Compose + send a product-branded transactional email in one call. The `brand`
 * flows to both the wordmark (renderEmail) and the From header (sendEmail) so they
 * can never drift. This is the preferred entry point for our own mail.
 */
export async function sendBrandedEmail(opts: {
  brand: EmailBrand;
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
}): Promise<SendResult> {
  const { html, text } = renderEmail({ brand: opts.brand, heading: opts.heading, lines: opts.lines, cta: opts.cta });
  return sendEmail({ to: opts.to, subject: opts.subject, html, text, brand: opts.brand });
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

/**
 * The public base URL for a link, per SURFACE.
 *
 * A single value was right while everything lived on one origin. It stops being
 * right the moment the products split across thebluestift.com / raya. / schools.
 * (docs/domains.md): a school email has to land on the school origin, a share
 * link on the public site. The surface is named at the call site NOW, while
 * every caller is still in view, so the split later is a matter of setting two
 * env vars rather than of finding every link again.
 *
 * `EmailBrand` is reused rather than a new union because "which product is
 * this?" and "which origin does it live on?" have the same answer, and the
 * senders already answer the first one.
 *
 * Both product vars fall back to the site URL. Unset — which is the case today,
 * on one origin — every caller gets exactly the string it got before.
 *
 * The last fallback is `SITE_URL` (lib/seo.ts), which is production, NOT the
 * `https://app.bluestift.local` placeholder this used to return. That
 * placeholder never resolves, so an unset NEXT_PUBLIC_SITE_URL sent every
 * invite, join request and receipt out with a dead link — and nothing failed:
 * the send succeeded, the mail looked right, only the link was gone. Worse,
 * NEXT_PUBLIC_* is inlined at BUILD time, so "I set it in Vercel" does not fix
 * a deployment already built without it.
 *
 * lib/seo.ts already made this exact call for metadata, and its reasoning
 * transfers with more force here: a link to the real apex at least reaches a
 * working site, while a link to a domain that does not exist reaches nothing.
 * One module answering "what is our base URL?" for the whole app, not two.
 */
export function siteUrl(surface: EmailBrand): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const raw =
    surface === "raya"
      ? (process.env.NEXT_PUBLIC_RAYA_URL ?? site)
      : surface === "schools"
        ? (process.env.NEXT_PUBLIC_SCHOOLS_URL ?? site)
        : site;
  return raw?.replace(/\/$/, "") ?? SITE_URL;
}
