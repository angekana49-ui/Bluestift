"use client";

// Client-side plumbing for the "you've hit a plan limit" upgrade modal. The
// entitlement gates return 403 {code:"feature_locked"} / 429 {code:"quota_reached"}
// with a ready-to-show message. A single fetch interceptor watches for those
// responses app-wide and opens the modal — so no call site has to special-case a
// gate. Room server actions can't return a Response, so they dispatch directly
// via `dispatchUpgrade`.

export const UPGRADE_EVENT = "bluestift:upgrade-needed";

export type UpgradeDetail = {
  code: "feature_locked" | "quota_reached";
  /** User-facing message from the API (already names the plan to upgrade to). */
  message: string;
  feature?: string;
  metric?: string;
  used?: number;
  limit?: number | null;
};

export function dispatchUpgrade(detail: UpgradeDetail): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail }));
  }
}

let installed = false;

/**
 * Patch window.fetch once so any entitlement 403/429 opens the modal. The
 * original response is returned untouched (we only read a clone), and we only
 * look at 403/429 JSON, so streaming and normal responses are unaffected. A plain
 * rate-limit 429 (no `code`) is ignored — it's not an upgrade situation.
 */
export function installUpgradeInterceptor(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await original(...args);
    try {
      if (
        (res.status === 403 || res.status === 429) &&
        res.headers.get("content-type")?.includes("application/json")
      ) {
        const data = await res.clone().json();
        if (data && (data.code === "feature_locked" || data.code === "quota_reached")) {
          dispatchUpgrade({
            code: data.code,
            message: data.error ?? "This requires a higher plan.",
            feature: data.feature,
            metric: data.metric,
            used: data.used,
            limit: data.limit,
          });
        }
      }
    } catch {
      // never let the interceptor break a request
    }
    return res;
  };
}
