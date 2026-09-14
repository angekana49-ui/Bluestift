import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildCsp, makeNonce } from "@/lib/security/csp";
import { exemptFromOriginCheck, originAllowed } from "@/lib/security/same-origin";
import { crossOriginTarget, isPermanentMove } from "@/lib/origins";
import { trailingSlashTarget } from "@/lib/trailing-slash";

/**
 * The request pipeline: everything that must happen to EVERY request, in the
 * one place that sees every request.
 *
 *   1. refuse cross-site writes,
 *   2. send a page to the origin that owns it,
 *   3. mint this request's CSP nonce,
 *   4. refresh the Supabase session,
 *   5. stamp the policy on the way out.
 *
 * Step 3 is why steps 4 and 5 are entangled. Next.js does not take a nonce as
 * configuration — it reads one out of the `Content-Security-Policy` header on
 * the INCOMING request and applies it to the script tags it emits. So the nonce
 * has to be on the request Next renders from, which is the same request the
 * Supabase cookie refresh rewrites. `updateSession` takes a header factory
 * rather than a header value for exactly that reason.
 *
 * The policy is also set on the RESPONSE, which is the copy the browser
 * enforces. The two must be the same string: the request copy decides which
 * nonce Next writes into the page, the response copy decides which nonce the
 * browser will accept, and a mismatch is a blank page.
 */
export async function proxy(request: NextRequest) {
  /**
   * Cross-site writes are refused before anything else runs — see
   * lib/security/same-origin.ts. A 403 with no body: there is nothing useful to
   * tell a page that should not have been calling us, and a descriptive error
   * would only help someone work out which endpoints are exempt.
   */
  if (
    !exemptFromOriginCheck(request.nextUrl.pathname) &&
    !originAllowed({
      method: request.method,
      origin: request.headers.get("origin"),
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    })
  ) {
    return new NextResponse(null, { status: 403 });
  }

  /**
   * `/about/` → `/about`, as Next did before `skipTrailingSlashRedirect` was
   * turned on for PostHog's sake (lib/trailing-slash.ts). 308 like Next's, so a
   * POST keeps its method and body. Built from the raw URL: a clone of
   * `nextUrl` remembers the slash and would put it straight back.
   */
  const withoutSlash = trailingSlashTarget(request.nextUrl.pathname);
  if (withoutSlash) {
    const target = new URL(request.url);
    target.pathname = withoutSlash;
    return NextResponse.redirect(target, 308);
  }

  /**
   * A page asked for on an origin that does not own it goes to the one that
   * does (lib/origins.ts). Reads only: a POST — a server action, a form — is
   * answered where it was sent rather than bounced mid-write.
   */
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const moveTo =
    request.method === "GET" || request.method === "HEAD"
      ? crossOriginTarget({ host, pathname: request.nextUrl.pathname, search: request.nextUrl.search })
      : null;
  if (moveTo) {
    /**
     * A client-side navigation cannot follow a redirect to another origin: the
     * router's fetch is refused by CORS, logs "Failed to fetch RSC payload" and
     * retries as a full page load. Answering the router with something that is
     * not a Flight payload skips the failed fetch — it goes straight to a full
     * page load of the same address, which lands on the redirect below.
     */
    if (request.headers.has("rsc")) {
      return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    return NextResponse.redirect(moveTo, isPermanentMove(host, moveTo) ? 308 : 307);
  }

  const nonce = makeNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  /**
   * Built fresh each time rather than captured once: refreshing the session
   * mutates `request.cookies`, and those cookies live in `request.headers`. A
   * snapshot taken before the refresh would carry the nonce and the STALE
   * session; this carries both, current.
   *
   * `x-nonce` is here for any Server Component that needs to hand the nonce to
   * a third-party <Script> of its own. Nothing does today — Turnstile is
   * injected by our own bundle and inherits trust through `'strict-dynamic'` —
   * but a page that adds one will need it, and the alternative is re-reading a
   * nonce out of a policy string.
   */
  const requestHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return headers;
  };

  const response = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, images, and `/ingest` —
     * the analytics relay (app/ingest/[...path]/route.ts), which needs no
     * nonce, no session refresh and no cookie writes on its responses.
     */
    "/((?!_next/static|_next/image|ingest/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
