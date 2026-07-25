"use client";

import type { SchoolShellProps } from "@/components/school/contracts";

/**
 * Schools — presentational shell. STUB: design it here. Props only, no fetch.
 *
 * Suggested breakdown: role-aware tabs (admin_master: Overview · Classes ·
 * Team · Raya · Reports · Insights · LMS ; prof: assigned classes read-only),
 * then per-tab panels each fed a slice of `dashboard`.
 */
export function SchoolShell(props: SchoolShellProps) {
  const classes = props.dashboard?.classes.length ?? props.profClasses.length;
  return (
    <div style={{ border: "1px dashed #556", borderRadius: 4, padding: 24, opacity: 0.7 }}>
      <strong>SchoolShell</strong> — stub to design
      <div style={{ fontSize: 14, opacity: 0.6, marginTop: 4 }}>
        role: {props.role ?? "none"} · {classes} classes
      </div>
    </div>
  );
}
