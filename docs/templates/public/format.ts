/** Shared formatting helpers for the public site (server + client safe). */

export function formatMonth(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function readTime(content: string | null): string {
  const words = content ? content.trim().split(/\s+/).length : 0;
  return `${Math.max(2, Math.round(words / 200))} min`;
}
