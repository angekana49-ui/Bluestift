import "server-only";
import { cookies } from "next/headers";
import { LOCALE_KEY, normalizeLocale } from "@/lib/locale";
import { lookup, type MessageKey } from "@/lib/i18n";

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
export async function getServerTranslate(): Promise<(key: MessageKey) => string> {
  const store = await cookies();
  const locale = normalizeLocale(store.get(LOCALE_KEY)?.value);
  return (key: MessageKey) => lookup(locale, key);
}
