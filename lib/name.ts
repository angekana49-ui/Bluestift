/** Two-letter initials from a display name (falls back to "ME"). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * One initial per word, two words max, for a message-bubble avatar:
 * "James" → "J", "Angelo Ryan" → "AR". Distinct from initialsOf (which pads a
 * single name to two letters) because a first-name-only user reads better as
 * one letter on a small circle.
 */
export function avatarInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
