/**
 * Economic-zone pricing regions (pure reference data — no server-only, safe to
 * import anywhere). Phase 1 covers the CFA franc zones only; everything else is
 * `west` (base USD price). Both franc zones are pegged to the euro, so their
 * prices are explicit local amounts, never an FX conversion.
 *
 * Zone detection is a DOUBLE LAYER — the declared country (a school's country_code)
 * AND the request IP must both point to the same CFA zone for the cheaper regional
 * price to apply. A mismatch (spoofed declaration, or a CFA IP with a non-CFA
 * declaration) falls back to `west`/USD. That's the deliberate honesty gate: you
 * only get local pricing where both signals agree you belong.
 */

export type Zone = "west" | "cemac" | "uemoa";

/** ISO-3166 alpha-2 → zone. Only CFA members are listed; all else falls to `west`. */
const COUNTRY_ZONE: Record<string, Zone> = {
  // CEMAC (Central Africa — XAF)
  CM: "cemac", // Cameroon
  GA: "cemac", // Gabon
  CG: "cemac", // Congo-Brazzaville
  TD: "cemac", // Chad
  CF: "cemac", // Central African Republic
  GQ: "cemac", // Equatorial Guinea
  // UEMOA (West Africa — XOF)
  SN: "uemoa", // Senegal
  CI: "uemoa", // Côte d'Ivoire
  ML: "uemoa", // Mali
  BF: "uemoa", // Burkina Faso
  BJ: "uemoa", // Benin
  TG: "uemoa", // Togo
  NE: "uemoa", // Niger
  GW: "uemoa", // Guinea-Bissau
};

export const ZONE_CURRENCY: Record<Zone, string> = { west: "USD", cemac: "XAF", uemoa: "XOF" };

/** Zone for a country code, or `west` when unknown / not a CFA member. */
export function zoneFromCountry(code: string | null | undefined): Zone {
  if (!code) return "west";
  return COUNTRY_ZONE[code.trim().toUpperCase()] ?? "west";
}

/** True for the CFA franc zones (the ones with regional pricing). */
function isCfa(z: Zone): boolean {
  return z === "cemac" || z === "uemoa";
}

/**
 * Resolve the effective pricing zone from both signals.
 *  - Declared country and IP both a CFA zone AND equal → that zone (grant).
 *  - No IP signal (dev / header absent) → trust the declared country.
 *  - Any disagreement → `west` (base USD): the honesty gate.
 */
export function detectZone(opts: { declaredCountry?: string | null; ipCountry?: string | null }): Zone {
  const declared = zoneFromCountry(opts.declaredCountry);
  if (!isCfa(declared)) return "west"; // declared isn't CFA → no regional discount
  const ipRaw = opts.ipCountry?.trim();
  if (!ipRaw) return declared; // no IP signal → trust the declaration
  const ip = zoneFromCountry(ipRaw);
  return ip === declared ? declared : "west"; // both must agree
}

/** Read the visitor's country from the platform's geo header (Vercel / Cloudflare). */
export function ipCountryFromHeaders(h: Headers): string | null {
  return h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? null;
}

/** Format an amount in its currency. USD → `$6.99`; franc zones → `1 200 FCFA`. */
export function formatMoney(amount: number, currency: string): string {
  if (currency === "USD") return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
  // XAF / XOF are whole francs, presented as FCFA with thin grouping.
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
}
