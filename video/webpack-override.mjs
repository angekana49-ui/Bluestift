import path from "node:path";

/**
 * The video draws the landing page's own product shots (components/site/*), so
 * the bundle has to resolve the app's `@/` alias — and it must resolve React to
 * ONE copy. The shots live outside this package, so a bare `react` import from
 * them would walk up to the app's node_modules while Remotion's own imports
 * resolve here: two Reacts, and every hook in the shots throws. Everything is
 * pinned to THIS package's copy, because Remotion's own aliases (react-dom/client
 * and friends) already point here and would otherwise win for their subpaths —
 * which is how a first attempt pinned to the app's copy ended up mixing React
 * 19.2 and 19.3 in one bundle.
 *
 * A factory taking the package directory, not a module reading `import.meta`:
 * Remotion compiles remotion.config.ts to CommonJS, where `import.meta` is empty.
 * Used by remotion.config.ts (studio, render) and scripts/stills.mjs.
 */
export function makeWebpackOverride(videoDir) {
  const repoRoot = path.resolve(videoDir, "..");
  const modules = path.join(videoDir, "node_modules");
  return (current) => ({
    ...current,
    resolve: {
      ...current.resolve,
      alias: {
        ...(current.resolve?.alias ?? {}),
        "@": repoRoot,
        react: path.join(modules, "react"),
        "react-dom": path.join(modules, "react-dom"),
        "react/jsx-runtime": path.join(modules, "react", "jsx-runtime"),
        "react/jsx-dev-runtime": path.join(modules, "react", "jsx-dev-runtime"),
      },
    },
  });
}
