import "server-only";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  HealthResponse,
  KernelMessage,
  LoadAlertsRequest,
  LoadAlertsResponse,
  LoadProfileRequest,
  LoadProfileResponse,
  ReadyResponse,
  ResolveAlertRequest,
  ResolveAlertResponse,
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

/**
 * Send the student's own Supabase token instead of the service secret on calls
 * that are about one known student.
 *
 * The service secret can read and write ANY student's cognitive profile. A
 * student's token can only reach their own, so the skeleton key stops travelling
 * on ordinary user-initiated requests.
 *
 * Off by default, and deliberately: the kernel only accepts user tokens once it
 * has SUPABASE_JWT_SECRET set. Turning this on first would 401 every scoped
 * call. Set it on the app AFTER the kernel has the secret.
 */
const USER_SCOPED_AUTH = process.env.KERNEL_USER_SCOPED_AUTH === "1";

/** Per-call auth: the token of the student the call is about. */
export type KernelCallOptions = { accessToken?: string | null };

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
  init?: RequestInit & { json?: unknown; accessToken?: string | null; timeoutMs?: number },
): Promise<T> {
  const { json, accessToken, timeoutMs, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("content-type", "application/json");
  // Prefer the student's own token when we have one: it reaches only their
  // profile. Fall back to the service secret, which the kernel treats as a
  // trusted backend acting for anyone — needed for background work that has no
  // live session to borrow a token from.
  if (USER_SCOPED_AUTH && accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  } else if (KERNEL_SECRET) {
    headers.set("authorization", `Bearer ${KERNEL_SECRET}`);
  }

  const res = await fetch(`${KERNEL_URL}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs ?? 6000),
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

  analyze: (payload: AnalyzeRequest, opts?: KernelCallOptions) =>
    kernelFetch<AnalyzeResponse>("/analyze", {
      method: "POST",
      json: payload,
      accessToken: opts?.accessToken,
    }),

  loadProfile: (payload: LoadProfileRequest, opts?: KernelCallOptions) =>
    kernelFetch<LoadProfileResponse>("/load_profile", {
      method: "POST",
      json: payload,
      accessToken: opts?.accessToken,
    }),

  updateConceptState: (payload: UpdateConceptStateRequest, opts?: KernelCallOptions) =>
    kernelFetch<UpdateConceptStateResponse>("/update_concept_state", {
      method: "POST",
      json: payload,
      accessToken: opts?.accessToken,
    }),

  /**
   * NOTE: the school dashboards do NOT use this — they read the kernel schema
   * directly via lib/kernel/risk.ts, because we share that database and an HTTP
   * call here would wake a sleeping (billed) container on every page view. This
   * method is for callers that need the kernel's own view: a client that does
   * not share the DB, or a one-off check.
   *
   * Staff scopes (`user_ids`, `school_id`) deliberately take no accessToken: the
   * kernel refuses them on a user token, because it has no way to know who
   * teaches where. Authorize the caller first (getAdminMembership +
   * getProfClasses), then this call carries the service secret.
   */
  loadAlerts: (payload: LoadAlertsRequest, opts?: KernelCallOptions) =>
    kernelFetch<LoadAlertsResponse>("/load_alerts", {
      method: "POST",
      json: payload,
      accessToken: opts?.accessToken,
    }),

  /**
   * Writes go through the kernel, not straight to its tables: acknowledging an
   * alert is the kernel's own semantics (it clears resolved_by/resolved_at
   * together, and refuses to touch non-alert log rows).
   *
   * The long timeout is deliberate. Reads avoid the kernel precisely so a
   * sleeping container is never on the critical path, but a write has to wake
   * it — and a Railway cold start on a Python service can outlast the 6s
   * default. This is a teacher pressing a button, not a page load, so waiting
   * is fine; timing out on a cold start and reporting failure is not.
   */
  resolveAlert: (payload: ResolveAlertRequest) =>
    kernelFetch<ResolveAlertResponse>("/resolve_alert", {
      method: "POST",
      json: payload,
      timeoutMs: 25_000,
    }),
};

export { KernelError };
