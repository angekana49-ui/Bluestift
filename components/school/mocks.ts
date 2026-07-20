import type { SchoolShellProps } from "@/components/school/contracts";

/**
 * Mock data (no callbacks) for building SchoolShell in isolation at /preview/school.
 * NOTE: `dashboard` is left null on purpose — its full shape (SchoolDashboard)
 * is rich; fill a realistic fixture as you build each panel, importing the type
 * from `@/lib/school-admin` so TS keeps you honest.
 */
export const schoolMock: Omit<SchoolShellProps, never> = {
  role: "admin_master",
  dashboard: null,
  profClasses: [],
  initialTab: null,
  initialJoinCode: null,
};
