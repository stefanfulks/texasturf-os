/**
 * Access control for RESTRICTED users — outside guests scoped to specific
 * departments (e.g. a marketing contractor who should only see /marketing).
 *
 * A user is "restricted" when their auth `app_metadata` carries
 *   { restricted: true, departments: ["marketing", ...] }
 * `app_metadata` is server-only and cannot be edited by the user, so it is safe
 * to authorize on. Staff have no such flag, so every helper here is a no-op for
 * them — the gate simply never fires.
 *
 * Keep this module DEPENDENCY-FREE. It runs inside edge middleware; importing
 * the nav/department modules would pull `lucide-react` into the edge bundle.
 * The department list + prefixes are duplicated here on purpose (mirrors
 * `lib/departments` and `NAV_WORKSPACES.prefixes`).
 */

export const ACCESS_DEPARTMENTS = [
  "sales",
  "warehouse",
  "office",
  "field",
  "marketing",
  "financial",
] as const;
export type AccessDepartment = (typeof ACCESS_DEPARTMENTS)[number];

/** Route prefixes each department owns. Mirrors NAV_WORKSPACES.prefixes. */
const DEPARTMENT_PREFIXES: Record<AccessDepartment, string[]> = {
  sales:     ["/sales", "/pitch", "/pricing", "/jobs", "/clients"],
  warehouse: ["/inventory", "/fleet", "/operations"],
  office:    ["/invoices", "/vendors", "/clients", "/jobs"],
  field:     ["/today", "/install"],
  marketing: ["/marketing"],
  financial: ["/admin/finance", "/reports"],
};

/**
 * Personal / account surfaces any signed-in user may reach regardless of
 * department restriction — their home, tasks, calendar, settings, sign-out.
 * Without these a restricted guest would have no working landing shell.
 */
const UNIVERSAL_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/tasks",
  "/calendar",
  "/meetings",
  "/feedback",
  "/assistant",
  "/settings",
];

export type Restriction = { restricted: boolean; departments: AccessDepartment[] };

export function isAccessDepartment(v: unknown): v is AccessDepartment {
  return typeof v === "string" && (ACCESS_DEPARTMENTS as readonly string[]).includes(v);
}

/** Read the restriction marker off an auth user's `app_metadata`. Tolerant of shape. */
export function readRestriction(appMetadata: unknown): Restriction {
  const m = (appMetadata ?? {}) as { restricted?: unknown; departments?: unknown };
  const restricted = m.restricted === true;
  const departments = Array.isArray(m.departments)
    ? m.departments.filter(isAccessDepartment)
    : [];
  return { restricted, departments };
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * May a restricted user scoped to `departments` reach this path?
 *
 * - `/api/*` is always allowed: API handlers run under RLS, and page-owned
 *   Server Actions POST to their own page path (so they're gated by the page).
 * - Universal/account pages are always allowed.
 * - Everything else must belong to one of the user's departments.
 */
export function isPathAllowedForRestricted(
  pathname: string,
  departments: AccessDepartment[],
): boolean {
  if (pathname.startsWith("/api/")) return true;
  if (UNIVERSAL_PREFIXES.some((p) => matches(pathname, p))) return true;
  return departments.some((d) =>
    DEPARTMENT_PREFIXES[d].some((p) => matches(pathname, p)),
  );
}

/** Where to send a restricted user who hit a disallowed route (their home). */
export function restrictedHome(departments: AccessDepartment[]): string {
  const first = departments[0];
  if (first && DEPARTMENT_PREFIXES[first][0]) return DEPARTMENT_PREFIXES[first][0];
  return "/dashboard";
}
