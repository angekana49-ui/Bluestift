import "server-only";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  HealthResponse,
  KernelMessage,
  LoadProfileRequest,
  LoadProfileResponse,
  ReadyResponse,
  UpdateConceptStateRequest,
  UpdateConceptStateResponse,
} from "./types";

/** Kernel input limits (see kernel-handoff §3): trim before calling /analyze. */
const MAX_MESSAGES = 200;
const MAX_CONTENT_CHARS = 8000;

export function clampHistory(messages: KernelMessage[]): KernelMessage[] {
  return messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.length > MAX_CONTENT_CHARS
      ? m.content.slice(0, MAX_CONTENT_CHARS)
      : m.content,
  }));
}

/**
 * SERVER-ONLY client for the Bluestift Kernel FastAPI service.
 * Never call from the browser — the kernel is a trusted backend dependency.
 */

const KERNEL_URL = process.env.KERNEL_API_URL ?? "http://localhost:8000";
const KERNEL_SECRET = process.env.KERNEL_API_SECRET;

class KernelError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "KernelError";
  }
}

async function kernelFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("content-type", "application/json");
  // The kernel currently enforces no auth; send the secret if configured so
  // this keeps working once it does.
  if (KERNEL_SECRET) headers.set("authorization", `Bearer ${KERNEL_SECRET}`);

  const res = await fetch(`${KERNEL_URL}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
    signal: rest.signal ?? AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => undefined);
    }
    throw new KernelError(
      `Kernel ${path} failed: ${res.status}`,
      res.status,
      body,
    );
  }
  return (await res.json()) as T;
}

export const kernel = {
  health: () => kernelFetch<HealthResponse>("/health", { method: "GET" }),

  ready: () => kernelFetch<ReadyResponse>("/ready", { method: "GET" }),

  analyze: (payload: AnalyzeRequest) =>
    kernelFetch<AnalyzeResponse>("/analyze", { method: "POST", json: payload }),

  loadProfile: (payload: LoadProfileRequest) =>
    kernelFetch<LoadProfileResponse>("/load_profile", {
      method: "POST",
      json: payload,
    }),

  updateConceptState: (payload: UpdateConceptStateRequest) =>
    kernelFetch<UpdateConceptStateResponse>("/update_concept_state", {
      method: "POST",
      json: payload,
    }),
};

export { KernelError };
