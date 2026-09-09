import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_ROUTES } from "@/lib/seo";
import { getPublishedPosts } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
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
