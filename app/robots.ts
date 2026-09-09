import type { MetadataRoute } from "next";
import { SITE_URL, DISALLOWED_PREFIXES } from "@/lib/seo";

/**
 * One rule for every crawler, search engine and AI answer engine alike: the
 * marketing site (lib/seo.ts's PUBLIC_ROUTES) is what's worth citing, the
 * product behind login isn't reachable without an account regardless, and
 * neither robots.txt entry stops a determined bot — this is a courtesy
 * signal, not the access control (that's the login gate itself).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      // A disallowed value is a PREFIX match by the robots exclusion standard
      // — "/chat" already covers "/chat/" and everything under it, no need
      // for both forms.
      userAgent: "*",
      allow: "/",
      disallow: DISALLOWED_PREFIXES,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
