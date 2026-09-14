import "server-only";
import { NextResponse } from "next/server";
import { checkStrictUserRateLimit } from "@/lib/rate-limit";
import { apiT } from "@/lib/i18n/server";

/**
 * Per-user ceilings on every route that spends money or storage on a request:
 * a model call, a transcription, a Kernel analysis, an upload.
 *
 * The plan quotas (lib/entitlements.ts) are not this. They only BLOCK once
 * billing is live, and until then they count and let everything through — which
 * is right for a plan limit and wrong for abuse. With nothing else in the way,
 * one scripted anonymous account could generate quizzes or transcribe audio in
 * a loop, at our expense, for as long as it liked. The chat routes already had
 * their own burst and daily ceiling; this gives every other expensive route the
 * same shape, independent of plans and always on.
 *
 * The numbers are far above what a person does — a student in a heavy revision
 * evening, a teacher preparing a week of classes — and far below what a loop
 * does. Strict: if the limiter itself cannot answer, the request is refused,
 * because a database hiccup must not become an open tap on a paid API.
 */
export const EXPENSIVE_LIMITS = {
  transcribe: { perMinute: 20, perDay: 300 },
  toolGenerate: { perMinute: 10, perDay: 150 },
  toolExtract: { perMinute: 10, perDay: 150 },
  upload: { perMinute: 20, perDay: 300 },
  kernelAnalyze: { perMinute: 10, perDay: 150 },
  kernelProfile: { perMinute: 30, perDay: 1000 },
  simulation: { perMinute: 5, perDay: 60 },
  challengeCreate: { perMinute: 10, perDay: 150 },
  challengeGrade: { perMinute: 30, perDay: 400 },
  assignmentSubmit: { perMinute: 20, perDay: 300 },
  roomReport: { perMinute: 6, perDay: 80 },
  schoolPrepare: { perMinute: 10, perDay: 150 },
  schoolReport: { perMinute: 10, perDay: 150 },
  logo: { perMinute: 5, perDay: 30 },
  share: { perMinute: 10, perDay: 100 },
  /** The welcome screen's personalised greeting and chips — a model call on a GET. */
  hooks: { perMinute: 10, perDay: 150 },
  conversationTitle: { perMinute: 20, perDay: 300 },
  memorize: { perMinute: 10, perDay: 100 },
} as const;

export type ExpensiveKind = keyof typeof EXPENSIVE_LIMITS;

async function ceilings(kind: ExpensiveKind, userId: string): Promise<{ burst: boolean; day: boolean }> {
  const { perMinute, perDay } = EXPENSIVE_LIMITS[kind];
  const [burst, day] = await Promise.all([
    checkStrictUserRateLimit(`x_${kind}`, userId, perMinute, "1 minute"),
    checkStrictUserRateLimit(`x_${kind}_day`, userId, perDay, "24 hours"),
  ]);
  return { burst, day };
}

/**
 * True when this user is still under both ceilings. For routes that degrade
 * silently instead of refusing — the welcome hooks fall back to static copy.
 */
export async function withinExpensiveLimit(kind: ExpensiveKind, userId: string): Promise<boolean> {
  const { burst, day } = await ceilings(kind, userId);
  return burst && day;
}

/** A 429 when this user is over either ceiling for `kind`, otherwise null. */
export async function limitExpensive(kind: ExpensiveKind, userId: string): Promise<NextResponse | null> {
  const { burst, day } = await ceilings(kind, userId);
  if (burst && day) return null;
  return NextResponse.json(
    {
      error: await apiT(burst ? "api.tooManyRequestsPleaseTryAgain" : "api.dailyLimitReachedTryTomorrow"),
      code: "rate_limited",
    },
    { status: 429, headers: { "Retry-After": burst ? "60" : "3600" } },
  );
}
