import { NextResponse } from "next/server";
import { kernel, KernelError } from "@/lib/kernel/client";

/**
 * Connectivity probe: liveness (GET /health) + deep readiness (GET /ready,
 * which 503s with a body when the Kernel's DB access is degraded). Always
 * returns 200 with an `ok` flag so the client can read it easily.
 */
export async function GET() {
  const url = process.env.KERNEL_API_URL ?? "http://localhost:8000";

  let health: unknown = null;
  let healthError: string | null = null;
  try {
    health = await kernel.health();
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

  return NextResponse.json({ ok, url, health, healthError, ready, readyError });
}

function describe(e: unknown): string {
  if (e instanceof KernelError) return `HTTP ${e.status}`;
  if (e instanceof Error) return e.message;
  return "unreachable";
}
