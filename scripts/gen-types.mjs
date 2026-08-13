#!/usr/bin/env node
/**
 * Regenerate types/database.types.ts from the live Supabase schema.
 *
 * This exists because the obvious one-liner is destructive:
 *
 *   supabase gen types ... > types/database.types.ts
 *
 * The shell truncates the target BEFORE the command runs, so anything that goes
 * wrong — an expired token, no network, a CLI that prints its error to stdout as
 * JSON — leaves the file replaced by that error and the build broken. It is only
 * recoverable here because the file is in git; a fresh column added by hand since
 * the last commit would simply be gone.
 *
 * So: capture, validate, and only then write.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "types/database.types.ts";
const PROJECT = "mbvovxnfdptxvnhmdxew";
const SCHEMAS = ["public", "learning", "schools", "rag", "content"];

const args = [
  "supabase",
  "gen",
  "types",
  "typescript",
  "--project-id",
  PROJECT,
  ...SCHEMAS.flatMap((s) => ["--schema", s]),
];

const res = spawnSync("npx", args, { encoding: "utf8", shell: true });
const stdout = res.stdout ?? "";

function fail(reason, detail) {
  console.error(`gen:types failed — ${reason}`);
  console.error(`${OUT} was NOT modified.`);
  if (detail) console.error(`\n${detail.trim().slice(0, 500)}`);
  process.exit(1);
}

if (res.error) fail("could not run the Supabase CLI", String(res.error));
if (res.status !== 0) fail(`the CLI exited ${res.status}`, res.stderr || stdout);

// The CLI reports some failures as a JSON object on stdout with exit code 0, so
// a status check alone is not enough — insist on seeing the actual type module.
if (!stdout.includes("export type Database")) {
  fail("the output is not a type module (auth token expired?)", stdout || res.stderr);
}

writeFileSync(OUT, stdout, "utf8");
console.log(`Wrote ${OUT} (${stdout.split("\n").length} lines).`);
