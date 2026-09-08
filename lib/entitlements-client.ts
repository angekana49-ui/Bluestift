"use client";
import type { RayaEntitlements, RayaTier } from "@/lib/entitlements";
import { netFetch } from "@/lib/net/client-fetch";

export type ClientEntitlements = {
  tier: RayaTier;
  enforce: boolean;
  ent: RayaEntitlements;
  /** Day-scoped counters, for quotas the UI has to show a number for. */
  usage?: { messagesToday: number };
};

let cache: ClientEntitlements | null = null;
let inflight: Promise<ClientEntitlements | null> | null = null;

/**
 * Fetch (and cache for the session) the current user's Raya entitlements for
 * client-side UI gating. NEVER throws: on any failure it returns null and the
 * caller must treat that as "don't restrict" (fail-open — the server routes are
 * the real gate). Concurrent calls are deduplicated onto one request.
 */
export async function getClientEntitlements(): Promise<ClientEntitlements | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // This is the file netFetch (lib/net/client-fetch.ts) generalized from —
      // it kept its bare fetch, so a slow connection could hang the UI-gating
      // read forever instead of failing open the way its own contract promises.
      const res = await netFetch("/api/entitlements", { cache: "no-store" }, { timeoutMs: 10_000 });
      if (!res.ok) return null;
      const data = (await res.json()) as ClientEntitlements;
      cache = data;
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
