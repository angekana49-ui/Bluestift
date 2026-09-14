import { NextResponse } from "next/server";
import { kernel, KernelError } from "@/lib/kernel/client";

/**
 * Connectivity probe: liveness (GET /health) + deep readiness (GET /ready,
 * which 503s with a body when the Kernel's DB access is degraded). Always
 * returns 200 with an `ok` flag so the client can read it easily.
 */
/**
 * The answer is reused for a few seconds per instance. This route is public and
 * each call costs two requests to the Kernel, so without a cache anyone could
 * turn it into a way to hammer the Kernel from our own servers. An uptime probe
 * polls every minute or so and loses nothing to a 15-second-old answer.
 */
const CACHE_MS = 15_000;
let cached: { ok: boolean; at: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ ok: cached.ok });
  }
  const ok = await probe();
  cached = { ok, at: Date.now() };
  return NextResponse.json({ ok });
}

async function probe(): Promise<boolean> {
  let healthError: string | null = null;
  try {
    await kernel.health();
  } catch (e) {
    healthError = describe(e);
  }

  let ready: unknown = null;
  let readyError: string | null = null;
  try {
    ready = await kernel.ready();
  } catch (e) {
    // A 503 from /ready still carries a { read_ok, write_ok, status } body.
    if (e instanceof KernelError && e.body && typeof e.body === "object") {
      ready = e.body;
    } else {
      readyError = describe(e);
    }
  }

  const readyStatus = (ready as { status?: string } | null)?.status;
  // This endpoint is intentionally public for uptime probes. Do not expose the
  // internal Kernel URL, dependency payloads, or transport errors to anyone who
  // can reach it; those belong in server-side observability only.
  return !healthError && !readyError && readyStatus !== "degraded";
}

function describe(e: unknown): string {
  if (e instanceof KernelError) return `HTTP ${e.status}`;
  if (e instanceof Error) return e.message;
  return "unreachable";
}
