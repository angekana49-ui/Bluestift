"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { getJsonCached } from "@/lib/net/client-fetch";
import { panelCard, textInput } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";
import type { SchoolYearSummary, YearArchive } from "@/lib/school-admin";
import {
  EMPTY_ARCHIVE_FILTER,
  filterArchiveSections,
  isFiltering,
  type ArchiveFilter,
  type FilteredSection,
} from "@/lib/archive-filter";

const BASIS_LABEL_KEY: Record<string, MessageKey> = {
  year: "school.archive.basisYear",
  class: "school.archive.basisClass",
  period: "school.archive.basisPeriod",
};

/**
 * The Archive tab: one school year, and everything the school produced and
 * collected in the app during it.
 *
 * Read-only by construction — there is no write path on this screen at all. A
 * past year is a record, and the point of showing it here rather than as a mode
 * of "Classes & codes" is that it is not a class list: it is the year.
 */
export function SchoolArchive({ currentYearLabel }: { currentYearLabel?: string | null }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(t);
  const select = textInput(t);

  const [years, setYears] = useState<SchoolYearSummary[] | null>(null);
  const [yearId, setYearId] = useState("");
  const [archive, setArchive] = useState<YearArchive | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ArchiveFilter>(EMPTY_ARCHIVE_FILTER);
  const set = <K extends keyof ArchiveFilter>(k: K, v: ArchiveFilter[K]) =>
    setFilter((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      const { data } = await getJsonCached<{ years?: SchoolYearSummary[] }>("/api/school/year", {
        cacheKey: "school:years",
      });
      if (!data) {
        setError(tr("school.archive.loadYearsFailed"));
        return;
      }
      const list = (data.years ?? []) as SchoolYearSummary[];
      setYears(list);
      // Open on the most recent PAST year — the archive's reason to exist. A
      // school still in its first year opens on that one instead of nothing.
      const firstPast = list.find((y) => !y.isCurrent);
      setYearId(firstPast?.id ?? list[0]?.id ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      // Class and subject ids belong to the year they were picked in; keeping
      // them across a year change would silently show an empty record.
      setFilter(EMPTY_ARCHIVE_FILTER);
      try {
        // Cached first: flipping between years already visited this session
        // renders instantly instead of a spinner every time.
        const { data } = await getJsonCached<YearArchive>(`/api/school/archive?yearId=${yearId}`, {
          cacheKey: `school:archive:${yearId}`,
          onUpdate: (fresh) => {
            if (!cancelled) setArchive(fresh);
          },
        });
        if (cancelled) return;
        if (!data) throw new Error(tr("school.archive.loadYearFailed"));
        setArchive(data);
      } catch (err) {
        if (!cancelled) {
          setArchive(null);
          setError(err instanceof Error ? err.message : tr("school.archive.loadYearFailed"));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearId]);

  const narrowed = useMemo(
    () => filterArchiveSections(archive?.sections ?? [], filter),
    [archive, filter],
  );
  const active = isFiltering(filter);
  const filled = narrowed.filter((s) => s.count > 0);
  // Under a filter, three ways a section can be quiet, and they mean different
  // things: nothing matched, or the filter doesn't reach that kind of entry.
  const empty = narrowed.filter((s) => s.applies && s.count === 0);
  const outOfScope = narrowed.filter((s) => !s.applies);
  const total = filled.reduce((n, s) => n + s.count, 0);
  const grandTotal = (archive?.sections ?? []).reduce((n, s) => n + s.count, 0);
  const capped = filled.some((s) => s.hiddenByCap);
  const viewingCurrent = years?.find((y) => y.id === yearId)?.isCurrent ?? false;
  const selectStyle = { ...select, width: "auto", minWidth: 150 };

  return (
    <>
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 style={{ fontSize: 18, margin: 0, color: t.text }}>{tr("school.archive.title")}</h2>
          <p style={{ margin: "4px 0 0", color: t.muted, fontSize: 15 }}>
            {archive
              ? `${archive.year.label} · ${total} ${tr(total === 1 ? "school.archive.entryOne" : "school.archive.entryOther")}${
                  active ? ` ${tr("school.archive.ofSuffix")} ${grandTotal}` : ""
                }`
              : tr("school.archive.emptyIntro")}
          </p>
        </div>
        {years && years.length > 0 && (
          <select
            style={{ ...select, width: "auto", minWidth: 200 }}
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            title={tr("school.archive.schoolYearTitle")}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {" · "}{y.isCurrent ? tr("school.archive.currentSuffix") : tr("school.archive.archivedSuffix")}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div style={box}>
          <p style={{ margin: 0, color: "#f87171", fontSize: 16 }}>{error}</p>
        </div>
      )}
      {busy && <p style={{ color: t.muted, fontSize: 16 }}>{tr("school.loading")}</p>}

      {archive && !busy && (
        <>
          <div style={box}>
            <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
              {viewingCurrent ? (
                <>
                  <strong style={{ color: t.text }}>{archive.year.label}</strong> {tr("school.archive.currentYearAfter")}
                </>
              ) : (
                <>
                  {tr("school.archive.pastYearA")}{" "}
                  <strong style={{ color: t.text }}>{archive.year.label}</strong>{tr("school.archive.pastYearB")}{" "}
                  <strong style={{ color: t.text }}>{currentYearLabel ?? tr("school.archive.currentYearFallback")}</strong>{" "}
                  {tr("school.archive.pastYearC")}
                </>
              )}
            </p>
          </div>

          <div style={{ ...box, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: t.muted, fontSize: 14.5, fontWeight: 600 }}>{tr("school.archive.filterLabel")}</span>
            <input
              style={{ ...select, width: "auto", minWidth: 170, flex: "1 1 170px" }}
              value={filter.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder={tr("school.archive.searchPlaceholder")}
              aria-label={tr("school.archive.searchAria")}
            />
            <select
              style={selectStyle}
              value={filter.classId}
              onChange={(e) => set("classId", e.target.value)}
              aria-label={tr("school.archive.classAria")}
            >
              <option value="">{tr("school.archive.allClasses")}</option>
              {archive.facets.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={filter.subjectId}
              onChange={(e) => set("subjectId", e.target.value)}
              aria-label={tr("school.archive.subjectAria")}
              // A year where nothing was ever filed under a subject offers no
              // subject to pick; saying so beats an empty dropdown.
              disabled={archive.facets.subjects.length === 0}
            >
              <option value="">
                {archive.facets.subjects.length === 0 ? tr("school.archive.noSubjectsRecorded") : tr("school.archive.allSubjects")}
              </option>
              {archive.facets.subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={filter.basis}
              onChange={(e) => set("basis", e.target.value as ArchiveFilter["basis"])}
              aria-label={tr("school.archive.attributionAria")}
              title={tr("school.archive.attributionTitle")}
            >
              <option value="">{tr("school.archive.anyAttribution")}</option>
              <option value="year">{tr("school.archive.stampedWithYear")}</option>
              <option value="class">{tr("school.archive.viaClass")}</option>
              <option value="period">{tr("school.archive.byPeriodApprox")}</option>
            </select>
            {active && (
              <button
                onClick={() => setFilter(EMPTY_ARCHIVE_FILTER)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: t.muted,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {tr("school.archive.clear")}
              </button>
            )}
          </div>

          {filled.length === 0 ? (
            <div style={box}>
              <p style={{ margin: 0, color: t.muted, fontSize: 16 }}>
                {active
                  ? tr("school.archive.noMatchFilter")
                  : `${tr("school.archive.nothingRecordedForA")} ${archive.year.label}${tr("school.archive.nothingRecordedForB")}`}
              </p>
            </div>
          ) : (
            filled.map((s) => <SectionCard key={s.key} s={s} filtering={active} />)
          )}

          {capped && (
            <div style={box}>
              <p style={{ margin: 0, color: t.muted, fontSize: 14.5 }}>
                {tr("school.archive.cappedNote")}
              </p>
            </div>
          )}

          {empty.length > 0 && (
            <div style={box}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, color: t.text }}>
                {active ? tr("school.archive.noMatchHeading") : tr("school.archive.nothingRecordedHeading")}
              </h3>
              <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
                {empty.map((s) => s.label).join(" · ")}
              </p>
            </div>
          )}

          {outOfScope.length > 0 && (
            <div style={box}>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, color: t.text }}>{tr("school.archive.outsideFilterHeading")}</h3>
              <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
                {outOfScope.map((s) => s.label).join(" · ")} {tr("school.archive.outsideFilterNote")}
              </p>
            </div>
          )}

          <div style={box}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: t.text }}>{tr("school.archive.whatThisRecordIs")}</h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: t.muted, fontSize: 14.5, lineHeight: 1.6 }}>
              {archive.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

function SectionCard({ s, filtering }: { s: FilteredSection; filtering: boolean }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(t);
  // Long sections start collapsed: the record is meant to be scanned by section
  // first, opened second. A filtered section opens — the admin asked for those
  // rows, hiding them behind a "Show" defeats the filter.
  const [open, setOpen] = useState(s.items.length <= 12);
  const shown = open || filtering;

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, flex: 1, fontSize: 17, color: t.text }}>
          {s.label}{" "}
          <span style={{ opacity: 0.5, fontWeight: 400 }}>· {s.count}</span>
        </h3>
        <span style={{ opacity: 0.5, fontSize: "0.78rem" }} title={tr(BASIS_LABEL_KEY[s.basis])}>
          {s.basis === "period" ? tr("school.archive.byPeriod") : tr("school.archive.exact")}
        </span>
        {s.items.length > 12 && !filtering && (
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: t.muted,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {open ? tr("school.archive.hide") : tr("school.archive.show")}
          </button>
        )}
      </div>

      {shown && (
        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {s.items.map((i) => (
            <div
              key={i.id}
              style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", fontSize: 15, flexWrap: "wrap" }}
            >
              <span style={{ color: t.text, fontWeight: 600 }}>{i.title}</span>
              {i.detail && <span style={{ color: t.muted, flex: 1, minWidth: 0 }}>{i.detail}</span>}
              {i.at && <span style={{ color: t.mutedLight, fontSize: "0.8rem" }}>{i.at}</span>}
            </div>
          ))}
          {s.count > s.items.length && (
            <p style={{ margin: "0.3rem 0 0", color: t.mutedLight, fontSize: 14 }}>
              + {s.count - s.items.length} {tr("school.archive.moreNotListed")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
