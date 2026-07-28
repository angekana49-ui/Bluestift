import type { Locale } from "@/lib/locale";
import { DEFAULT_LOCALE } from "@/lib/locale";
import { en } from "./en";
import { fr } from "./fr";
import { es } from "./es";
import { de } from "./de";

/**
 * The message catalogue. `en` is canonical: it defines the key set, and every
 * other locale is a `Partial` of it so adding a new English string can never
 * break the build — an untranslated key simply renders in English, which is the
 * behaviour we want in front of a user anyway.
 *
 * Framework-neutral (no React) so a server component or a route could translate
 * too. The React ergonomics live in `components/ui/locale.tsx`.
 */

/**
 * NOTE the `Record<..., string>`: `en` is declared `as const`, so `typeof en`
 * types every value as its own literal ("Rooms", not string). Mapping the keys
 * onto plain `string` is what lets a translation differ from the English text —
 * otherwise `de` could only ever contain the English words back.
 */
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<Locale, Partial<Messages>> = { en, fr, es, de };

/** locale → English. Total: `en` covers every key, so this never renders blank. */
export function lookup(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}
