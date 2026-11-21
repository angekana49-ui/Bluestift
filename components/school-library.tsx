"use client";

import { useEffect, useState } from "react";
import type { BrandedDoc } from "@/lib/document";
import { useAppTheme } from "@/components/ui/theme";
import { netFetch, getJsonCached, invalidateCached } from "@/lib/net/client-fetch";
import { DocumentView } from "@/components/ui/document";
import { Modal } from "@/components/ui/modal";
import { ArtifactMenu } from "@/components/ui/artifact-menu";
import { ArchivedDisclosure } from "@/components/ui/archived-section";
import { panelCard, ghostButton } from "@/components/ui/forms";
import { useTranslate } from "@/components/ui/locale";
import type { MessageKey } from "@/lib/i18n";

type ShelfItem = {
  id: string;
  sourceType: string;
  title: string;
  content: string;
  kind: string | null;
  className: string | null;
  subjectName: string | null;
  sentBy: string;
  sentAt: string;
  archivedAt: string | null;
};

const PREPARE_KIND_KEY: Record<string, MessageKey> = {
  exam: "tools.selfTest.kind.exam.label",
  exercise: "school.prepare.kindExerciseSet",
  worksheet: "school.prepare.kindWorksheet",
  quiz: "tools.pretty.quiz",
};
const REPORT_SCOPE_KEY: Record<string, MessageKey> = {
  school: "school.reports.wholeSchool",
  class: "school.reports.classReport",
  subject: "school.reports.subjectReport",
};

/**
 * The school's shelf, admin face: frozen copies teachers chose to send up.
 * Read-only documents — the school files them away (archive), never deletes
 * them. There is no DELETE on /api/school/library on purpose.
 */
export function SchoolLibrary({ schoolName }: { schoolName?: string }) {
  const { theme: t } = useAppTheme();
  const tr = useTranslate();
  const box = panelCard(t);
  const ghost = ghostButton(t);

  const [items, setItems] = useState<ShelfItem[]>([]);
  const [current, setCurrent] = useState<ShelfItem | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await getJsonCached<{ items?: ShelfItem[] }>("/api/school/library", {
        cacheKey: "school:library",
        onUpdate: (fresh) => {
          if (Array.isArray(fresh.items)) setItems(fresh.items);
        },
      });
      if (Array.isArray(data?.items)) setItems(data.items);
    })();
  }, []);

  async function archiveItem(id: string, archived: boolean) {
    const res = await netFetch("/api/school/library", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: archived ? "archive" : "unarchive" }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d?.error);
    setItems((v) => v.map((r) => (r.id === id ? { ...r, archivedAt: d.archivedAt ?? null } : r)));
    invalidateCached("school:library");
  }

  const kindLabel = (r: ShelfItem) => {
    if (!r.kind) return null;
    const key = r.sourceType === "report" ? REPORT_SCOPE_KEY[r.kind] : PREPARE_KIND_KEY[r.kind];
    return key ? tr(key) : r.kind;
  };
  const docFor = (r: ShelfItem): BrandedDoc => ({
    brand: "bluestift",
    title: r.title,
    meta: [kindLabel(r), r.sentBy, new Date(r.sentAt).toLocaleDateString()].filter(Boolean).join(" · "),
    audience: schoolName,
    body: r.sourceType === "report" ? `${r.content}\n\n_${tr("kernel.dataNote.figures")}_` : r.content, // Reports are Kernel-grounded; prepare resources are not.
  });

  const live = items.filter((r) => !r.archivedAt);
  const archived = items.filter((r) => !!r.archivedAt);
  const row = (r: ShelfItem) => (
    <div key={r.id} style={{ display: "flex", gap: "0.5rem", rowGap: "0.35rem", alignItems: "center", flexWrap: "wrap", padding: "0.35rem 0", opacity: r.archivedAt ? 0.62 : 1 }}>
      <span style={{ flex: "1 1 170px", minWidth: 0 }}>
        {r.title}
        <span style={{ opacity: 0.5, fontSize: "0.78rem" }}>
          {" "}
          · {[kindLabel(r), r.sentBy, r.className, r.subjectName].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{new Date(r.sentAt).toLocaleDateString()}</span>
      <button style={ghost} onClick={() => setCurrent(r)}>
        {tr("school.roster.view")}
      </button>
      <ArtifactMenu
        theme={t}
        itemLabel={r.title}
        archived={!!r.archivedAt}
        // The school side archives, never deletes — see the PATCH doc
        // comment on app/api/school/library.
        canDelete={false}
        onArchive={(next) => archiveItem(r.id, next)}
        onDelete={() => Promise.reject(new Error("the school library cannot be deleted"))}
      />
    </div>
  );

  return (
    <div>
      {current && (
        <Modal onClose={() => setCurrent(null)} label={current.title}>
          <DocumentView {...docFor(current)} doc={docFor(current)} onClose={() => setCurrent(null)} />
        </Modal>
      )}
      <div style={box}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.75rem" }}>{tr("school.library.title")}</h2>
        {items.length === 0 && <p style={{ color: t.muted, fontSize: "0.95rem", margin: 0 }}>{tr("school.library.empty")}</p>}
        {live.map(row)}
        <ArchivedDisclosure theme={t} count={archived.length}>
          {archived.map(row)}
        </ArchivedDisclosure>
      </div>
    </div>
  );
}
