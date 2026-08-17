/**
 * Object-key checks for the private `user-media` bucket. Pure and dependency-free
 * (no `server-only`) so the rule can be tested directly — this is the predicate
 * standing between one student's uploads and another's, and an untested one is
 * how it quietly stops holding.
 */

/**
 * True when `path` is a storage key inside `userId`'s own folder.
 *
 * A bare `path.startsWith(userId + "/")` is NOT enough: "<uid>/../<other>/file"
 * satisfies the prefix while pointing outside the folder. We reject rather than
 * normalise, because normalising means betting that our rules match the storage
 * backend's — and that bet is exactly where this class of bug lives. Legitimate
 * keys never contain "..", a backslash, a NUL or an empty segment.
 */
export function isOwnedStoragePath(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  if (!path.startsWith(`${userId}/`)) return false;
  if (path.includes("\\") || path.includes("\0")) return false;

  const segments = path.split("/");
  // segments[0] is the owner folder; every later segment must be a real name.
  return segments.slice(1).every((s) => s !== "" && s !== "." && s !== "..");
}
