import "server-only";

/**
 * Google Classroom OAuth + API helpers (server-only). Requires a Google Cloud
 * OAuth client — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and register the
 * redirect URI `<origin>/api/school/lms/google/callback`. See docs/lms-google-setup.md.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const COURSES_URL = "https://classroom.googleapis.com/v1/courses";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
].join(" ");

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Google Classroom is not configured (GOOGLE_CLIENT_ID/SECRET).");
  return { id, secret };
}

/** The consent URL to redirect the admin to. `offline` + `consent` yields a refresh token. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const { id } = creds();
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
};

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const { id, secret } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as GoogleTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { id, secret } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: id,
      client_secret: secret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as GoogleTokens;
}

export async function getUserInfo(accessToken: string): Promise<{ email?: string; hd?: string; name?: string }> {
  const res = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return {};
  return (await res.json()) as { email?: string; hd?: string; name?: string };
}

export type GoogleCourse = { id: string; name: string; section?: string; enrollmentCode?: string };

/** Active courses the authorized teacher/admin can see. */
export async function listCourses(accessToken: string): Promise<GoogleCourse[]> {
  const out: GoogleCourse[] = [];
  let pageToken: string | undefined;
  do {
    const p = new URLSearchParams({ courseStates: "ACTIVE", pageSize: "100" });
    if (pageToken) p.set("pageToken", pageToken);
    const res = await fetch(`${COURSES_URL}?${p.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google courses.list failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { courses?: GoogleCourse[]; nextPageToken?: string };
    for (const c of data.courses ?? []) out.push(c);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}
