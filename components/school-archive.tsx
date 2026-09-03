"use client";

import { useEffect, useState } from "react";
import { useAppTheme } from "@/components/ui/theme";
import { panelCard, textInput } from "@/components/ui/forms";
import type { ArchiveSection, SchoolYearSummary, YearArchive } from "@/lib/school-admin";

const BASIS_LABEL: Record<string, string> = {
  year: "exact — stamped with this school year",
  class: "exact — via the class, which carries the year",
  period: "by period — attributed by creation date",
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
  const box = panelCard(t);
  const select = textInput(t);

  const [years, setYears] = useState<SchoolYearSummary[] | null>(null);
  const [yearId, setYearId] = useState("");
  const [archive, setArchive] = useState<YearArchive | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await (await fetch("/api/school/year")).json();
        const list = (data.years ?? []) as SchoolYearSummary[];
        setYears(list);
        // Open on the most recent PAST year — the archive's reason to exist. A
        // school still in its first year opens on that one instead of nothing.
        const firstPast = list.find((y) => !y.isCurrent);
        setYearId(firstPast?.id ?? list[0]?.id ?? "");
      } catch {
        setError("Could not load the school's years.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/school/archive?yearId=${yearId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error ?? "Could not load that year.");
        setArchive(data as YearArchive);
      } catch (err) {
        if (!cancelled) {
          setArchive(null);
          setError(err instanceof Error ? err.message : "Could not load that year.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yearId]);

  const filled = archive?.sections.filter((s) => s.count > 0) ?? [];
  const empty = archive?.sections.filter((s) => s.count === 0) ?? [];
  const total = filled.reduce((n, s) => n + s.count, 0);
  const viewingCurrent = years?.find((y) => y.id === yearId)?.isCurrent ?? false;

  return (
    <>
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 style={{ fontSize: 18, margin: 0, color: t.text }}>Archive</h2>
          <p style={{ margin: "4px 0 0", color: t.muted, fontSize: 14 }}>
            {archive
              ? `${archive.year.label} · ${total} ${total === 1 ? "entry" : "entries"}`
              : "Everything your school produced, year by year."}
          </p>
        </div>
        {years && years.length > 0 && (
          <select
            style={{ ...select, width: "auto", minWidth: 200 }}
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            title="School year"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.isCurrent ? " · current" : " · archived"}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div style={box}>
          <p style={{ margin: 0, color: "#f87171", fontSize: 15 }}>{error}</p>
        </div>
      )}
      {busy && <p style={{ color: t.muted, fontSize: 15 }}>Loading…</p>}

      {archive && !busy && (
        <>
          <div style={box}>
            <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>
              {viewingCurrent ? (
                <>
                  <strong style={{ color: t.text }}>{archive.year.label}</strong> is the year in
                  progress — this record is still filling up. Changes are made from the other tabs.
                </>
              ) : (
                <>
                  The school as it was in{" "}
                  <strong style={{ color: t.text }}>{archive.year.label}</strong>. Nothing here can
                  be changed — a past year is a record. Work on{" "}
                  <strong style={{ color: t.text }}>{currentYearLabel ?? "the current year"}</strong>{" "}
                  from the other tabs.
                </>
              )}
            </p>
          </div>

          {filled.length === 0 ? (
            <div style={box}>
              <p style={{ margin: 0, color: t.muted, fontSize: 15 }}>
                Nothing was recorded for {archive.year.label}.
              </p>
            </div>
          ) : (
            filled.map((s) => <SectionCard key={s.key} s={s} />)
          )}

          {empty.length > 0 && (
            <div style={box}>
              <h3 style={{ margin: "0 0 6px", fontSize: 15, color: t.text }}>Nothing recorded</h3>
              <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>
                {empty.map((s) => s.label).join(" · ")}
              </p>
            </div>
          )}

          <div style={box}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, color: t.text }}>What this record is</h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: t.muted, fontSize: 13.5, lineHeight: 1.6 }}>
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

function SectionCard({ s }: { s: ArchiveSection }) {
  const { theme: t } = useAppTheme();
  const box = panelCard(t);
  // Long sections start collapsed: the record is meant to be scanned by section
  // first, opened second.
  const [open, setOpen] = useState(s.items.length <= 12);

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, flex: 1, fontSize: 16, color: t.text }}>
          {s.label}{" "}
          <span style={{ opacity: 0.5, fontWeight: 400 }}>· {s.count}</span>
        </h3>
        <span style={{ opacity: 0.5, fontSize: "0.78rem" }} title={BASIS_LABEL[s.basis]}>
          {s.basis === "period" ? "by period" : "exact"}
        </span>
        {s.items.length > 12 && (
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              background: "transparent",
              border: "none",
              color: t.muted,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {s.items.map((i) => (
            <div
              key={i.id}
              style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", fontSize: 14, flexWrap: "wrap" }}
            >
              <span style={{ color: t.text, fontWeight: 600 }}>{i.title}</span>
              {i.detail && <span style={{ color: t.muted, flex: 1, minWidth: 0 }}>{i.detail}</span>}
              {i.at && <span style={{ color: t.mutedLight, fontSize: "0.8rem" }}>{i.at}</span>}
            </div>
          ))}
          {s.count > s.items.length && (
            <p style={{ margin: "0.3rem 0 0", color: t.mutedLight, fontSize: 13 }}>
              + {s.count - s.items.length} more not listed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
