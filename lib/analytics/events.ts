/**
 * Every named product event, in one list.
 *
 * A PostHog funnel is only as good as the spelling of its steps: an event
 * renamed in one route and not another splits one step into two, and nothing
 * fails. `captureServer` takes only these names, so a typo is a type error.
 *
 * All of them are server-side, and all of them pass the same two gates in
 * lib/analytics/server.ts — the consent cookie and the age band — so a minor
 * never produces one. Properties describe WHAT happened, never what anyone
 * wrote: no message text, no names, no titles.
 *
 * The activation funnel, in order:
 *   signed_up → onboarding_completed → raya_message_sent → account_verified
 * The Schools funnel:
 *   signed_up → onboarding_completed (track: schools) → school_created | school_team_joined
 *   → assignment_created → checkout_started
 */
export const PRODUCT_EVENTS = [
  // Accounts
  "signed_up",
  "onboarding_completed",
  "account_verified",
  "recovery_key_regenerated",
  // Raya
  "raya_message_sent",
  "artefact_generated",
  "document_uploaded",
  "doc_shared",
  "room_created",
  "room_visibility_changed",
  "class_joined",
  // Schools
  "school_created",
  "school_team_joined",
  "assignment_created",
  // Money
  "checkout_started",
  "entitlement_gate",
] as const;

export type ProductEvent = (typeof PRODUCT_EVENTS)[number];
