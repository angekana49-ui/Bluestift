import { NextResponse } from "next/server";
import { kernel, KernelError } from "@/lib/kernel/client";

/**
 * Connectivity probe: liveness (GET /health) + deep readiness (GET /ready,
 * which 503s with a body when the Kernel's DB access is degraded). Always
 * returns 200 with an `ok` flag so the client can read it easily.
 */
export async function GET() {
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
  const ok = !healthError && !readyError && readyStatus !== "degraded";

  // This endpoint is intentionally public for uptime probes. Do not expose the
  // internal Kernel URL, dependency payloads, or transport errors to anyone who
  // can reach it; those belong in server-side observability only.
  return NextResponse.json({ ok });
}

function describe(e: unknown): string {
  if (e instanceof KernelError) return `HTTP ${e.status}`;
  if (e instanceof Error) return e.message;
  return "unreachable";
}
