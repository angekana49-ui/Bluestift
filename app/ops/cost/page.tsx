import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformOwner } from "@/lib/ops";
import { studentCostReport, ASSUMED_INPUT_SHARE } from "@/lib/ops-cost";
import { getServerTranslate } from "@/lib/i18n/server";

/**
 * Founder-only inference-cost console — same gate as /ops/billing: not linked
 * from any nav, `users.is_founder` or a plain 404, so the page never confirms
 * its own existence to anyone else.
 *
 * Read fresh on every visit. A cost figure that is quietly a day old is worse
 * than no figure, because it gets quoted.
 */
export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90];

function usd(n: number | null): string {
  if (n === null) return "—";
  // Four decimals: a single student's month costs cents, and a table that
  // rounds cents to $0.00 is a table that says inference is free.
  return `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 12,
  color: "#6b7794",
  borderBottom: "1px solid #e4e8f0",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 14,
  borderBottom: "1px solid #f0f2f7",
  whiteSpace: "nowrap",
};
const NUM: React.CSSProperties = { ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default async function OpsCostPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformOwner(user.id))) notFound();
  const tr = await getServerTranslate();

  const { days } = await searchParams;
  const asked = Number(days);
  const windowDays = WINDOWS.includes(asked) ? asked : 30;
  const report = await studentCostReport(windowDays);

  const unpriced = report.models.filter((m) => m.rateSource === "none");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>{tr("ops.cost.pageTitle")}</h1>
      <p style={{ fontSize: 15, color: "#6b7794", margin: "0 0 20px" }}>
        {tr("ops.cost.pageIntro", { days: windowDays })}
      </p>

      <nav style={{ display: "flex", gap: 8, margin: "0 0 24px" }}>
        {WINDOWS.map((d) => (
          <a
            key={d}
            href={`/ops/cost?days=${d}`}
            style={{
              fontSize: 13,
              padding: "5px 12px",
              borderRadius: 999,
              textDecoration: "none",
              border: "1px solid #e4e8f0",
              background: d === windowDays ? "#111827" : "transparent",
              color: d === windowDays ? "#fff" : "#6b7794",
            }}
          >
            {tr("ops.cost.windowDays", { days: d })}
          </a>
        ))}
      </nav>

      {/* The three numbers the seat price is decided against. */}
      <section style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "0 0 28px" }}>
        {([
          [tr("ops.cost.students"), String(report.totals.students)],
          [tr("ops.cost.meanPerStudent"), usd(report.meanCostUsd)],
          [tr("ops.cost.worstStudent"), usd(report.maxCostUsd)],
          [tr("ops.cost.total"), usd(report.totals.costUsd)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 12, color: "#6b7794" }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </section>

      {report.students.length === 0 ? (
        <p style={{ fontSize: 14, color: "#6b7794" }}>{tr("ops.cost.empty")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", margin: "0 0 28px" }}>
          <thead>
            <tr>
              <th style={TH}>{tr("ops.cost.colStudent")}</th>
              <th style={{ ...TH, textAlign: "right" }}>{tr("ops.cost.colTurns")}</th>
              <th style={{ ...TH, textAlign: "right" }}>{tr("ops.cost.colTokens")}</th>
              <th style={{ ...TH, textAlign: "right" }}>{tr("ops.cost.colPerTurn")}</th>
              <th style={{ ...TH, textAlign: "right" }}>{tr("ops.cost.colCost")}</th>
            </tr>
          </thead>
          <tbody>
            {report.students.map((s) => (
              <tr key={s.userId}>
                <td style={TD}>
                  {s.label}
                  {s.unmeasuredTurns > 0 && (
                    <span style={{ fontSize: 11, color: "#b45309", marginLeft: 8 }}>
                      {tr("ops.cost.unmeasured", { n: s.unmeasuredTurns })}
                    </span>
                  )}
                </td>
                <td style={NUM}>{s.turns}</td>
                <td style={NUM}>{s.tokens.toLocaleString("en-US")}</td>
                <td style={NUM}>{usd(s.turns ? s.costUsd / s.turns : null)}</td>
                <td style={{ ...NUM, fontWeight: 600 }}>{usd(s.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>{tr("ops.cost.byModel")}</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", margin: "0 0 24px" }}>
        <thead>
          <tr>
            <th style={TH}>{tr("ops.cost.colModel")}</th>
            <th style={{ ...TH, textAlign: "right" }}>{tr("ops.cost.colTurns")}</th>
            <th style={{ ...TH, textAlign: "right" }}>{tr("ops.cost.colTokens")}</th>
            <th style={TH}>{tr("ops.cost.colRate")}</th>
          </tr>
        </thead>
        <tbody>
          {report.models.map((m) => (
            <tr key={m.model}>
              <td style={TD}>{m.model}</td>
              <td style={NUM}>{m.turns}</td>
              <td style={NUM}>{m.tokens.toLocaleString("en-US")}</td>
              <td style={{ ...TD, fontSize: 12, color: m.rate ? "#6b7794" : "#b45309" }}>
                {m.rate
                  ? `$${m.rate.inputPerMTok} / $${m.rate.outputPerMTok} · ${
                      m.rateSource === "configured"
                        ? tr("ops.cost.rateConfigured")
                        : tr("ops.cost.rateFallback")
                    }`
                  : tr("ops.cost.rateMissing")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* What the numbers rest on. Printed next to them, not in a doc nobody
          opens, because a cost figure without its assumptions gets quoted as
          fact — including by me, to someone asking about margins. */}
      <div style={{ fontSize: 12, color: "#6b7794", lineHeight: 1.7, borderTop: "1px solid #e4e8f0", paddingTop: 16 }}>
        <p style={{ margin: "0 0 6px" }}>
          {tr("ops.cost.assumptionSplit", { share: Math.round(ASSUMED_INPUT_SHARE * 100) })}
        </p>
        {unpriced.length > 0 && (
          <p style={{ margin: "0 0 6px", color: "#b45309" }}>
            {tr("ops.cost.assumptionUnpriced", { models: unpriced.map((m) => m.model).join(", ") })}
          </p>
        )}
        {report.totals.unmeasuredTurns > 0 && (
          <p style={{ margin: "0 0 6px", color: "#b45309" }}>
            {tr("ops.cost.assumptionUnmeasured", { n: report.totals.unmeasuredTurns })}
          </p>
        )}
        {report.truncated && (
          <p style={{ margin: "0 0 6px", color: "#b45309" }}>{tr("ops.cost.assumptionTruncated")}</p>
        )}
      </div>
    </main>
  );
}
