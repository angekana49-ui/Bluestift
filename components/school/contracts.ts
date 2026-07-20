/**
 * Schools — prop contract. Seam between the container (`components/school-admin.tsx`,
 * keeps tab state + /api/school calls) and your presentational screens.
 *
 * The rich types already live in `lib/school-admin.ts` — reuse them, don't
 * redefine. Each sub-panel (overview / class-view / student-view / insights /
 * reports / team) takes a slice of `dashboard`.
 */
import type {
  SchoolRole,
  SchoolDashboard,
  AdminClass,
} from "@/lib/school-admin";

export type SchoolShellProps = {
  // ── data in ──────────────────────────────────────────────
  role: SchoolRole | null; // 'admin_master' | 'prof' | null
  dashboard: SchoolDashboard | null; // admin_master view (school + classes)
  profClasses: AdminClass[]; // prof view (assigned classes, read-only)
  initialTab: string | null;
  initialJoinCode: string | null;
  // ── actions out ──────────────────────────────────────────
  // Add the callbacks your UI needs (create class, generate code, run
  // simulation, generate report…). Keep them here so the container stays
  // the single owner of the /api/school/* calls.
};

// Re-export the domain types so screens import everything from one place.
export type {
  SchoolRole,
  SchoolDashboard,
  AdminClass,
} from "@/lib/school-admin";
