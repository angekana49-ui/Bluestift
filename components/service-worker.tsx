"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js once the page is idle.
 *
 * The worker's job is data, not features: it caches the immutable build output
 * and the brand images so a repeat open costs almost nothing on a metered
 * plan, and it serves a real offline page instead of the browser's error.
 * Registration is deliberately deferred past `load` so it never competes with
 * the first paint on a slow device.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Dev builds serve uncacheable, constantly-changing chunks — registering
    // there just produces confusing stale-asset bugs.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Unsupported, blocked by policy, or insecure context — the app works
        // exactly as before without it.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
