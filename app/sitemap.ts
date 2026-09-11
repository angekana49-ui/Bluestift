import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_ROUTES } from "@/lib/seo";
import { getPublishedPosts } from "@/lib/content";

/*
 * Rebuilt hourly rather than frozen at build time.
 *
 * This file reads published research posts from the database, and as a fully
 * static route it ran that query ONCE per deploy — so a post published on a
 * Tuesday stayed out of the sitemap until somebody shipped something else.
 * Hourly revalidation costs one query an hour and removes the deploy from the
 * path between publishing and being crawlable.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    // The recrawl signal, and the one thing this sitemap was missing. A
    // crawler that is never told a page changed has no reason to come back
    // and replace the copy it already has — which is how a rewritten site
    // keeps showing its predecessor's text in search results. The dates are
    // maintained by hand in lib/seo.ts; see the note there for why generating
    // them would be worse than useless.
    lastModified: new Date(`${route.lastModified}T00:00:00Z`),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Best-effort: a research-post fetch failing (DB hiccup, cold start) should
  // shrink the sitemap, not break it — the static entries above are still
  // worth serving on their own.
  let postEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPublishedPosts();
    postEntries = posts
      .filter((post) => post.slug)
      .map((post) => ({
        url: `${SITE_URL}/research/${encodeURIComponent(post.slug!)}`,
        lastModified: post.published_at ?? post.created_at,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
  } catch {
    postEntries = [];
  }

  return [...staticEntries, ...postEntries];
}
