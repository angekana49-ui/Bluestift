import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { kernel, KernelError } from "@/lib/kernel/client";
import { reportError } from "@/lib/observability/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is the Kernel answering? (Vercel Cron — see vercel.json.)
 *
 * This exists because of a specific failure. The Kernel's deployment went down
 * on 2026-08-16 and nothing said so for seventeen days. `/api/kernel/health`
 * already existed and returned exactly the boolean needed — nothing called it.
 * The whole cognitive layer was off, every chat turn ran with an empty learner
 * profile, and the app carried on looking completely normal, because every
 * layer degrades quietly on purpose so a turn never blocks on this dependency.
 *
 * The per-turn reporter added alongside this catches the same outage from the
 * other direction, but only while somebody is using the product, and only as a
 * `warning` because one failed call really is expected sometimes. This is the
 * deliberate, scheduled, single probe: if THIS fails, the dependency is down,
 * and it says so at `error`.
 *
 * WAKING A SLEEPING CONTAINER is the cost, and it is accepted here where it is
 * refused everywhere else. The Kernel sleeps when idle, and the rest of the app
 * goes out of its way not to wake it (see shouldRefresh in profile-cache) — but
 * a monitor that only reports when someone else happened to wake the service is
 * not a monitor. Once a day is the price.
 *
 * The timeout is generous for the same reason: a Python cold start outlasts the
 * 6s default, and reporting an outage that is really a cold start would train
 * whoever reads these to ignore them.
 */
const PROBE_TIMEOUT_MS = 30_000;

function describe(e: unknown): string {
  if (e instanceof KernelError) return `HTTP ${e.status}`;
  if (e instanceof Error) return e.message;
  return "unreachable";
}

export async function GET(request: Request) {
  if (!authorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Liveness and readiness are different questions: /health says the process is
  // up, /ready says it can reach its database. A Kernel that answers but cannot
  // read is the more confusing outage of the two, because it looks alive.
  let liveness: string | null = null;
  try {
    await kernel.health({ timeoutMs: PROBE_TIMEOUT_MS });
  } catch (e) {
    liveness = describe(e);
  }

  let readiness: string | null = null;
  let readyStatus: string | undefined;
  try {
    const ready = await kernel.ready({ timeoutMs: PROBE_TIMEOUT_MS });
    readyStatus = (ready as { status?: string })?.status;
  } catch (e) {
    // A 503 from /ready still carries a { read_ok, write_ok, status } body, so
    // "degraded" arrives as a thrown KernelError rather than a clean response.
    if (e instanceof KernelError && e.body && typeof e.body === "object") {
      readyStatus = (e.body as { status?: string }).status ?? "degraded";
    } else {
      readiness = describe(e);
    }
  }

  const ok = !liveness && !readiness && readyStatus !== "degraded";

  if (!ok) {
    // `error`, not `warning`. The per-turn path uses warning because a single
    // failed call is noise; a scheduled probe failing is the signal.
    await reportError(
      "kernel.health.cron",
      new Error(
        `Kernel probe failed — liveness: ${liveness ?? "ok"}, readiness: ${
          readiness ?? readyStatus ?? "ok"
        }`,
      ),
      { severity: "error", tags: { dependency: "kernel" } },
    );
  }

  // The body is for the cron log, which only the operator reads — unlike the
  // public /api/kernel/health, this one may name what failed.
  return NextResponse.json({
    ok,
    liveness: liveness ?? "ok",
    readiness: readiness ?? readyStatus ?? "ok",
    checkedAt: new Date().toISOString(),
  });
}

