import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_KEY, normalizeLocale, type Locale } from "@/lib/locale";
import { lookup, type MessageKey, type MessageVars } from "@/lib/i18n";

/**
 * Server-side counterpart to `useTranslate()`. A handful of pages (checkout,
 * for one) render their copy entirely server-side and never mount the client
 * locale provider, so there is no `useTranslate()` to call.
 *
 * Reads the same `bluestift-locale` cookie the client writes on every locale
 * change (see lib/shared-pref.ts — it's written to a cookie precisely so a
 * server request can see it, not just localStorage). Unlike the client hook,
 * this has no "start English, correct after mount" step: a server render either
 * sees the cookie or it doesn't, and there is no hydration mismatch to avoid —
 * the HTML that goes out is final.
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return normalizeLocale(store.get(LOCALE_KEY)?.value);
  } catch {
    // Outside a request (a cron, a script, a unit test): no reader, no cookie.
    return DEFAULT_LOCALE;
  }
}

export type ServerTranslate = (key: MessageKey, vars?: MessageVars) => string;

export async function getServerTranslate(): Promise<ServerTranslate> {
  const locale = await getServerLocale();
  return (key, vars) => lookup(locale, key, vars);
}

/**
 * One message, in the language the person is reading the app in — for the
 * `{ error }` a route or server action hands back to the browser, which shows it
 * as-is. `api.*` keys live in the same catalogue as the interface.
 */
export async function apiT(key: MessageKey, vars?: MessageVars): Promise<string> {
  return lookup(await getServerLocale(), key, vars);
}
