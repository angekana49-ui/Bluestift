import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit-test harness for pure/logic modules. Two aliases make server modules
 * importable in a plain Node test env:
 *  - `server-only` → a no-op stub (the real package throws outside an RSC bundle);
 *  - `@` → the project root, mirroring the tsconfig path alias.
 * Tests live in test/ and must not hit the network or a real Supabase/env.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
});
