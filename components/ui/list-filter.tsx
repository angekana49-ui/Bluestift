"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { filterBySearch } from "@/lib/search";
import { useAppTheme } from "@/components/ui/theme";
import { IconSearch } from "@/components/ui/icons";
import { radius, text, type AppTheme } from "@/components/ui/tokens";

/**
 * Search and facets for the app's long lists.
 *
 * The complaint: "imagine l'admin chercher dans un staff de plus de 100
 * enseignants, 25 classes ou autres". Every list in Schools rendered every row,
 * unsorted and unfiltered, which is fine for the four teachers a pilot school
 * has and unusable at the size the product is sold for.
 *
 * One primitive rather than a search box per card, so all of them agree on what
 * a match is (see lib/search.ts), on where the field sits, and — the part that
 * is always got wrong — on telling "this list is empty" apart from "your query
 * matched nothing". Those are different sentences and only one of them has a
 * remedy.
 */

/**
 * Below this many rows the field does not appear.
 *
 * A search box over four subjects is chrome that costs more attention than it
 * saves, and the Team tab alone would otherwise open with three of them. Eight
 * is roughly where a list stops being scannable in one look. Crossing the
 * threshold is a rare, meaningful event (a school actually growing), not the
 * kind of flicker that makes a control feel unstable.
 */
export const LIST_SEARCH_MIN = 8;

export type ListSearch<T> = {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
  /** Is the list long enough to deserve the control? */
  enabled: boolean;
  /** Enabled AND the user has typed something. */
  active: boolean;
  /** The rows to render. */
  visible: T[];
  /** Rows before filtering — what the heading should count. */
  total: number;
  /** There ARE rows, and none of them match. The one state worth a sentence. */
  noMatch: boolean;
  /** Plural noun for the messages: "teachers", "classes", "students". */
  noun: string;
};

/**
 * Own the query, hand back the rows to render.
 *
 *   const teachers = useListSearch(profs, (p) => [p.name, p.email], { noun: "teachers" });
 *   <ListToolbar search={teachers} />
 *   {teachers.visible.map(...)}
 *   <ListNoMatch search={teachers} />
 */
export function useListSearch<T>(
  items: readonly T[],
  fields: (item: T) => (string | null | undefined)[],
  opts: { noun: string; minItems?: number },
): ListSearch<T> {
  const [query, setQuery] = useState("");
  const total = items.length;
  const enabled = total >= (opts.minItems ?? LIST_SEARCH_MIN);

  /**
   * A query must never outlive the field that set it. If rows are removed until
   * the list drops back under the threshold, the input disappears — and without
   * this the text would stay applied, hiding rows behind a control that is no
   * longer on screen and cannot be cleared.
   */
  useEffect(() => {
    if (!enabled) setQuery("");
  }, [enabled]);

  const active = enabled && query.trim().length > 0;
  const visible = active ? filterBySearch(items, query, fields) : [...items];

  return {
    query,
    setQuery,
    clear: () => setQuery(""),
    enabled,
    active,
    visible,
    total,
    noMatch: active && total > 0 && visible.length === 0,
    noun: opts.noun,
  };
}

/** A facet: one row of mutually exclusive chips. */
export type FacetOption = { key: string; label: string; count?: number };

/**
 * The toolbar: search on the leading edge, facets trailing.
 *
 * Renders nothing at all when there is neither — an empty 40px strip above a
 * short list is exactly the kind of leftover that makes a screen feel unfinished.
 */
export function ListToolbar<T>({
  search,
  children,
  style,
}: {
  search: ListSearch<T>;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  if (!search.enabled && !children) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        margin: "0 0 12px",
        ...style,
      }}
    >
      {search.enabled && <SearchField search={search} />}
      {children && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The field itself.
 *
 * `type="search"` for the semantics and the mobile keyboard's Search key, but
 * the browser's own clear affordance is suppressed: WebKit draws a grey ✕ that
 * ignores the theme and sits at a different inset than ours would, so on a dark
 * card it is an invisible control next to a visible one. Escape clears too —
 * that is the gesture a keyboard user reaches for first, and the native one is
 * lost along with the native ✕.
 */
function SearchField<T>({ search }: { search: ListSearch<T> }) {
  const { theme: t } = useAppTheme();
  return (
    <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180, maxWidth: 380 }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          color: t.mutedLight,
          pointerEvents: "none",
        }}
      >
        <IconSearch size={16} />
      </span>
      <input
        type="search"
        className="list-search-input"
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && search.query) {
            e.stopPropagation();
            search.clear();
          }
        }}
        placeholder={`Search ${search.noun}…`}
        aria-label={`Search ${search.noun}`}
        style={{
          background: t.inputBg,
          color: t.text,
          border: `1px solid ${t.inputBorder}`,
          borderRadius: radius.control,
          padding: "9px 34px 9px 34px",
          width: "100%",
          fontSize: text.sm,
          fontFamily: "inherit",
          boxSizing: "border-box",
          outline: "none",
        }}
      />
      {search.query && (
        <button
          type="button"
          onClick={search.clear}
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            padding: 0,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: t.muted,
            fontSize: 15,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * A facet chip. Selected state is carried by fill AND weight, not fill alone —
 * on the pale end of the light theme a single background step is close to
 * invisible, which is how a filter silently stays on.
 */
export function FilterChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  const { theme: t } = useAppTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        background: selected ? t.ctaBg : t.cardBg,
        color: selected ? t.ctaText : t.text,
        border: `1px solid ${selected ? "transparent" : t.controlBorder}`,
        borderRadius: radius.pill,
        padding: "6px 13px",
        fontSize: text.xs,
        fontWeight: selected ? 700 : 600,
        fontFamily: "inherit",
        lineHeight: 1.2,
        cursor: "pointer",
      }}
    >
      {label}
      {count != null && (
        <span style={{ opacity: 0.65, marginLeft: 6 }}>{count}</span>
      )}
    </button>
  );
}

/** A whole facet row, for the common single-select case. */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: FacetOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <>
      {options.map((o) => (
        <FilterChip
          key={o.key}
          label={o.label}
          count={o.count}
          selected={value === o.key}
          onClick={() => onChange(o.key)}
        />
      ))}
    </>
  );
}

/**
 * "Nothing matched" — never to be confused with "nothing here".
 *
 * The empty state a list already has ("No teachers yet. Add one below.") is
 * advice for an admin who has not set the school up. Showing it to an admin who
 * mistyped a name tells them their staff list is empty, which is alarming and
 * false. This one names the query back, so a typo is visible, and offers the
 * only useful action.
 */
export function ListNoMatch<T>({ search }: { search: ListSearch<T> }) {
  const { theme: t } = useAppTheme();
  if (!search.noMatch) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "14px 2px",
        color: t.muted,
        fontSize: text.sm,
      }}
    >
      <span>
        No {search.noun} match “{search.query.trim()}”.
      </span>
      <button
        type="button"
        onClick={search.clear}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: t.link,
          fontSize: text.sm,
          fontWeight: 650,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        Clear search
      </button>
    </div>
  );
}

/**
 * "12 of 104" — the reassurance that the list is filtered and not broken.
 *
 * Shown only while a query is applied. A permanent counter is noise; a counter
 * that appears exactly when rows are being withheld is an explanation.
 */
export function ListCount<T>({ search }: { search: ListSearch<T> }) {
  const { theme: t } = useAppTheme();
  if (!search.active || search.noMatch) return null;
  return (
    <span style={{ color: t.mutedLight, fontSize: text.xs, fontWeight: 600 }}>
      {search.visible.length} of {search.total}
    </span>
  );
}

/** Heading helper: "Teachers (104)" — the count belongs where the name is. */
export function withCount(label: string, n: number, theme?: AppTheme): ReactNode {
  return (
    <>
      {label}
      {n > 0 && (
        <span style={{ color: theme?.mutedLight ?? "inherit", fontWeight: 500 }}> ({n})</span>
      )}
    </>
  );
}
