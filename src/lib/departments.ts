/**
 * Department model — what a user DOES every day. Drives the personalized
 * dashboard and nav surface. Orthogonal to `role`, which is the permission
 * tier (admin / office / field).
 */
import {
  Briefcase, Warehouse, Building2, HardHat, Megaphone, Banknote,
  type LucideIcon,
} from "lucide-react";

export const DEPARTMENTS = [
  "sales",
  "warehouse",
  "office",
  "field",
  "marketing",
  "financial",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(v: unknown): v is Department {
  return typeof v === "string" && (DEPARTMENTS as readonly string[]).includes(v);
}

export const DEPARTMENT_LABEL: Record<Department, string> = {
  sales:     "Sales",
  warehouse: "Warehouse",
  office:    "Office",
  field:     "Field",
  marketing: "Marketing",
  financial: "Financial",
};

export const DEPARTMENT_EMOJI: Record<Department, string> = {
  sales:     "💼",
  warehouse: "📦",
  office:    "🏢",
  field:     "🏗️",
  marketing: "📣",
  financial: "💰",
};

// SVG-icon equivalents of the emoji above — preferred for UI (themeable, crisp,
// consistent). Pair with the `.medallion` primitive. The emoji map stays for any
// surface not yet migrated.
export const DEPARTMENT_ICON: Record<Department, LucideIcon> = {
  sales:     Briefcase,
  warehouse: Warehouse,
  office:    Building2,
  field:     HardHat,
  marketing: Megaphone,
  financial: Banknote,
};

// Hub pages used to be card-grid menus that just funneled to the real tools.
// They were deleted in the layout-consolidation pass; the AppSwitcher dropdown
// is now the catalog. Each department links straight into its primary tool.
export const DEPARTMENT_HREF: Record<Department, string> = {
  sales:     "/pricing",
  warehouse: "/inventory",
  office:    "/invoices",
  field:     "/tasks",
  marketing: "/marketing",
  financial: "/reports",
};

export const DEPARTMENT_DESCRIPTION: Record<Department, string> = {
  sales:     "Quoting, leads, customer projects.",
  warehouse: "Rolls, jobs, receiving, cuts, returns.",
  office:    "Invoices, vendors, projects, fleet.",
  field:     "Installer view: assigned jobs, schedule, time tracking.",
  marketing: "Content, campaigns, SEO, reviews.",
  financial: "Reports, budgets, P&L, cash flow.",
};

/**
 * Order departments with the user's own first, then the rest in canonical
 * order. If the user has no department set, returns the canonical order.
 */
export function orderForUser(user: Department | null | undefined): Department[] {
  if (!user || !isDepartment(user)) return [...DEPARTMENTS];
  return [user, ...DEPARTMENTS.filter((d) => d !== user)];
}

/**
 * Multi-department aware version. The user's own departments come first
 * (in the order they appear in `userDepts`), then everything else.
 */
export function orderForUserMulti(userDepts: Department[] | null | undefined): Department[] {
  if (!userDepts || userDepts.length === 0) return [...DEPARTMENTS];
  const ownSet = new Set(userDepts.filter(isDepartment));
  return [
    ...userDepts.filter((d): d is Department => ownSet.has(d)),
    ...DEPARTMENTS.filter((d) => !ownSet.has(d)),
  ];
}

/** Parse the departments array from a profiles row, tolerating null / shape variations. */
export function parseDepartments(value: unknown): Department[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Department => typeof v === "string" && isDepartment(v));
}
