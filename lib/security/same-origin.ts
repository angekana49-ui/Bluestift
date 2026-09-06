/**
 * Is this state-changing request coming from our own pages?
 *
 * The session cookie is `SameSite=Lax`, which is what stops another site from
 * making a browser POST to us with the user's session attached. That is the
 * real defence and it stays the real defence. This is the second one, and it
 * exists because Lax has two edges that are easy to walk off:
 *
 *  - it is SAME-SITE, not same-origin. The moment `NEXT_PUBLIC_COOKIE_DOMAIN`
 *    is set for the product split (docs/domains.md), every subdomain of the
 *    apex is same-site — so one forgotten CNAME, one static-site host pointed
 *    at a spare subdomain, and a page nobody at Bluestift wrote can POST to
 *    every endpoint here with a signed-in child's cookies;
 *  - it is a browser default, not a server rule. Nothing in this repo would
 *    notice if a future auth change set `SameSite=None`, and nothing would
 *    fail visibly if it did.
 *
 * The rule is deliberately narrow, so it can be trusted not to break anything:
 *
 *  - only unsafe methods are checked. A GET is not how you change state here.
 *  - a MISSING `Origin` is allowed. Browsers always send it on POST; the
 *    callers that do not are the payment aggregator's webhook, the scheduled
 *    crons, and anything reaching us server-to-server. Those authenticate with
 *    their own secrets and must not be blocked by a header they never send.
 *  - a PRESENT `Origin` must match the host the request was made to, or one of
 *    the product origins this deployment is configured with. Preview
 *    deployments, localhost and custom domains all pass without configuration
 *    because the comparison is against the request's own Host.
 */

/** Origins this deployment considers its own, beyond the request's own host. */
function configuredOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_RAYA_URL,
    process.env.NEXT_PUBLIC_SCHOOLS_URL,
  ]
    .filter((v): v is string => !!v)
    .map((v) => {
      try {
        return new URL(v).host;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * True when the request may proceed. `host` is the Host the request was made
 * to — on Vercel, `x-forwarded-host` when present, else `host`.
 */
export function originAllowed(opts: {
  method: string;
  origin: string | null;
  host: string | null;
}): boolean {
  if (!UNSAFE.has(opts.method.toUpperCase())) return true;
  if (!opts.origin) return true; // no browser sent this

  let originHost: string;
  try {
    originHost = new URL(opts.origin).host;
  } catch {
    // An `Origin` we cannot parse is not one of ours. "null" arrives from a
    // sandboxed iframe or a redirected cross-origin post — both are exactly
    // the shape this check is for.
    return false;
  }

  if (opts.host && originHost === opts.host) return true;
  return configuredOrigins().includes(originHost);
}

/**
 * Paths exempt from the check because their caller is never a browser and
 * their authentication is their own. Kept as a prefix list, and kept short —
 * every entry here is an endpoint that must carry its own proof of who called
 * it (an HMAC for the aggregator, a bearer secret for the crons).
 */
const EXEMPT_PREFIXES = ["/api/billing/webhook/", "/api/cron/"];

export function exemptFromOriginCheck(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}
