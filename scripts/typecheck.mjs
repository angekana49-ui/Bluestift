/**
 * `tsc --noEmit`, made trustworthy.
 *
 * On 2026-09-06 the typecheck reported clean while `next build` failed. The
 * cause was not the compiler: `tsconfig.json` pulls in `.next/dev/types/**`,
 * which the dev server generates, and a stale copy left over from an earlier
 * session contained an unterminated template literal. TypeScript stopped
 * part-way through and said nothing — hiding a real error in
 * `lib/compliance/export.ts` that would have failed at runtime.
 *
 * A checker that reports success when it has not checked is worse than no
 * checker, because the whole point of running it is to be allowed to stop
 * worrying. So this removes the generated directory first. It is build output:
 * `next dev` recreates it, and `next build` writes its own copy elsewhere.
 *
 * If errors in `.next/` ever appear again despite this, that is the signal —
 * something regenerated a broken file, and the run below is not to be believed.
 */
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const GENERATED = ".next/dev/types";

rmSync(GENERATED, { recursive: true, force: true });

/*
 * The compiler is run through `node` on TypeScript's own entry point rather
 * than through `npx`. Spawning a `.cmd` shim fails outright on Windows
 * (EINVAL) unless a shell is involved, and a wrapper that cannot start the
 * checker but still exits non-zero would be its own small version of the
 * problem this file exists to fix.
 */
const tscBin = createRequire(import.meta.url).resolve("typescript/bin/tsc");
const tsc = spawnSync(process.execPath, [tscBin, "--noEmit"], {
  stdio: ["ignore", "pipe", "inherit"],
  encoding: "utf8",
});

if (tsc.error) {
  process.stderr.write(`Could not run TypeScript: ${tsc.error.message}\n`);
  process.exit(1);
}

const output = tsc.stdout ?? "";
if (output) process.stdout.write(output);

// A leftover generated file means the run above checked less than it claims.
if (/^\.next[\\/]/m.test(output)) {
  process.stderr.write(
    "\nThose errors are in generated build output under .next/, not in your code.\n" +
      "TypeScript may have stopped early, so a clean result here proves nothing.\n" +
      "Delete .next and run `npm run build` before believing a green typecheck.\n",
  );
  process.exit(1);
}

process.exit(tsc.status ?? 1);
