// Billing term rules shared by the server (charge computation) and the client
// (price display), so the sticker price and the amount actually charged can never
// diverge. Pure constants/helpers — no "server-only", safe to import anywhere.

/** Annual commitment discount: an annual term is 15% cheaper than paying monthly. */
export const ANNUAL_DISCOUNT = 0.15;

/**
 * B2B contract floor: a school contract is for at least this many students,
 * regardless of real headcount. The minimum deal size that's worth serving.
 */
export const MIN_B2B_SEATS = 100;

/** Round to 2 decimals (money). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A term of 12+ months counts as annual and earns the discount. */
export function isAnnualTerm(months: number): boolean {
  return months >= 12;
}

/** Price multiplier for a term: annual → (1 - discount), otherwise full price. */
export function termFactor(months: number): number {
  return isAnnualTerm(months) ? 1 - ANNUAL_DISCOUNT : 1;
}

/**
 * The effective PER-MONTH rate when billed annually (for display): the monthly
 * rate less the annual discount. E.g. $20/mo → $17/mo billed annually.
 */
export function annualMonthlyRate(monthlyRate: number): number {
  return round2(monthlyRate * (1 - ANNUAL_DISCOUNT));
}

/**
 * Total charge for a term. `base` is the undiscounted amount (monthly rate ×
 * months, already × seats for per-seat plans). Applies the annual discount when
 * the term is annual. Rounded to 2 decimals.
 */
export function termTotal(base: number, months: number): number {
  return round2(base * termFactor(months));
}
