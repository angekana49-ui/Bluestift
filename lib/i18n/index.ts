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

/** Values for a message's `{name}` placeholders. */
export type MessageVars = Record<string, string | number>;

/**
 * Put `vars` into a message's `{name}` placeholders. A whole sentence with holes
 * rather than fragments glued around a number, because word order is not the
 * same in every language ("Enter at least {floor} students." / "Geben Sie
 * mindestens {floor} Schüler ein."). A placeholder with no value stays as it is.
 */
export function fill(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * The profile chip's plan label, as getPlanLabel (lib/billing.ts) spells it —
 * "User — Free", "Free", "Pilot", or a plan's own name — in the reader's
 * language. A plan's name ("Plus", "Max") is a product name and stays as it is.
 */
export function planLabelText(label: string, t: (key: MessageKey) => string): string {
  if (label === "Free") return t("plan.chip.free");
  if (label === "Pilot") return t("plan.chip.pilot");
  const user = /^User — (.+)$/.exec(label);
  if (user) return `${t("plan.chip.user")} — ${user[1] === "Free" ? t("plan.chip.free") : user[1]}`;
  return label;
}

/** locale → English. Total: `en` covers every key, so this never renders blank. */
export function lookup(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  return fill(MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key, vars);
}
