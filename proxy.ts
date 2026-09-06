import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildCsp, makeNonce } from "@/lib/security/csp";
import { exemptFromOriginCheck, originAllowed } from "@/lib/security/same-origin";

/**
 * The request pipeline: everything that must happen to EVERY request, in the
 * one place that sees every request.
 *
 *   1. refuse cross-site writes,
 *   2. mint this request's CSP nonce,
 *   3. refresh the Supabase session,
 *   4. stamp the policy on the way out.
 *
 * Step 2 is why steps 3 and 4 are entangled. Next.js does not take a nonce as
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
     * Match all request paths except static assets and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
