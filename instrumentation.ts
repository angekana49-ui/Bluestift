import type { Instrumentation } from "next";
import { redact, reportError } from "@/lib/observability/report";

/**
 * Next.js hands every server-side error it catches to `onRequestError` —
 * Server Component renders, Route Handlers, Server Actions and the proxy
 * alike. Wiring it here means a failure anywhere on the server is reported
 * without each route having to remember to do it.
 *
 * Errors caught and handled inside our own code never reach this hook (that is
 * the point of catching them); those are reported explicitly at the catch site
 * — see `lib/billing/payments-data.ts` for the money path.
 *
 * The `register` export is deliberately absent: there is no start-up work to
 * do, and an empty one would only be a thing to maintain.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportError("request", err, {
    request: {
      method: request.method,
      // The route PATTERN, not the path that was requested. `/s/[token]` says
      // everything useful for debugging; `/s/9tK…` is a live capability that
      // must not end up in a log drain. The query string is dropped for the
      // same reason (`?code=` on the auth callback is a one-time credential).
      route: context.routePath || redact(request.path.split("?")[0] ?? ""),
      type: context.routeType,
    },
  });
};
