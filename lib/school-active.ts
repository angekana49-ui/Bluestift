import "server-only";
import { cookies } from "next/headers";

/**
 * A user can belong to several schools (admin of one, teacher of another, …).
 * The "active" school — the one the /school app currently shows — is remembered
 * in this cookie. When absent/stale, the data layer falls back to the user's
 * first membership. Set only from Server Actions / Route Handlers.
 */
export const ACTIVE_SCHOOL_COOKIE = "bs_active_school";

/** The active-school id from the request cookie, or null. */
export async function getActiveSchoolId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(ACTIVE_SCHOOL_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Persist the active school (Server Action / Route Handler contexts only). */
export async function setActiveSchoolCookie(schoolId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_SCHOOL_COOKIE, schoolId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
