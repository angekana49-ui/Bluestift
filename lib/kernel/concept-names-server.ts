import "server-only";
import { createKernelAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/lib/locale";
import { getServerLocale } from "@/lib/i18n/server";
import { cleanNameSet, conceptName, type ConceptNames } from "./concept-names";

/**
 * Every concept's readable names, from `kernel.concept_nodes.display_names`.
 *
 * The whole vocabulary, not a per-request lookup: it is a few hundred rows,
 * the same for everyone, and changes only when the Kernel creates a concept —
 * so one read an hour per instance serves every screen. A concept created
 * since shows its label made readable until the next read.
 *
 * A failed read (the Kernel's migration 013 not applied yet, the database
 * unreachable) is cached briefly as "no names", never thrown: every caller
 * falls back to the readable label, which is what was shown before.
 */

const TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
// PostgREST's default max-rows: page past it rather than silently truncate.
const PAGE = 1000;

let cache: { at: number; ttl: number; names: ConceptNames } | null = null;
let inflight: Promise<ConceptNames> | null = null;

async function read(): Promise<ConceptNames> {
  const kernel = createKernelAdminClient();
  const names: ConceptNames = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await kernel
      .from("concept_nodes")
      .select("label, display_names")
      .order("label")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as { label: string | null; display_names: unknown }[] | null) ?? [];
    for (const r of rows) {
      if (!r.label) continue;
      const set = cleanNameSet(r.display_names);
      if (Object.keys(set).length) names[r.label.trim().toLowerCase()] = set;
    }
    if (rows.length < PAGE) return names;
  }
}

export async function loadConceptNames(): Promise<ConceptNames> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.names;
  inflight ??= read()
    .then((names) => {
      cache = { at: Date.now(), ttl: TTL_MS, names };
      return names;
    })
    .catch(() => {
      cache = { at: Date.now(), ttl: FAILURE_TTL_MS, names: {} };
      return {};
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** A `label → name` function for server code that writes for one reader. */
export async function conceptNamer(locale: Locale): Promise<(label: string | null | undefined) => string> {
  const names = await loadConceptNames();
  return (label) => conceptName(label, locale, names);
}

/** The same, in the language of the person this request renders for. */
export async function readerConceptNamer(): Promise<(label: string | null | undefined) => string> {
  return conceptNamer(await getServerLocale());
}
