/**
 * Research publishing — pure, client-safe helpers shared by the ops review UI
 * and the approve/reject API routes.
 *
 * The security boundary lives here, not in the UI: only whitelisted file
 * extensions ever leave the `contributions` quarantine for the public
 * `research-media` bucket. Anything executable or active (html, svg, js, …)
 * is rejected, because a public bucket serves bytes as-is and an HTML/SVG
 * upload would run scripts under our own origin.
 */

export const POST_TYPES = ["paper", "experiment", "article", "update"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const QUARANTINE_BUCKET = "contributions";
export const PUBLISH_BUCKET = "research-media";
export const MAX_PUBLISH_BYTES = 15 * 1024 * 1024; // same ceiling as the contribute form

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 120 && SLUG_RE.test(slug);
}

/** "My Cool Paper!" -> "my-cool-paper" (may still need uniqueness, checked server-side). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const CATEGORY_TO_TYPE: Record<string, PostType> = {
  paper: "paper",
  experiment: "experiment",
  article: "article",
  update: "update",
};

/**
 * Contribution category (free text from the public form, usually one of
 * paper|experiment|article|other) -> suggested post type. Unknown values fall
 * back to "article"; the owner confirms the type at approve time.
 */
export function mapCategoryToType(category: string | null): PostType {
  return CATEGORY_TO_TYPE[(category ?? "").trim().toLowerCase()] ?? "article";
}

export function isPostType(value: string): value is PostType {
  return (POST_TYPES as readonly string[]).includes(value);
}

type PublishedFile =
  | { kind: "media"; mediaType: "pdf" | "image" | "video"; contentType: string }
  | { kind: "attachment"; contentType: string };

const MEDIA_EXT: Record<string, PublishedFile> = {
  pdf: { kind: "media", mediaType: "pdf", contentType: "application/pdf" },
  png: { kind: "media", mediaType: "image", contentType: "image/png" },
  jpg: { kind: "media", mediaType: "image", contentType: "image/jpeg" },
  jpeg: { kind: "media", mediaType: "image", contentType: "image/jpeg" },
  gif: { kind: "media", mediaType: "image", contentType: "image/gif" },
  webp: { kind: "media", mediaType: "image", contentType: "image/webp" },
  mp4: { kind: "media", mediaType: "video", contentType: "video/mp4" },
  webm: { kind: "media", mediaType: "video", contentType: "video/webm" },
  mov: { kind: "media", mediaType: "video", contentType: "video/quicktime" },
};

const ATTACHMENT_EXT: Record<string, string> = {
  zip: "application/zip",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
};

/**
 * How a quarantined file may be published, or null when it must stay in
 * quarantine. Extension allowlist (lowercased, no dot). Attachments (datasets,
 * slides…) have no research_media type, so they ship as a download link
 * appended to the post content instead of a media row.
 */
export function classifyPublishFile(storagePath: string): (PublishedFile & { ext: string }) | null {
  const base = storagePath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(ext)) return null;
  const media = MEDIA_EXT[ext];
  if (media) return { ...media, ext };
  const contentType = ATTACHMENT_EXT[ext];
  if (contentType) return { kind: "attachment", contentType, ext };
  return null;
}

/** Public object name: deterministic from the validated slug + whitelisted ext. */
export function publishObjectName(slug: string, ext: string): string {
  return `${slug}.${ext}`;
}
