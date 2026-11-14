import { createElement } from "react";

/**
 * "next/link" stand-in for the Remotion bundle.
 *
 * The real Link needs an App Router to navigate with; inside a video frame
 * nothing ever navigates, so this renders a plain anchor with the same href
 * and children. Next-specific props (prefetch, replace, …) are dropped.
 */
const NEXT_ONLY = new Set([
  "replace",
  "scroll",
  "shallow",
  "locale",
  "prefetch",
  "passHref",
  "legacyBehavior",
  "as",
]);

export default function Link({ href, children, ...rest }) {
  const url = typeof href === "string" ? href : href != null ? String(href) : "#";
  const props = {};
  for (const key of Object.keys(rest)) {
    if (!NEXT_ONLY.has(key)) props[key] = rest[key];
  }
  return createElement("a", { ...props, href: url }, children);
}
