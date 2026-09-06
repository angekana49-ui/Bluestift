import "server-only";
import { NextResponse } from "next/server";
import { getAgeStatus } from "./gate";

/**
 * The age gate, for API routes.
 *
 * Every app PAGE already bounces an ungated account to /onboarding (see
 * guard.ts). That stops a browser, and only a browser: the routes those pages
 * call — chat, voice, uploads, the Kernel — did not ask the question, so a
 * client that skipped the page could still send content to the model. The
 * public pages say a child who signs up alone "is stopped at the age question",
 * and a promise the API does not keep is not one the product keeps.
 *
 * Cheap on purpose: one admin read of four columns, and only on the routes
 * that carry user content outward (to an LLM, to the Kernel, into storage).
 * Read-only routes and account routes are left alone — an ungated account
 * must still be able to export and delete itself, and to answer the question.
 */

/** A 403 the route should return as-is when the account may not use the product yet. */
export async function ageGateResponse(userId: string): Promise<NextResponse | null> {
  const { decision } = await getAgeStatus(userId);
  if (decision.allowed) return null;
  return NextResponse.json(
    {
      error: "Tell us the year you were born before using Raya.",
      reason: decision.reason,
      redirect: "/onboarding",
    },
    { status: 403 },
  );
}

/** Same rule for server actions, which cannot return a response object. */
export async function assertAgeCleared(userId: string): Promise<void> {
  const { decision } = await getAgeStatus(userId);
  if (!decision.allowed) throw new Error("Finish onboarding before using this.");
}
