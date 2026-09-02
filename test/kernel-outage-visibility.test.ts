import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A dead Kernel must not look like a quiet one.
 *
 * The Kernel deployment failed on 2026-08-16 and nothing in this app noticed
 * for seventeen days. Not because monitoring was misconfigured — because every
 * layer degraded politely and silently, by design:
 *
 *   refresh()            catch {} — set a backoff, say nothing
 *   auto-analyse         .catch(() => {})
 *   getCognitiveContext  returns { profile: null, alerts: [], analysis: null }
 *   buildLearnerState    returns "" → no <learner_state> in the prompt at all
 *
 * Each of those is individually correct: a chat turn must never block on the
 * Kernel. Together they mean a total outage and a brand-new student produce a
 * byte-identical result, so there is no signal anywhere — and the failure
 * surfaced only when a student asked Raya what it remembered and got a
 * confident, fabricated "nothing".
 *
 * These tests hold the two ends of that: the failure is reported, and the
 * absence is named in the prompt rather than left blank.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const cache = read("lib/kernel/profile-cache.ts");
const chat = read("app/api/raya/chat/route.ts");
const prompt = read("lib/raya/prompt.ts");

describe("Kernel failures are reported, not swallowed", () => {
  it("the profile refresh reports when it cannot reach the Kernel", () => {
    // The catch used to be empty. An empty catch on the ONLY path that
    // populates the cognitive profile is what made the outage invisible.
    expect(cache).toMatch(/reportKernelDown\("kernel\.loadProfile"/);
  });

  it("the post-conversation analyse reports too", () => {
    // The write half of the cognitive loop. If it fails every time, profiles
    // stop moving and no reply looks any different.
    expect(chat).toMatch(/reportKernelDown\("kernel\.analyze"/);
    expect(chat).not.toMatch(/\.catch\(\(\) => \{\}\)/);
  });

  it("reporting is rate-limited, so an outage is an alert and not a flood", () => {
    // This fires per user per turn. Without a window, one outage during a
    // lesson emits a line per student per message.
    expect(cache).toMatch(/DOWN_REPORT_WINDOW_MS/);
    expect(cache).toMatch(/lastReported/);
  });

  it("a single failure is a warning, not a page", () => {
    // One failed call is genuinely expected sometimes (cold container, dropped
    // connection). A lot of them is never fine — which is what the window turns
    // into a steady drip.
    const fn = cache.slice(cache.indexOf("export function reportKernelDown"));
    expect(fn).toMatch(/severity: "warning"/);
    expect(fn).toMatch(/dependency: "kernel"/);
  });
});

describe("the prompt names an absent profile", () => {
  it("never emits a bare, unexplained gap", () => {
    // buildLearnerState returning "" left the model to invent what the silence
    // meant, and it invented a claim about the product.
    expect(prompt).toContain('<learner_state available="false">');
    expect(prompt).not.toMatch(/if \(!lines\.length\) \{\s*return "";/);
  });

  it("distinguishes the two cases it used to conflate", () => {
    // "The Kernel is down" and "this learner is new" produced the same empty
    // prompt. They still produce the same DATA — nothing — but the instruction
    // now forbids resolving that ambiguity by guessing.
    expect(prompt).toMatch(/available="true"/);
    expect(prompt).toMatch(/available="false"/);
    expect(prompt).toMatch(/Do NOT conclude the learner is new/);
  });

  it("states what Raya actually carries between sessions", () => {
    expect(prompt).toContain("# What you remember");
    expect(prompt).toMatch(/Never tell a learner that you have no memory/);
  });
});

describe("the health probe exists — and is worth pointing something at", () => {
  it("still returns a boolean an uptime check can read", () => {
    // Nothing in the app polls this. That is a deployment decision, not a code
    // one, but the endpoint has to keep the shape an external monitor expects.
    const health = read("app/api/kernel/health/route.ts");
    expect(health).toMatch(/NextResponse\.json\(\{ ok \}\)/);
    // And it must stay quiet about internals: it is deliberately public.
    expect(health).not.toMatch(/KERNEL_API_URL/);
  });
});
