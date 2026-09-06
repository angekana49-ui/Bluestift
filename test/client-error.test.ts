import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { clientError, GENERIC_FAILURE } from "@/lib/observability/client-error";

/**
 * What a 5xx tells the caller.
 *
 * The reason this exists is not really the schema disclosure — the migrations
 * are public. It is that every client here renders `data.error` straight into
 * the interface, so a failed save was showing a child a Postgres constraint
 * violation. The server now sends a sentence and keeps the rest.
 */
describe("clientError", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("says nothing about our internals in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const pg = { message: 'duplicate key value violates unique constraint "classes_name_key"' };
    expect(clientError(pg)).toBe(GENERIC_FAILURE);
    expect(clientError(pg)).not.toContain("classes_name_key");
  });

  it("uses the route's own wording when it has one", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(clientError(new Error("ECONNREFUSED 10.0.0.4:8000"), "transcription error")).toBe(
      "transcription error",
    );
  });

  it("hands the real message back in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(clientError(new Error("relation does not exist"))).toBe("relation does not exist");
  });

  it("falls back rather than returning an empty string", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(clientError({ message: "   " })).toBe(GENERIC_FAILURE);
    expect(clientError(null)).toBe(GENERIC_FAILURE);
    expect(clientError(undefined, "nope")).toBe("nope");
  });

  it("survives a thrown value that is not an Error", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(clientError("plain string")).toBe("plain string");
    expect(clientError(42)).toBe(GENERIC_FAILURE);
  });
});

/**
 * The sweep has to stay swept. A new route copying the old shape from its
 * neighbours is exactly how this comes back, and nothing about it looks wrong
 * in review.
 */
describe("no route hands a raw failure back to the caller", () => {
  const files = execSync('git ls-files "app/api/**/route.ts"', { encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  it("returns no `<err>.message` on a 500", () => {
    const offenders = files.filter((f) =>
      /\{ error: [A-Za-z_][A-Za-z0-9_.]*\.message \}, \{ status: 500 \}/.test(
        readFileSync(join(process.cwd(), f), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("returns no `e instanceof Error ? e.message : …` in a RESPONSE", () => {
    /*
     * Scoped to lines that build an `error` field, for two reasons.
     *
     * Server-side logging stays verbose on purpose — a `console.warn` goes to
     * our own drain, not to the caller — and so does the message written onto a
     * `tool_outputs` row, which is what makes a failed generation diagnosable
     * later. Neither leaves the system.
     *
     * This is a tripwire, not a proof: a message computed on one line and
     * returned on another would walk past it. It catches the shape that was
     * actually there, which is the shape a new route copies from its neighbours.
     */
    const offenders = files.filter((f) =>
      readFileSync(join(process.cwd(), f), "utf8")
        .split(/\r?\n/)
        .some(
          (line) =>
            /instanceof Error \? [A-Za-z_][A-Za-z0-9_]*\.message/.test(line) &&
            /\berror:/.test(line),
        ),
    );
    expect(offenders).toEqual([]);
  });
});
