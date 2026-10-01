"use client";

import { useCallback, useEffect, useState } from "react";
import { netFetch } from "@/lib/net/client-fetch";
import { useAppLocale } from "@/components/ui/locale";
import { conceptName, type ConceptNames } from "@/lib/kernel/concept-names";

/**
 * `const name = useConceptName(); name(c.label)` — a Kernel concept's name in
 * the reader's language (see lib/kernel/concept-names.ts).
 *
 * The vocabulary is fetched once per page load and shared by every component
 * that asks. Until it arrives, and for any concept it lacks, the label is shown
 * made readable — never the raw snake_case, never blank.
 */

let pending: Promise<ConceptNames> | null = null;

function fetchNames(): Promise<ConceptNames> {
  pending ??= netFetch("/api/concepts/names", {}, { timeoutMs: 8_000 })
    .then((res) => (res.ok ? res.json() : { names: {} }))
    .then((body: { names?: ConceptNames }) => body.names ?? {})
    .catch(() => {
      pending = null; // try again on the next mount, not never
      return {};
    });
  return pending;
}

export function useConceptName(): (label: string | null | undefined) => string {
  const { locale } = useAppLocale();
  const [names, setNames] = useState<ConceptNames | null>(null);
  useEffect(() => {
    let live = true;
    fetchNames().then((n) => {
      if (live) setNames(n);
    });
    return () => {
      live = false;
    };
  }, []);
  return useCallback((label) => conceptName(label, locale, names), [locale, names]);
}
