import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pin the workspace root so Turbopack doesn't infer a parent directory
// (which caused "couldn't find next/package.json" + panics).
const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: rootDir },
  // Keep native doc parsers out of the bundle (run as Node modules at runtime).
  serverExternalPackages: ["mammoth", "xlsx"],
};

export default nextConfig;
