"use client";

import { useSyncExternalStore } from "react";
import { siteHomeFrom } from "@/lib/origins";

const subscribe = () => () => {};

/**
 * The landing page's address from wherever this page is served
 * (lib/origins.ts `siteHomeFrom`). The server renders `/`, and the browser
 * swaps in the site's absolute address on a product origin once it hydrates —
 * no mismatch, since the host is only known on the client.
 */
export function useSiteHomeHref(): string {
  return useSyncExternalStore(
    subscribe,
    () => siteHomeFrom(window.location.host),
    () => "/",
  );
}
