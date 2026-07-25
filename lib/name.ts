/**
 * Uppercase initials: the FIRST letter of each word, two words max.
 *   "Emma" → "E", "Emma Lila" → "EL", "Groupe Scolaire" → "GS".
 * A single name is one letter (never padded to two). Falls back to "ME".
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Same initials rule as {@link initialsOf}, for message/roster avatars — but
 *  falls back to "?" when there's no name. "Emma" → "E", "Emma Lila" → "EL". */
export function avatarInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
